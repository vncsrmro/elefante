// The Tuca: the agent that builds the others. The person tells him what they
// want to hand off, he asks a little and proposes an agent with
// propor_agente. The proposal is a card in the chat; nothing exists until the
// person creates it. He has no connectors, no web and no computer of his own.
import { randomUUID } from 'node:crypto'
import { L } from '../shared/lang'
import { codexValue, ENGINES, MODELS, modelInfo, type Agent, type AgentColor, type AgentDraft, type Connector, type Effort, type GrantLevel, type Settings } from '../shared/types'
import type { ToolDef } from './gateway'

const COLORS: AgentColor[] = ['sky', 'indigo', 'violet', 'rose', 'amber', 'green', 'teal', 'graphite']
const EFFORTS: Effort[] = ['low', 'medium', 'high']

// In the app's language when the Tuca is made (they're saved with him, like any agent's).
export const tucaInstructions = (): string =>
  L(
    [
      'Você é o Fante, quem projeta e monta os agentes no Elefante. A pessoa te conta uma tarefa ou uma área que quer delegar, e você desenha o agente certo pra ela.',
      '- Pergunte pouco: no máximo três perguntas, uma por vez, curtas. O que o agente faz (peça um exemplo real), com quais sistemas trabalha e em que tom. O que a pessoa já disse, não pergunte de novo.',
      '- Depois proponha com propor_agente. Não descreva o agente em texto antes: o card mostra tudo, e a pessoa ajusta por ele ou pedindo pra você.',
      '- NUNCA imprima JSON bruto ou blocos de código com a proposta no texto. Chame SEMPRE a ferramenta propor_agente para exibir o card.',
      '- Se a pessoa aprovar, disser "pode criar", "aprovar", "cria ele", "ok", "perfeito", chame IMEDIATAMENTE a ferramenta criar_agente para ativar o agente no Elefante. Nunca diga que criou em texto sem chamar a ferramenta.',
      '- As instruções do agente são escritas como pra um colega novo: o que faz, como entrega, o que evita e quando pergunta. De 4 a 8 linhas, em português, falando com ele ("Você...").',
      '- Stack moderna e flexível: Python (uv, FastAPI, IA/automações), TypeScript/React (Vite, Next.js, Cloudflare Workers, Remotion), Supabase e Firebase. Sem Prisma.',
      '- Acesso mínimo: conectores só em leitura, a não ser que a tarefa peça escrita. Web só quando o agente precisa de informação de fora.',
      '- O modelo mais simples que dá conta; esforço alto só pra tarefa difícil.',
      '- Um agente por tarefa clara. Se pedirem algo enorme, sugira dividir em dois.',
      '- Depois que a pessoa criar, sugira uma primeira tarefa pra testar.'
    ].join('\n'),
    [
      "You are Fante, who designs and builds agents in Elefante. The person tells you a task or an area they want to hand off, and you design the right agent for it.",
      "- Ask little: three questions at most, one at a time, short. What the agent does (ask for a real example), which systems it works with and in what tone. Don't ask again what the person already said.",
      "- Then propose with propor_agente. Don't describe the agent in text first: the card shows everything, and the person adjusts it there or by asking you.",
      "- NEVER output raw JSON or code blocks with the proposal in chat text. ALWAYS call the propor_agente tool so the card appears.",
      '- If the person approves, says "create it", "approved", "ok", "go ahead", call the criar_agente tool IMMEDIATELY to activate the agent in Elefante. Never say you created it in text without calling the tool.',
      '- The agent\'s instructions are written as if for a new colleague: what it does, how it delivers, what it avoids and when it asks. 4 to 8 lines, in English, talking to it ("You...").',
      '- Modern and flexible stack: Python (uv, FastAPI, AI/automation), TypeScript/React (Vite, Next.js, Cloudflare Workers, Remotion), Supabase and Firebase. No Prisma.',
      '- Minimal access: connectors read-only, unless the task needs writing. Web only when the agent needs outside information.',
      '- The simplest model that does the job; high effort only for a hard task.',
      '- One agent per clear task. If they ask for something huge, suggest splitting it in two.',
      '- Once the person creates it, suggest a first task to test it.'
    ].join('\n')
  )

