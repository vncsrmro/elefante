// The phone (spec §19 & Hermes Agent style): a Telegram bot of the user's own.
// Features:
// - Two-way conversational messaging (Hermes Agent style): chat directly with agents via Telegram
// - Smart chunking: messages exceeding Telegram's 4096 character limit are split into sequential parts without truncation
// - Session & Channel management: /new, /chats, /chat to create or switch conversations
// - Team routing: /agents, /agent to view and pick specific agents, or mention @Agent
// - Approvals with interactive inline buttons (with 2-tap confirmation for high-risk actions)
// - Questions answered by replying to messages
// - Typing indicators while agents work
import { randomInt } from 'node:crypto'
import { L } from '../shared/lang'
import type { Agent, Approval, Conversation, Message, TelegramInfo } from '../shared/types'
import type { Secrets } from './secrets'

const API = 'https://api.telegram.org'
const TOKEN = 'telegram:token'
const CHAT = 'telegram:chat'
const ACTIVE_CONV = 'telegram:active_conv'
const ACTIVE_AGENT = 'telegram:active_agent'
const POLL_SECONDS = 50
const RETRY_MS = 15_000
const MAX_CHUNK_LENGTH = 3900 // Telegram limit is 4096 characters per message

type Fetch = typeof fetch
type Update = {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; first_name?: string; username?: string; title?: string }
    text?: string
    reply_to_message?: { message_id: number }
  }
  callback_query?: {
    id: string
    data?: string
    message?: { message_id: number; chat: { id: number } }
  }
}

export interface TelegramDeps {
  secrets: Pick<Secrets, 'get' | 'set'>
  decide(approvalId: string, decision: 'approved' | 'refused', reason?: string): Promise<void>
  approval(id: string): Approval | undefined
  answer(conversationId: string, text: string): void
  changed(): void
  fetch?: Fetch
  conversations?(): Conversation[]
  agents?(): Agent[]
  createConversation?(name: string, agentIds?: string[]): string
  activeConversationId?(): string | undefined
}

export class Telegram {
  private bot?: string
  private chat?: { id: number; name: string }
  private code = String(randomInt(100_000, 1_000_000))
  private error?: string
  private loop?: AbortController
  private offset = 0
  private questions = new Map<number, string>() // Telegram message id → conversation it asked from
  private activeConvId?: string
  private activeAgent?: string
  private followedConversations = new Set<string>()

  constructor(private deps: TelegramDeps) {}

  private get f(): Fetch {
    return this.deps.fetch ?? fetch
  }

  info(): TelegramInfo {
    return {
      bot: this.bot,
      chat: this.chat?.name,
      code: this.bot && !this.chat ? this.code : undefined,
      error: this.error
    }
  }

  async start(): Promise<void> {
    const token = await this.deps.secrets.get(TOKEN)
    if (!token) return

    this.chat = (await this.deps.secrets.get(CHAT).then((s) => (s ? (JSON.parse(s) as { id: number; name: string }) : undefined))) ?? undefined
    this.activeConvId = (await this.deps.secrets.get(ACTIVE_CONV)) ?? undefined
    this.activeAgent = (await this.deps.secrets.get(ACTIVE_AGENT)) ?? undefined

    try {
      this.bot = await this.me(token)
      this.error = undefined
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
    }

    this.deps.changed()
    this.listen(token)
  }

  stop(): void {
    this.loop?.abort()
    this.loop = undefined
  }

  // Checked with Telegram before it's saved; null forgets the bot and the pairing.
  async setToken(token: string | null): Promise<void> {
    const t = token?.trim()
    if (t) await this.me(t)
    this.stop()
    await this.deps.secrets.set(TOKEN, t || undefined)
    await this.deps.secrets.set(CHAT, undefined)
    await this.deps.secrets.set(ACTIVE_CONV, undefined)
    await this.deps.secrets.set(ACTIVE_AGENT, undefined)
    this.bot = undefined
    this.chat = undefined
    this.activeConvId = undefined
    this.activeAgent = undefined
    this.error = undefined
    this.code = String(randomInt(100_000, 1_000_000))
    if (t) await this.start()
    else this.deps.changed()
  }

