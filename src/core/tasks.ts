// The board: tasks that move on their own. A card is linked to the agent reply
// working on it, and every change of that reply's state moves the card:
// working → in progress, waiting on you → in review, done → done.
// Plans an agent writes with gerenciar_tarefas become cards by themselves.
import { randomUUID } from 'node:crypto'
import { L } from '../shared/lang'
import type { CoreEvent } from '../shared/rpc'
import { TASK_STATUSES, taskStatusOf, type Message, type Task, type TaskInput, type TaskStatus } from '../shared/types'
import type { Db } from './db'

export interface TasksDeps {
  db: Db
  emit: (e: CoreEvent) => void
  send: (conversationId: string, text: string) => Promise<void> | void // posts as the person, like the composer
  now?: () => number
}

const MIN_AUTO_TODOS = 2 // a plan of one step isn't worth a card
const TITLE_MAX = 200
const RELINK_WINDOW = 6 * 60 * 60_000 // a follow-up reply (after an answer or an approval) continues the same card

// "Refatora o login\nusando OAuth" → "Refatora o login", without @mentions, clipped.
export function titleFrom(text: string, max = 90): string {
  const line = text
    .replace(/@[\w.-]+/g, '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0) ?? ''
  const clean = line.replace(/\s+/g, ' ').replace(/^[-*#>\s]+/, '').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

export class Tasks {
  constructor(private deps: TasksDeps) {}

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  list(): Task[] {
    return this.deps.db.tasks().filter((t) => !t.dismissed)
  }

  private put(t: Task): Task {
    this.deps.db.saveTask(t)
    this.deps.emit({ type: 'task', task: t })
    return t
  }

  save(input: TaskInput): Task {
    const { db } = this.deps
    const title = input.title.trim().slice(0, TITLE_MAX)
    if (!title) throw new Error(L('Dê um título à tarefa.', 'Give the task a title.'))
    if (!db.conversation(input.conversationId)) throw new Error(L('Projeto não encontrado.', 'Project not found.'))
    if (input.agentId && !db.agent(input.agentId)) throw new Error(L('Agente não encontrado.', 'Agent not found.'))
    const now = this.now()
    const description = input.description?.trim() || undefined
    const existing = input.id ? db.task(input.id) : undefined
    if (existing) {
      const next: Task = { ...existing, title, description, agentId: input.agentId || undefined, conversationId: input.conversationId, updatedAt: now }
      return this.put(input.status && input.status !== existing.status ? this.moved(next, input.status) : next)
    }
    const status: TaskStatus = input.status && TASK_STATUSES.includes(input.status) ? input.status : 'todo'
    return this.put({
      id: input.id ?? randomUUID(),
      number: db.nextTaskNumber(),
      conversationId: input.conversationId,
      title,
      ...(description ? { description } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      status,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      ...(status === 'done' ? { doneAt: now } : {})
    })
  }

  private moved(t: Task, status: TaskStatus): Task {
    const now = this.now()
    const next: Task = { ...t, status, updatedAt: now }
    if (status === 'done') next.doneAt = now
    else delete next.doneAt
    if (status === 'todo' || status === 'done') {
      delete next.waiting
      delete next.pendingStart
    }
    if (status !== 'todo') delete next.blocked
    if (status === 'in_progress' && !next.startedAt) next.startedAt = now
    return next
  }

  move(id: string, status: TaskStatus): void {
    const t = this.deps.db.task(id)
    if (!t || !TASK_STATUSES.includes(status) || t.status === status) return
    this.put(this.moved(t, status))
  }

  async start(id: string): Promise<void> {
    const { db } = this.deps
    const t = db.task(id)
    if (!t) return
    const conv = db.conversation(t.conversationId)
    if (!conv) throw new Error(L('O projeto desta tarefa não existe mais.', "This task's project no longer exists."))
    const agent = t.agentId ? db.agent(t.agentId) : undefined
    const now = this.now()
    const next: Task = { ...t, status: 'in_progress', pendingStart: true, startedAt: now, updatedAt: now }
    delete next.blocked
    delete next.waiting
    delete next.messageId
    delete next.runStatus
    delete next.doneAt
    this.put(next)
    // In a DM the agent answers anyway; in a channel the mention picks who.
    const mention = agent && conv.kind === 'channel' ? `@${agent.handle} ` : ''
    const text = `${mention}${t.title}${t.description ? `\n\n${t.description}` : ''}\n\n_${L('Tarefa', 'Task')} #${t.number}_`
    await this.deps.send(conv.id, text)
  }

  remove(id: string): void {
    const t = this.deps.db.task(id)
    if (!t) return
    // A card of a reply stays as a tombstone, so the reply's next update doesn't bring it back.
    if (t.messageId) this.deps.db.saveTask({ ...t, dismissed: true, updatedAt: this.now() })
    else this.deps.db.removeTask(id)
    this.deps.emit({ type: 'task_removed', id })
  }

  removeConversation(conversationId: string): void {
    for (const t of this.list()) if (t.conversationId === conversationId) this.deps.emit({ type: 'task_removed', id: t.id })
  }

  // Every message the core emits passes here; agent replies move their cards.
  observe(m: Message): void {
    if (m.author.kind !== 'agent' || !m.run) return
    const { db } = this.deps
    const own = db.taskOfMessage(m.id)
    if (own?.dismissed) return
    const linked = own ?? this.claim(m) ?? ((m.run.todos?.length ?? 0) >= MIN_AUTO_TODOS ? this.autoCreate(m) : undefined)
    if (linked) this.follow(linked, m)
  }

  // A reply that isn't on a card yet: the one a started task was waiting for, or
  // the follow-up of a card that was waiting on you (answered, approved).
  private claim(m: Message): Task | undefined {
    const agentId = m.author.kind === 'agent' ? m.author.id : ''
    const here = this.list().filter((t) => t.conversationId === m.conversationId && t.messageId !== m.id)
    const started = here
      .filter((t) => t.pendingStart && (!t.agentId || t.agentId === agentId) && m.at >= (t.startedAt ?? 0) - 1000)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0]
    if (started) return { ...started, agentId: started.agentId ?? agentId }
    if (m.run?.status !== 'working') return undefined
    const followUp = here
      .filter((t) => t.waiting && t.agentId === agentId && t.status === 'review' && m.at - t.updatedAt < RELINK_WINDOW)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    return followUp
  }

  private autoCreate(m: Message): Task {
    const { db } = this.deps
    const asked = db
      .recentMessages(m.conversationId, 30)
      .filter((x) => x.author.kind === 'me' && x.at <= m.at)
      .pop()
    const title = (asked && titleFrom(asked.text)) || m.run?.todos?.[0]?.title || L('Plano do agente', "Agent's plan")
    const now = this.now()
    return {
      id: randomUUID(),
      number: db.nextTaskNumber(),
      conversationId: m.conversationId,
      title,
      agentId: m.author.kind === 'agent' ? m.author.id : undefined,
      status: 'in_progress',
      source: 'auto',
      createdAt: now,
      updatedAt: now,
      startedAt: m.at
    }
  }

  private follow(t: Task, m: Message): void {
    const run = m.run!
    const relinked = t.messageId !== m.id
    if (!relinked && t.runStatus === run.status) {
      // Same state as last time: nothing moves, but a fresh card still needs saving.
      if (!this.deps.db.task(t.id)) this.put(t)
      return
    }
    const now = this.now()
    const s = taskStatusOf(run)
    const next: Task = { ...t, messageId: m.id, runStatus: run.status, updatedAt: now }
    delete next.pendingStart
    // The reply ended because you answered or decided: its follow-up continues the card.
    if (run.status === 'done' && t.waiting && !relinked) {
      this.put(next)
      return
    }
    next.status = s.status
    if (s.waiting) next.waiting = s.waiting
    else delete next.waiting
    if (s.blocked) next.blocked = run.error || L('A resposta parou antes de terminar.', 'The reply stopped before finishing.')
    else delete next.blocked
    if (s.status === 'done') next.doneAt = now
    else delete next.doneAt
    if (s.status === 'in_progress' && !next.startedAt) next.startedAt = now
    this.put(next)
  }
}