export const PROPOR_AGENTE: ToolDef = {
  name: 'propor_agente',
  get description() {
    return L(
      'Propõe um agente novo. Vira um card na conversa com Criar, Editar antes e Descartar: só existe se a pessoa criar. Pra ajustar uma proposta, chame de novo com tudo.',
      'Proposes a new agent. It becomes a card in the conversation with Create, Edit first and Discard: it only exists if the person creates it. To adjust a proposal, call again with everything.'
    )
  },
  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        nome: { type: 'string', description: L('Um nome de gente, curto (ex.: "Rafa").', 'A short, human name (e.g. "Rafa").') },
        funcao: { type: 'string', description: L('Em uma ou duas palavras (ex.: "Suporte").', 'In one or two words (e.g. "Support").') },
        cor: { type: 'string', enum: COLORS },
        instrucoes: { type: 'string', description: L('O que ele faz, como entrega, o que evita e quando pergunta. De 4 a 8 linhas, falando com ele.', 'What it does, how it delivers, what it avoids and when it asks. 4 to 8 lines, talking to it.') },
        modelo: { type: 'string', description: L('O id de um modelo da lista "Modelos que dá pra usar".', 'The id of a model from the "Models you can use" list.') },
        esforco: { type: 'string', enum: EFFORTS },
        web: { type: 'boolean', description: L('Se busca e lê páginas da web.', 'Whether it searches and reads web pages.') },
        conectores: {
          type: 'array',
          description: L('Os sistemas que ele usa, da lista "Conectores". Leitura por padrão.', 'The systems it uses, from the "Connectors" list. Read-only by default (nivel "escrita" to write).'),
          items: { type: 'object', properties: { conector: { type: 'string' }, nivel: { type: 'string', enum: ['leitura', 'escrita'] } }, required: ['conector'] }
        },
        primeira_tarefa: { type: 'string', description: L('Um pedido curto pra testar o agente assim que ele existir.', 'A short request to test the agent as soon as it exists.') },
        motivo: { type: 'string', description: L('Por que esse desenho, em uma frase. Aparece no card.', 'Why this design, in one sentence. It shows on the card.') }
      },
      required: ['nome', 'funcao', 'instrucoes']
    }
  }
}

export const CRIAR_AGENTE: ToolDef = {
  name: 'criar_agente',
  get description() {
    return L(
      'Cria e ativa o agente proposto definitivamente no Elefante. Chame sempre que a pessoa aprovar, disser "pode criar", "gostei", "cria ele", ou confirmar a proposta.',
      'Creates and permanently activates the proposed agent in Elefante. Call whenever the person approves, says "create it", "like it", "go ahead", or confirms the proposal.'
    )
  },
  get inputSchema() {
    return {
      type: 'object' as const,
      properties: {
        nome: { type: 'string', description: L('Nome do agente proposto a ser criado (opcional).', 'Name of the proposed agent to create (optional).') }
      }
    }
  }
}

// The models agents can run on now: the listed ones of a ready plan, and what OpenCode and Pi list.
export function availableModels(s: Pick<Settings, 'engines'>, listed: Partial<Record<string, string[]>> = {}): { id: string; label: string }[] {
  // Codex's own catalog when there is one (newest first); the app's list otherwise.
  const codex = listed['codex']?.length ? listed['codex'].map((slug) => modelInfo(codexValue(slug)) ?? { id: slug, engine: 'codex' as const, label: slug, hint: '' }) : undefined
  const plan = [...MODELS.filter((m) => m.engine !== 'codex' || !codex), ...(codex ?? []).map((m) => ({ ...m, id: codexValue(m.id) }))]
    .filter((m) => s.engines[m.engine]?.loggedIn && s.engines[m.engine]?.route !== 'gateway')
    .map((m) => ({ id: m.id, label: `${ENGINES[m.engine].label} · ${m.label}` }))
  const own = (['opencode', 'pi'] as const).flatMap((e) => (s.engines[e]?.loggedIn ? (listed[e] ?? []).slice(0, 12).map((name) => ({ id: `${e}:${name}`, label: `${ENGINES[e].label} · ${name}` })) : []))
  return [...plan, ...own]
}