  async unpair(): Promise<void> {
    await this.deps.secrets.set(CHAT, undefined)
    await this.deps.secrets.set(ACTIVE_CONV, undefined)
    await this.deps.secrets.set(ACTIVE_AGENT, undefined)
    this.chat = undefined
    this.activeConvId = undefined
    this.activeAgent = undefined
    this.code = String(randomInt(100_000, 1_000_000))
    this.deps.changed()
  }

  private async me(token: string): Promise<string> {
    let res: Response
    try {
      res = await this.f(`${API}/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) })
    } catch {
      throw new Error(L('Não consegui falar com o Telegram. Confira a internet.', "I couldn't reach Telegram. Check the internet."))
    }
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: { username?: string } } | null
    if (!res.ok || !body?.ok) throw new Error(L('O Telegram recusou esse token. Copie de novo do @BotFather.', 'Telegram refused that token. Copy it again from @BotFather.'))
    return `@${body.result?.username ?? 'bot'}`
  }

  private async api(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    const token = await this.deps.secrets.get(TOKEN)
    if (!token) return undefined
    const res = await this.f(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: signal ?? AbortSignal.timeout(15_000)
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null
    if (!body?.ok) throw new Error(body?.description ?? `Telegram ${res.status}`)
    return body.result
  }

  private listen(token: string): void {
    this.stop()
    const ctl = new AbortController()
    this.loop = ctl
    void (async () => {
      while (!ctl.signal.aborted) {
        try {
          const res = await this.f(
            `${API}/bot${token}/getUpdates?timeout=${POLL_SECONDS}&offset=${this.offset}&allowed_updates=${encodeURIComponent('["message","callback_query"]')}`,
            {
              signal: AbortSignal.any([ctl.signal, AbortSignal.timeout((POLL_SECONDS + 10) * 1000)])
            }
          )
          const body = (await res.json()) as { ok: boolean; result?: Update[]; description?: string }
          if (!body.ok) throw new Error(body.description ?? `Telegram ${res.status}`)
          for (const u of body.result ?? []) {
            this.offset = u.update_id + 1
            await this.handle(u).catch((e: unknown) => console.error('[telegram]', e))
          }
          if (this.error) {
            this.error = undefined
            this.deps.changed()
          }
        } catch (e) {
          if (ctl.signal.aborted) return
          const why = e instanceof Error ? e.message : String(e)
          if (why !== this.error) {
            this.error = why
            this.deps.changed()
          }
          await new Promise((r) => setTimeout(r, RETRY_MS))
        }
      }
    })()
  }

  private async handle(u: Update): Promise<void> {
    const m = u.message
    if (m?.text !== undefined) {
      if (!this.chat) {
        // Pairing: only someone who sends the 6-digit code shown in the app can pair
        if (m.text.replace('/start', '').trim() !== this.code) return
        this.chat = { id: m.chat.id, name: m.chat.title ?? m.chat.first_name ?? m.chat.username ?? 'Telegram' }
        await this.deps.secrets.set(CHAT, JSON.stringify(this.chat))
        this.deps.changed()
        await this.send(
          L(
            'Pronto: este chat recebe as aprovações, as perguntas dos agentes e o fim das rotinas. Pra responder a uma pergunta, responda à mensagem dela. Agora você também pode conversar livremente (estilo Hermes Agent) ou usar /help para ver comandos!',
            "Done: this chat gets the approvals, the agents' questions and the end of routines. To answer a question, reply to its message. You can now also chat freely (Hermes Agent style) or use /help to see commands!"
          )
        )
        return
      }

      if (m.chat.id !== this.chat.id) return
      const text = m.text.trim()

      // Handle Slash Commands
      if (text.startsWith('/')) {
        const cmd = text.split(' ')[0]!.toLowerCase()

        if (cmd === '/start') {
          const activeName = this.getActiveChannelName()
          const agentName = this.activeAgent || 'Rodrigo (Padrão)'
          await this.send(
            `🐘 *Elefante conectado (Modo Hermes Agent)*\n\n` +
            `📍 Chat ativo: #${activeName}\n` +
            `🤖 Agente preferencial: ${agentName}\n\n` +
            `Envie qualquer mensagem para conversar ou use /help para ver os comandos disponíveis.`
          )
          return
        }

        if (cmd === '/help' || cmd === '/ajuda') {
          await this.send(
            `📋 *Comandos do Elefante no Telegram (Hermes Agent)*:\n\n` +
            `💬 *Conversação direta:*\n` +
            `• Envie qualquer mensagem: o agente ativo responde diretamente aqui!\n` +
            `• Use \`@nome mensagem\` para direcionar (ex: \`@rodrigo analisa esse bug\`).\n\n` +
            `📂 *Canais & Chats:*\n` +
            `• \`/new [nome]\` ou \`/novo [nome]\`: Cria um novo chat no Elefante e foca nele.\n` +
            `• \`/chats\`: Lista os canais recentes com botões para alternar.\n` +
            `• \`/chat <nome ou número>\`: Alterna o canal ativo.\n\n` +
            `👥 *Agentes:*\n` +
            `• \`/agents\` ou \`/agentes\`: Lista o time com botões de seleção rápida.\n` +
            `• \`/agent <nome>\`: Define o agente ativo.\n\n` +
            `⚙️ *Geral:*\n` +
            `• \`/status\`: Exibe status do chat e agentes.\n` +
            `• \`/help\`: Exibe este guia.`
          )
          return
        }

        if (cmd === '/new' || cmd === '/novo') {
          const topic = text.replace(/^\/(new|novo)\s*/i, '').trim()
          const name = topic || `telegram-${Date.now().toString(36).slice(-4)}`
          if (this.deps.createConversation) {
            const id = this.deps.createConversation(name)
            this.activeConvId = id
            this.followedConversations.add(id)
            await this.deps.secrets.set(ACTIVE_CONV, id)
            await this.send(
              `✨ *Novo chat criado*: #${name}\n\n` +
              `Todas as mensagens seguintes serão executadas neste canal. O que deseja fazer?`
            )
          } else {
            await this.send(`⚠️ Não foi possível criar novo canal no momento.`)
          }
          return
        }

        if (cmd === '/chats' || cmd === '/conversas') {
          const convs = (this.deps.conversations?.() ?? []).filter((c) => c.kind === 'channel').slice(0, 10)
          if (convs.length === 0) {
            await this.send('Nenhum canal encontrado. Use /new para criar um novo!')
            return
          }
          const lines = convs.map((c, i) => `${i + 1}. #${c.name} ${c.id === this.activeConvId ? '📍 (Ativo)' : ''}`)
          const keyboard = convs.map((c) => [{ text: `#${c.name}`, callback_data: `chat:${c.id}` }])
          await this.send(
            `📂 *Canais do Elefante*:\n\n${lines.join('\n')}\n\nToque em um canal abaixo para alternar:`,
            { reply_markup: { inline_keyboard: keyboard } }
          )
          return
        }

        if (cmd === '/chat') {
          const arg = text.replace(/^\/chat\s*/i, '').trim()
          const convs = (this.deps.conversations?.() ?? []).filter((c) => c.kind === 'channel')
          const num = parseInt(arg, 10)
          let found = !isNaN(num) && num > 0 ? convs[num - 1] : undefined
          if (!found && arg) {
            found = convs.find(
              (c) =>
                c.name.toLowerCase() === arg.toLowerCase() ||
                c.id === arg ||
                c.name.toLowerCase().includes(arg.toLowerCase())
            )
          }
          if (found) {
            this.activeConvId = found.id
            this.followedConversations.add(found.id)
            await this.deps.secrets.set(ACTIVE_CONV, found.id)
            await this.send(`🔄 *Chat ativo alterado para*: #${found.name}`)
          } else {
            await this.send(`Canal não encontrado. Use /chats para ver a lista de canais disponíveis.`)
          }
          return
        }

        if (cmd === '/agents' || cmd === '/agentes') {
          const agents = this.deps.agents?.() ?? []
          if (agents.length === 0) {
            await this.send('Nenhum agente disponível no time.')
            return
          }
          const lines = agents.map(
            (a) => `• *${a.name}* (${a.role}) ${this.activeAgent?.toLowerCase() === a.name.toLowerCase() ? '🎯 (Ativo)' : ''}`
          )
          const buttons: { text: string; callback_data: string }[][] = []
          for (let i = 0; i < agents.length; i += 2) {
            const row = [{ text: agents[i]!.name, callback_data: `agent:${agents[i]!.name}` }]
            if (agents[i + 1]) row.push({ text: agents[i + 1]!.name, callback_data: `agent:${agents[i + 1]!.name}` })
            buttons.push(row)
          }
          await this.send(
            `👥 *Time de Agentes do Elefante*:\n\n${lines.join('\n')}\n\nToque no agente desejado para torná-lo ativo:`,
            { reply_markup: { inline_keyboard: buttons } }
          )
          return
        }

        if (cmd === '/agent' || cmd === '/agente') {
          const arg = text.replace(/^\/(agent|agente)\s*/i, '').trim()
          const agents = this.deps.agents?.() ?? []
          const found = agents.find(
            (a) => a.name.toLowerCase() === arg.toLowerCase() || a.name.toLowerCase().includes(arg.toLowerCase())
          )
          if (found) {
            this.activeAgent = found.name
            await this.deps.secrets.set(ACTIVE_AGENT, found.name)
            await this.send(`🎯 *Agente ativo*: ${found.name} (${found.role})\nEle responderá diretamente às suas mensagens!`)
          } else {
            await this.send(`Agente não encontrado. Use /agents para ver o time completo.`)
          }
          return
        }

        if (cmd === '/status') {
          const activeName = this.getActiveChannelName()
          const agentName = this.activeAgent || 'Rodrigo (Padrão)'
          await this.send(
            `📊 *Status do Elefante via Telegram*:\n\n` +
            `• Bot: ${this.bot ?? 'Conectado'}\n` +
            `• Usuário: ${this.chat?.name ?? 'Pareado'}\n` +
            `• Canal Elefante ativo: #${activeName}\n` +
            `• Agente ativo: ${agentName}\n\n` +
            `Tudo operacional! Pode enviar mensagens.`
          )
          return
        }
      }

