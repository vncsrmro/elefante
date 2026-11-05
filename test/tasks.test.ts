import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { Db } from '../src/core/db'
import { Tasks } from '../src/core/tasks'
import type { CoreEvent } from '../src/shared/rpc'
import type { Message } from '../src/shared/types'

describe('Tasks & Kanban Board (Fase 3)', () => {
  let db: Db
  let events: CoreEvent[]
  let sent: { conversationId: string; text: string }[]
  let tasks: Tasks

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'elefante-tasks-test-'))
    db = new Db(join(dir, 'test.db'))
    events = []
    sent = []

    db.saveAgent({
      id: 'a1',
      name: 'Dev',
      handle: 'dev',
      role: 'Full-Stack',
      color: 'sky',
      instructions: '',
      modelId: 'sonnet',
      effort: 'medium',
      limit: 100000,
      used: 0,
      grants: {},
      memory: 'auto',
      computer: false,
      archived: false
    })

    db.createConversation({
      id: 'c1',
      kind: 'channel',
      name: 'projetos',
      members: ['a1']
    })

    tasks = new Tasks({
      db,
      emit: (e) => events.push(e),
      send: (conversationId, text) => {
        sent.push({ conversationId, text })
      }
    })
  })

  it('creates, moves, and removes tasks manually', () => {
    const t = tasks.save({
      conversationId: 'c1',
      title: 'Migrate checkout to new gateway',
      agentId: 'a1',
      status: 'todo'
    })

    expect(t.number).toBe(1)
    expect(t.title).toBe('Migrate checkout to new gateway')
    expect(t.status).toBe('todo')
    expect(tasks.list()).toHaveLength(1)

    // Move to in_progress
    tasks.move(t.id, 'in_progress')
    const updated = db.task(t.id)
    expect(updated?.status).toBe('in_progress')
    expect(updated?.startedAt).toBeDefined()

    // Move to done
    tasks.move(t.id, 'done')
    const done = db.task(t.id)
    expect(done?.status).toBe('done')
    expect(done?.doneAt).toBeDefined()

    // Remove task
    tasks.remove(t.id)
    expect(tasks.list()).toHaveLength(0)
  })

  it('starts a task by sending message to conversation', async () => {
    const t = tasks.save({
      conversationId: 'c1',
      title: 'Fix payment webhook retry',
      agentId: 'a1',
      status: 'todo'
    })

    await tasks.start(t.id)

    expect(sent).toHaveLength(1)
    expect(sent[0]?.conversationId).toBe('c1')
    expect(sent[0]?.text).toContain('@dev Fix payment webhook retry')

    const inProgress = db.task(t.id)
    expect(inProgress?.status).toBe('in_progress')
    expect(inProgress?.pendingStart).toBe(true)
  })

  it('automatically advances tasks through columns as agent runs', async () => {
    const t = tasks.save({
      conversationId: 'c1',
      title: 'Optimize SQL indexes',
      agentId: 'a1',
      status: 'todo'
    })

    // Start task so it's pending start and waiting for agent
    await tasks.start(t.id)

    // Agent message starts working
    const m1: Message = {
      id: 'm1',
      conversationId: 'c1',
      author: { kind: 'agent', id: 'a1' },
      text: 'Starting index optimization',
      at: Date.now() + 10,
      run: {
        status: 'working',
        steps: [{ id: 's1', label: 'Analyzing slow queries', status: 'running' }]
      }
    }

    tasks.observe(m1)

    let current = db.task(t.id)
    expect(current?.status).toBe('in_progress')
    expect(current?.messageId).toBe('m1')

    // Agent hits an approval gate -> moves to review column!
    const m2: Message = {
      ...m1,
      run: {
        status: 'waiting_approval',
        approvalId: 'ap1',
        steps: [{ id: 's1', label: 'Asked approval', status: 'done' }]
      }
    }
    tasks.observe(m2)

    current = db.task(t.id)
    expect(current?.status).toBe('review')
    expect(current?.waiting).toBe('approval')

    // Follow-up message starts working on approved action
    const m3: Message = {
      id: 'm3',
      conversationId: 'c1',
      author: { kind: 'agent', id: 'a1' },
      text: 'Running approved optimization',
      at: Date.now() + 100,
      run: {
        status: 'working',
        steps: [{ id: 's2', label: 'Applying indexes', status: 'running' }]
      }
    }
    tasks.observe(m3)

    current = db.task(t.id)
    expect(current?.status).toBe('in_progress')
    expect(current?.messageId).toBe('m3')

    // Follow-up completes -> moves to done!
    tasks.observe({
      ...m3,
      run: {
        status: 'done',
        steps: [{ id: 's2', label: 'Finished', status: 'done' }]
      }
    })

    current = db.task(t.id)
    expect(current?.status).toBe('done')
    expect(current?.doneAt).toBeDefined()
  })

  it('auto-creates tasks from multi-step plans in agent messages', () => {
    const mPlan: Message = {
      id: 'mPlan1',
      conversationId: 'c1',
      author: { kind: 'agent', id: 'a1' },
      text: 'Here is the plan',
      at: Date.now(),
      run: {
        status: 'working',
        steps: [],
        todos: [
          { id: '1', title: 'Step 1: Check schema', status: 'done' },
          { id: '2', title: 'Step 2: Run migration', status: 'in_progress' },
          { id: '3', title: 'Step 3: Verify tests', status: 'pending' }
        ]
      }
    }

    tasks.observe(mPlan)

    const list = tasks.list()
    expect(list.length).toBeGreaterThan(0)
    const autoTask = list.find((x) => x.messageId === 'mPlan1')
    expect(autoTask).toBeDefined()
    expect(autoTask?.status).toBe('in_progress')
    expect(autoTask?.source).toBe('auto')
  })
})