// What the Tuca sees of the workspace in his prompt.
export function builderSection(s: Pick<Settings, 'engines'>, ctx: { models: { id: string; label: string }[]; connectors: Connector[]; team: Agent[]; own: string }): string {
  const gateway = (Object.keys(s.engines) as (keyof Settings['engines'])[]).filter((e) => s.engines[e].loggedIn && s.engines[e].route === 'gateway')
  return [
    L('## Pra montar agentes', '## For building agents'),
    `${L('Modelos que dá pra usar (passe o id em "modelo")', 'Models you can use (pass the id in "modelo")')}:\n${ctx.models.map((m) => `- ${m.id}: ${m.label}`).join('\n') || `- ${ctx.own}: ${L('o seu', 'yours')}`}`,
    gateway.length > 0 &&
      L(
        `Pelo gateway da empresa também dá pra usar qualquer modelo que ele sirva, com o id "${gateway[0]}:<nome exato>". Na dúvida, use o seu: ${ctx.own}.`,
        `Through the company gateway you can also use any model it serves, with the id "${gateway[0]}:<exact name>". When in doubt, use yours: ${ctx.own}.`
      ),
    `${L('Conectores (pra "conectores")', 'Connectors (for "conectores")')}: ${ctx.connectors.map((c) => c.name).join(', ') || L('nenhum ainda. Se a tarefa precisar de um sistema, diga que dá pra conectar em Conectores depois.', 'none yet. If the task needs a system, say it can be connected in Connectors later.')}`,
    `${L('O time hoje', 'The team today')}: ${ctx.team.map((a) => `${a.name} (${a.role || L('sem função', 'no role')})`).join(', ') || L('ninguém ainda: este é o primeiro agente.', 'no one yet: this is the first agent.')} ${L('Não proponha alguém que repete um desses.', "Don't propose someone who repeats one of these.")}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

// A propor_agente call as a draft, or what to fix.
export function draftFrom(args: Record<string, unknown>, ctx: { usable: (modelId: string) => boolean; fallbackModel: string; connectors: Connector[] }): { draft?: AgentDraft; error?: string } {
  const text = (keys: string | string[], max: number): string => {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const k of list) {
      if (typeof args[k] === 'string' && (args[k] as string).trim()) {
        return (args[k] as string).trim().slice(0, max)
      }
    }
    return ''
  }
  const name = text(['nome', 'name'], 40)
  const instructions = text(['instrucoes', 'instruções', 'instructions', 'prompt'], 4000)
  if (!name || !instructions) return { error: L('Faltou nome ou instrucoes.', 'Missing nome or instrucoes.') }
  const grants: Record<string, GrantLevel> = {}
  const unknown: string[] = []
  for (const c of Array.isArray(args['conectores']) ? (args['conectores'] as unknown[]) : []) {
    const r = (c ?? {}) as Record<string, unknown>
    const wanted = String(r['conector'] ?? '').trim()
    const found = ctx.connectors.find((x) => x.name.toLowerCase() === wanted.toLowerCase())
    if (!found) unknown.push(wanted)
    else grants[found.id] = r['nivel'] === 'escrita' ? 'read_write' : 'read'
  }
  if (unknown.length) {
    const names = unknown.map((u) => `"${u}"`).join(', ')
    return { error: L(`Não existe conector ${names}. Use só os da lista, ou deixe sem e diga que dá pra conectar depois.`, `There's no connector ${names}. Use only the ones in the list, or leave it out and say it can be connected later.`) }
  }
  const model = text(['modelo', 'model'], 200)
  const effortRaw = (args['esforco'] ?? args['esforço'] ?? args['effort']) as Effort
  const effort = EFFORTS.includes(effortRaw) ? effortRaw : 'medium'
  const task = text(['primeira_tarefa', 'sugestao_primeira_tarefa', 'first_task', 'task', 'tarefa'], 500)
  const reason = text(['motivo', 'reason', 'justificativa'], 300)
  const role = text(['funcao', 'função', 'role', 'papel'], 40)
  return {
    draft: {
      name,
      role,
      color: COLORS.includes(args['cor'] as AgentColor) ? (args['cor'] as AgentColor) : 'teal',
      instructions,
      modelId: model && modelInfo(model) && ctx.usable(model) ? model : ctx.fallbackModel,
      effort,
      web: args['web'] === true,
      grants,
      ...(task ? { task } : {}),
      ...(reason ? { reason } : {})
    }
  }
}