      // Check if this is a reply to an agent question
      const convFromQuestion = m.reply_to_message && this.questions.get(m.reply_to_message.message_id)
      const convId = convFromQuestion || this.resolveActiveConvId()

      if (convId) {
        let finalBody = text
        if (this.activeAgent && !convFromQuestion && !/@\w+/.test(text)) {
          finalBody = `@${this.activeAgent} ${text}`
        }

        this.followedConversations.add(convId)
        void this.sendChatAction('typing')
        this.deps.answer(convId, finalBody)

        if (convFromQuestion) {
          await this.send(L('Mandei a sua resposta.', 'I sent your answer.'), { reply_to_message_id: m.message_id })
        }
      } else {
        await this.send(
          L(
            'Nenhuma conversa encontrada. Crie uma nova com /new para começar a conversar!',
            'No conversation found. Use /new to start chatting!'
          )
        )
      }
      return
    }

    const q = u.callback_query
    if (!q?.data || !this.chat || q.message?.chat.id !== this.chat.id) return
    const [kind, id, action] = q.data.split(':')

    const edit = (text: string, buttons?: unknown): Promise<unknown> =>
      this.api('editMessageText', {
        chat_id: this.chat!.id,
        message_id: q.message!.message_id,
        text,
        ...(buttons ? { reply_markup: buttons } : {})
      })

    // Handle Switch Chat button
    if (kind === 'chat' && id) {
      const conv = (this.deps.conversations?.() ?? []).find((c) => c.id === id)
      if (conv) {
        this.activeConvId = conv.id
        this.followedConversations.add(conv.id)
        await this.deps.secrets.set(ACTIVE_CONV, conv.id)
        await this.api('answerCallbackQuery', { callback_query_id: q.id, text: `Chat ativo: #${conv.name}` })
        await edit(`✅ *Chat ativo alterado para*: #${conv.name}\nPode enviar sua mensagem!`).catch(() => {})
      }
      return
    }

    // Handle Select Agent button
    if (kind === 'agent' && id) {
      const agent = (this.deps.agents?.() ?? []).find(
        (a) => a.name.toLowerCase() === id.toLowerCase() || a.id === id
      )
      if (agent) {
        this.activeAgent = agent.name
        await this.deps.secrets.set(ACTIVE_AGENT, agent.name)
        await this.api('answerCallbackQuery', { callback_query_id: q.id, text: `Agente: ${agent.name}` })
        await edit(`🎯 *Agente ativo*: ${agent.name} (${agent.role})\nEle responderá diretamente às suas mensagens!`).catch(() => {})
      }
      return
    }

    // Handle Approvals
    const ap = kind === 'ap' && id ? this.deps.approval(id) : undefined
    if (!ap || ap.state !== 'pending') {
      await this.api('answerCallbackQuery', { callback_query_id: q.id, text: L('Esse pedido já foi decidido.', 'That request was already decided.') })
      if (ap) await edit(`${approvalText(ap)}\n\n${ap.state === 'approved' ? L('✅ Aprovado', '✅ Approved') : ap.state === 'refused' ? L('❌ Recusado', '❌ Refused') : L('Expirou', 'Expired')}`).catch(() => {})
      return
    }
    if (action === 'ok' && ap.highRisk) {
      // High-risk needs second confirmation tap
      await this.api('answerCallbackQuery', { callback_query_id: q.id })
      await edit(`${approvalText(ap)}\n\n${L('⚠️ Alto risco. Tem certeza?', '⚠️ High risk. Are you sure?')}`, {
        inline_keyboard: [
          [
            { text: L('Sim, executar', 'Yes, run it'), callback_data: `ap:${ap.id}:sure` },
            { text: L('Recusar', 'Refuse'), callback_data: `ap:${ap.id}:no` }
          ]
        ]
      })
      return
    }
    const approve = action === 'ok' || action === 'sure'
    await this.api('answerCallbackQuery', { callback_query_id: q.id, text: approve ? L('Aprovado', 'Approved') : L('Recusado', 'Refused') })
    await edit(`${approvalText(ap)}\n\n${approve ? L('✅ Aprovado pelo Telegram', '✅ Approved from Telegram') : L('❌ Recusado pelo Telegram', '❌ Refused from Telegram')}`)
    await this.deps.decide(ap.id, approve ? 'approved' : 'refused', approve ? undefined : L('Recusado pelo Telegram', 'Refused from Telegram'))
  }

  private resolveActiveConvId(): string | undefined {
    const convs = this.deps.conversations?.() ?? []
    if (this.activeConvId && convs.some((c) => c.id === this.activeConvId)) {
      return this.activeConvId
    }
    const fromDeps = this.deps.activeConversationId?.()
    if (fromDeps && convs.some((c) => c.id === fromDeps)) {
      this.activeConvId = fromDeps
      return fromDeps
    }
    const first = convs.find((c) => c.kind === 'channel')
    if (first) {
      this.activeConvId = first.id
      return first.id
    }
    if (this.deps.createConversation) {
      const id = this.deps.createConversation('telegram')
      this.activeConvId = id
      return id
    }
    return undefined
  }

  private getActiveChannelName(): string {
    const convs = this.deps.conversations?.() ?? []
    const conv = convs.find((c) => c.id === this.activeConvId) || convs.find((c) => c.kind === 'channel')
    return conv?.name ?? 'geral'
  }

  // Sends raw message to Telegram
  private async sendRaw(text: string, extra: Record<string, unknown> = {}): Promise<number | undefined> {
    if (!this.chat) return undefined
    try {
      const r = (await this.api('sendMessage', { chat_id: this.chat.id, text, ...extra })) as { message_id?: number } | undefined
      return r?.message_id
    } catch (e) {
      if (extra['parse_mode']) {
        const { parse_mode: _, ...plain } = extra
        const r = (await this.api('sendMessage', { chat_id: this.chat.id, text, ...plain }).catch((err: unknown) => console.error('[telegram]', err))) as { message_id?: number } | undefined
        return r?.message_id
      }
      console.error('[telegram]', e)
      return undefined
    }
  }

  // Smart multi-part chunking: sends complete text without truncation
  async sendChunked(text: string, extra: Record<string, unknown> = {}): Promise<number | undefined> {
    if (!this.chat) return undefined
    const chunks = splitMessage(text, MAX_CHUNK_LENGTH)
    let lastId: number | undefined
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!
      lastId = await this.sendRaw(chunk, extra)
      if (chunks.length > 1 && i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 120))
      }
    }
    return lastId
  }

  // Public send method using smart chunking
  private async send(text: string, extra: Record<string, unknown> = {}): Promise<number | undefined> {
    return this.sendChunked(text, extra)
  }

  async sendChatAction(action = 'typing'): Promise<void> {
    if (!this.chat) return
    try {
      await this.api('sendChatAction', { chat_id: this.chat.id, action })
    } catch {}
  }

  // ---------- Agent events to Telegram ----------

  async agentWorking(conversationId: string): Promise<void> {
    if (this.followedConversations.has(conversationId) || this.activeConvId === conversationId) {
      void this.sendChatAction('typing')
    }
  }

  async agentReplied(msg: Message, agentName: string, convName?: string): Promise<void> {
    const convId = msg.conversationId
    const isRelevant = this.followedConversations.has(convId) || this.activeConvId === convId || (convName && convName.startsWith('telegram'))
    if (!isRelevant) return

    const where = convName ? `(#${convName})` : ''
    const header = `🤖 *${agentName}* ${where}:\n\n`
    const totalTokens = (msg.run?.receipt?.inputTokens ?? 0) + (msg.run?.receipt?.outputTokens ?? 0)
    const receiptInfo = msg.run?.receipt
      ? `\n\n⏱️ ${Math.round((msg.run.receipt.ms || 0) / 1000)}s · ${totalTokens} tokens`
      : ''
    const full = `${header}${msg.text}${receiptInfo}`
    await this.sendChunked(full)
  }

  async agentFailed(msg: Message, agentName: string, convName?: string, error?: string): Promise<void> {
    const convId = msg.conversationId
    const isRelevant = this.followedConversations.has(convId) || this.activeConvId === convId
    if (!isRelevant) return
    const where = convName ? `(#${convName})` : ''
    await this.send(`❌ *${agentName}* ${where}: Não foi possível concluir.\n\n${error || 'Erro desconhecido.'}`)
  }

  async approvalAsked(ap: Approval, agentName: string): Promise<void> {
    await this.send(`${L(`${agentName} pede aprovação`, `${agentName} asks for approval`)}\n\n${approvalText(ap)}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: L('Aprovar', 'Approve'), callback_data: `ap:${ap.id}:ok` },
            { text: L('Recusar', 'Refuse'), callback_data: `ap:${ap.id}:no` }
          ]
        ]
      }
    })
  }

  async questionAsked(msg: Message, agentName: string, where: string): Promise<void> {
    if (!msg.run?.question) return
    const id = await this.send(
      L(
        `${agentName} pergunta (${where}):\n\n${msg.run.question}\n\nResponda a esta mensagem.`,
        `${agentName} asks (${where}):\n\n${msg.run.question}\n\nReply to this message.`
      ),
      { reply_markup: { force_reply: true, input_field_placeholder: L('Sua resposta', 'Your answer') } }
    )
    if (id) {
      this.questions.set(id, msg.conversationId)
      this.followedConversations.add(msg.conversationId)
    }
  }

  async notice(title: string, body: string): Promise<void> {
    await this.send(`${title}\n\n${body}`)
  }
}

function approvalText(ap: Approval): string {
  const args = JSON.stringify(ap.args, null, 1)
  return `${ap.connectorName} · ${ap.tool}${ap.why ? `\n${L('Motivo', 'Reason')}: ${ap.why}` : ''}\n\n${args.length > 1500 ? `${args.slice(0, 1500)}…` : args}`
}

export function splitMessage(text: string, maxLen = MAX_CHUNK_LENGTH): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    let splitIndex = -1

    // Split on double newline (paragraph boundary)
    const lastParagraph = remaining.lastIndexOf('\n\n', maxLen)
    if (lastParagraph > maxLen * 0.4) {
      splitIndex = lastParagraph + 2
    } else {
      // Split on newline
      const lastLine = remaining.lastIndexOf('\n', maxLen)
      if (lastLine > maxLen * 0.4) {
        splitIndex = lastLine + 1
      } else {
        // Split on whitespace
        const lastSpace = remaining.lastIndexOf(' ', maxLen)
        if (lastSpace > maxLen * 0.4) {
          splitIndex = lastSpace + 1
        } else {
          splitIndex = maxLen
        }
      }
    }

    chunks.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex)
  }

  // Preserve fenced code blocks across chunks
  let inCodeBlock = false
  let codeLang = ''

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i]!
    if (inCodeBlock) {
      chunk = `\`\`\`${codeLang}\n` + chunk
    }

    const matches = chunk.match(/```([a-zA-Z0-9_-]*)/g)
    if (matches) {
      for (const m of matches) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLang = m.replace('```', '')
        } else {
          inCodeBlock = false
          codeLang = ''
        }
      }
    }

    if (inCodeBlock && i < chunks.length - 1) {
      chunk = chunk + '\n```'
    }

    chunks[i] = chunk
  }

  return chunks
}