// Fallback: extracts an agent proposal from chat text if the model returned raw JSON instead of calling propor_agente
export function extractDraftFromText(
  rawText: string,
  ctx: { usable: (modelId: string) => boolean; fallbackModel: string; connectors: Connector[] }
): { draft?: AgentDraft; cleanText?: string } | null {
  if (!rawText) return null
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*"(?:nome|name)"[\s\S]*"(?:instrucoes|instruções|instructions)"[\s\S]*\})/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0])
      if (typeof parsed === 'object' && parsed !== null) {
        const res = draftFrom(parsed, ctx)
        if (res.draft) {
          const cleanText = rawText.replace(jsonMatch[0], '').trim() || L('Preparei a proposta do agente abaixo. Você pode criar agora ou pedir ajustes.', 'I prepared the agent proposal below. You can create it now or ask for adjustments.')
          return { draft: res.draft, cleanText }
        }
      }
    } catch {
      // not JSON
    }
  }
  return null
}

// "Rafa" → "rafa", or "rafa-2" when taken.
export function freeHandle(name: string, taken: string[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 28) || 'agente'
  const start = base.length >= 2 ? base : `${base}-agente`
  if (!taken.includes(start)) return start
  for (let i = 2; ; i++) if (!taken.includes(`${start}-${i}`)) return `${start}-${i}`
}

export function agentFromDraft(d: AgentDraft, taken: string[], limit: number): Agent {
  return {
    id: randomUUID(),
    name: d.name,
    handle: freeHandle(d.name, taken),
    role: d.role,
    color: d.color,
    instructions: d.instructions,
    modelId: d.modelId,
    effort: d.effort,
    limit,
    used: 0,
    grants: d.grants,
    memory: 'auto',
    computer: false,
    web: d.web,
    archived: false
  }
}

export function tucaAgent(modelId: string, taken: string[], limit: number): Agent {
  return {
    id: randomUUID(),
    name: 'Fante',
    handle: freeHandle('fante', taken),
    role: L('Monta agentes', 'Builds agents'),
    color: 'amber',
    instructions: tucaInstructions(),
    modelId,
    effort: 'medium',
    limit,
    used: 0,
    grants: {},
    memory: 'read',
    computer: false,
    web: false,
    archived: false,
    kind: 'tuca'
  }
}

export const tucaHello = (): string =>
  L(
    'Oi, eu sou o Fante. Eu monto os agentes do seu time. Me conta uma tarefa que você queria tirar do seu prato, com um exemplo de verdade, e eu desenho o agente certo pra ela.',
    "Hi, I'm Fante. I build your team's agents. Tell me about a task you'd like off your plate, with a real example, and I'll design the right agent for it."
  )
