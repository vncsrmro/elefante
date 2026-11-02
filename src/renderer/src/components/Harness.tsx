// The harnesses agents run on (Claude Code, Codex, OpenCode, Pi), each used
// as the person set it up: their plan, their company's gateway or the
// providers they have logins for. Here they pick which ones the agents use,
// test them, and pick models from what each harness offers.
import { L } from '../../../shared/lang'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ENGINES,
  ENGINE_IDS,
  MODELS,
  startsPicked,
  codexValue,
  customModel,
  engineModels,
  fetchProviderModels,
  harnessMcps,
  importHarnessMcp,
  installEngine,
  loginEngine,
  modelInfo,
  navigate,
  openExternal,
  rememberModels,
  saveApiProvider,
  setTab,
  testEngine,
  updateSettings,
  useStore,
  type ApiProviderConfig,
  type ApiProviderId,
  type EngineId,
  type EngineStatus,
  type HarnessMcp,
  type Settings
} from '../store'
import { Icon } from './ui'

// The harnesses agents may run on now: picked (or all, if never picked), ready, and runnable.
export const usableEngines = (s: Settings): EngineId[] => ENGINE_IDS.filter((e) => s.engines[e].loggedIn)
// Some harness in use goes through a gateway: Jev and Telegram would send data around it.
export const onGateway = (s: Settings): boolean => usableEngines(s).some((e) => s.engines[e].route === 'gateway')

// ---------- models ----------

export interface ModelOption {
  value: string // a listed model's id, or "<engine>:<name>"
  label: string
  hint?: string
}

// A model list asked once per harness and route (and again after "Verificar de novo").
type Listed = { models: string[]; labels?: Record<string, { label: string; hint?: string }>; error?: string }
const lists = new Map<string, Promise<Listed>>()
export const clearModelLists = (): void => lists.clear()

// What a harness offers: the app's list on Claude's plan; Codex's own catalog (newest first);
// what OpenCode or Pi list; what the gateway lists.
export function useEngineModels(engine: EngineId | undefined): { options: ModelOption[]; loading: boolean; error?: string } {
  const st = useStore((s) => (engine ? s.settings.engines[engine] : undefined))
  const plan = !!engine && (engine === 'claude' || engine === 'codex') && st?.route !== 'gateway'
  const fixed = plan && engine === 'claude'
  const id = engine && st?.installed && !fixed ? `${engine}|${st.route}|${st.gateway ?? ''}|${st.account ?? ''}` : ''
  const [got, setGot] = useState<({ id: string } & Listed) | null>(null)
  useEffect(() => {
    if (!id || !engine) return
    if (!lists.has(id)) lists.set(id, engineModels(engine).catch((e: unknown) => ({ models: [], error: String(e) })))
    let live = true
    void lists.get(id)!.then((r) => {
      // Codex's and API's names, for wherever a model shows (an agent's page, a card).
      if ((engine === 'codex' || engine === 'api') && r.labels) rememberModels(Object.entries(r.labels).map(([slug, l]) => ({ id: slug, engine, label: l.label, hint: l.hint ?? '' })))
      if (live) setGot({ id, ...r })
    })
    return () => {
      live = false
    }
  }, [id, engine])
  if (!engine) return { options: [], loading: false }
  const mine = got?.id === id ? got : undefined
  const app = (): ModelOption[] => MODELS.filter((m) => m.engine === engine).map((m) => ({ value: m.id, label: m.label, hint: m.hint }))
  if (fixed) return { options: app(), loading: false }
  // Codex on a plan or a key: its catalog, the app's own list until it comes (or if it can't).
  if (plan)
    return mine?.models.length
      ? { options: mine.models.map((slug) => ({ value: codexValue(slug), label: mine.labels?.[slug]?.label ?? slug, hint: L('', mine.labels?.[slug]?.hint ?? '') || undefined })), loading: false }
      : { options: app(), loading: false }
  return { options: (mine?.models ?? []).map((m) => ({ value: customModel(engine, m), label: mine?.labels?.[m]?.label ?? m, hint: mine?.labels?.[m]?.hint })), loading: !!id && !mine, error: mine?.error }
}

const OTHER = '__outro__'

// A model to run with: the harness, then its model from the list, or another by name.
// jev adds TypeSafe's Jev (the router). Engines limits the harnesses offered.
export function ModelPicker({ value, onChange, engines, jev }: { value: string; onChange: (v: string) => void; engines?: EngineId[]; jev?: boolean }): ReactNode {
  const usable = useStore((s) => usableEngines(s.settings))
  const statuses = useStore((s) => s.settings.engines)
  const choices = (engines ?? usable).filter((e) => usable.includes(e))
  const m = value && value !== 'jev' ? modelInfo(value) : undefined
  const engine: EngineId | undefined = m && choices.includes(m.engine) ? m.engine : choices[0]
  const { options, loading, error } = useEngineModels(engine)
  const inList = options.some((o) => o.value === value)
  const [typing, setTyping] = useState(false)
  const other = value !== 'jev' && !!engine && (typing || (!!m?.id && m.engine === engine && !inList && !loading))
  const name = m && m.engine === engine && !MODELS.some((x) => x.id === value) ? m.id : ''

  // A harness's own card passes just that harness: it's already chosen there, so no select.
  const fixed = engines?.length === 1 && !jev
  if (!engine && !jev) return <p className="hint hint--warn">{L('Nenhum harness pronto. Veja em Configurações → Modelos.', 'No harness ready. See Settings → Models.')}</p>
  return (
    <div className="model-picker">
      {!fixed && (
        <select
          value={value === 'jev' ? 'jev' : engine}
          onChange={(e) => {
            setTyping(false)
            const v = e.target.value
            // On a plan, the harness's first model; otherwise the person picks from its list.
            const plan = v !== 'jev' && statuses[v as EngineId].route === 'plan' ? MODELS.find((x) => x.engine === v) : undefined
            onChange(v === 'jev' ? 'jev' : (plan?.id ?? customModel(v as EngineId, '')))
          }}
        >
          {choices.map((e) => (
            <option key={e} value={e}>
              {ENGINES[e].label}
            </option>
          ))}
          {jev && <option value="jev">TypeSafe · Jev</option>}
        </select>
      )}
      {value !== 'jev' && engine && (
        <select
          className="grow"
          value={other ? OTHER : inList ? value : ''}
          onChange={(e) => {
            const v = e.target.value
            if (v === OTHER) {
              setTyping(true)
              onChange(customModel(engine, name))
            } else {
              setTyping(false)
              onChange(v)
            }
          }}
        >
          {!inList && !other && (
            <option value="" disabled>
              {loading ? L('Buscando os modelos…', 'Fetching the models…') : options.length ? L('Escolha um modelo…', 'Pick a model…') : L('Sem lista: use Outro modelo', 'No list: use Other model')}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.hint ? ` · ${o.hint}` : ''}
            </option>
          ))}
          <option value={OTHER}>{L('Outro modelo…', 'Other model…')}</option>
        </select>
      )}
      {other && engine && (
        <input className="model-name grow" autoFocus={typing && !name} value={name} spellCheck={false} placeholder={L('O nome exato do modelo', 'The exact model name')} onChange={(e) => onChange(customModel(engine, e.target.value))} />
      )}
      {error && other && <span className="hint">{L('Não deu pra pegar a lista', 'Couldn’t get the list')}: {error}</span>}
    </div>
  )
}

// ---------- the harnesses ----------

const ROUTE = (): Record<NonNullable<EngineStatus['route']>, { label: string; tone: string }> => ({
  plan: { label: L('plano', 'plan'), tone: 'tag--ok' },
  gateway: { label: 'gateway', tone: 'tag--ok' },
  apikey: { label: L('chave de API', 'API key'), tone: 'tag--warn' },
  providers: { label: L('provedores', 'providers'), tone: 'tag--ok' }
})

// Every harness, with what was found in its own setup, a box to use it or not, and a test.
export function HarnessList(): ReactNode {
  const engines = useStore((s) => s.settings.engines)
  const chosen = useStore((s) => s.settings.harnesses)
  // Unpicked: the ones ready to run. Picking one off keeps the rest as they are.
  const picked = (e: EngineId): boolean => (chosen ? chosen.includes(e) : startsPicked(engines[e]))
  const toggle = (e: EngineId): void => {
    const now = ENGINE_IDS.filter(picked)
    updateSettings({ harnesses: now.includes(e) ? now.filter((x) => x !== e) : [...now, e] })
  }
  return (
    <div className="harnesses">
      {ENGINE_IDS.map((e) => (
        <HarnessRow key={e} engine={e} st={engines[e]} picked={picked(e)} toggle={() => toggle(e)} />
      ))}
    </div>
  )
}

function HarnessRow({ engine, st, picked, toggle }: { engine: EngineId; st: EngineStatus; picked: boolean; toggle: () => void }): ReactNode {
  const [testing, setTesting] = useState(false)
  const [model, setModel] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  // No terminal could be opened: the command, for the person to run.
  const [manual, setManual] = useState<string | null>(null)
  // The install: started in a terminal, or blocked on Node.js for an npm package.
  const [install, setInstall] = useState<'started' | 'node' | null>(null)
  const windows = useStore((s) => s.platform === 'windows')
  const ready = st.loggedIn
  const found = st.installed && !!st.route // what its setup says, picked or not

  async function test(): Promise<void> {
    setResult(null)
    try {
      setResult(await testEngine(model))
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className={`harness ${picked ? 'is-picked' : ''} ${st.soon ? 'is-soon' : ''}`}>
      <div className="harness__head">
        <button className={`harness__check ${picked ? 'is-on' : ''}`} disabled={!!st.soon || !st.installed} onClick={toggle} aria-label={L(`Usar o ${ENGINES[engine].label}`, `Use ${ENGINES[engine].label}`)}>
          {picked && <Icon name="check" size={12} />}
        </button>
        <div className="grow">
          <strong>{ENGINES[engine].label}</strong>
          <span className="harness__account">
            {!st.installed ? L('Não instalado', 'Not installed') : st.account ?? (st.loggedIn ? L('Pronto', 'Ready') : L('Falta entrar', 'Not signed in'))}
          </span>
        </div>
        {st.soon ? (
          <span className="tag">{L('em breve', 'coming soon')}</span>
        ) : found && st.route ? (
          <span className={`tag ${ROUTE()[st.route].tone}`}>{ROUTE()[st.route].label}</span>
        ) : st.installed ? (
          <span className="tag tag--warn">{L('falta entrar', 'not signed in')}</span>
        ) : null}
        {picked && ready && (
          <button className="btn btn--sm" onClick={() => setTesting(!testing)}>
            {L('Testar', 'Test')}
          </button>
        )}
        {!st.installed && !st.soon && (
          <button
            className="btn btn--sm btn--primary"
            title={L('Abre um terminal que instala pra você', 'Opens a terminal that installs it for you')}
            onClick={() => void installEngine(engine).then((r) => setInstall(r.needsNode ? 'node' : r.opened ? 'started' : null))}
          >
            {L('Instalar', 'Install')}
          </button>
        )}
        {st.installed && !st.loggedIn && !st.soon && (
          <button
            className="btn btn--sm btn--primary"
            title={engine === 'api' ? L('Abrir Provedores & APIs', 'Open Providers & APIs') : L(`Abre um terminal com: ${ENGINES[engine].login}`, `Opens a terminal with: ${ENGINES[engine].login}`)}
            onClick={() =>
              engine === 'api'
                ? navigate({ kind: 'providers' })
                : void loginEngine(engine).then((r) => setManual(r.opened ? null : r.command))
            }
          >
            {engine === 'api' ? L('Configurar APIs', 'Configure APIs') : L('Entrar', 'Sign in')}
          </button>
        )}
      </div>
      {manual && !st.loggedIn && (
        <div className="harness__body">
          <span className="hint">{L('Não achei um terminal pra abrir. Pra entrar, cole no seu terminal:', "Couldn't find a terminal to open. To sign in, paste in your terminal:")}</span>
          <code className="harness__cmd">{manual}</code>
        </div>
      )}
      {!st.installed && install === 'started' && <p className="hint harness__body">{L('Instalando no terminal que abriu. Quando terminar, ele aparece aqui sozinho.', 'Installing in the terminal that opened. Once it finishes, it shows up here on its own.')}</p>}
      {!st.installed && install === 'node' && (
        <p className="hint hint--warn harness__body">
          {L(`O ${ENGINES[engine].label} precisa do Node.js. Instale o Node.js e depois clique em Instalar de novo.`, `${ENGINES[engine].label} needs Node.js. Install Node.js, then click Install again.`)}{' '}
          <button className="btn btn--ghost btn--sm" onClick={() => openExternal('https://nodejs.org/')}>
            {L('Baixar o Node.js', 'Get Node.js')}
          </button>
        </p>
      )}
      {!st.installed && (
        <div className="harness__body">
          {/* npm.cmd: PowerShell blocks npm's .ps1 on a fresh Windows (scripts disabled). */}
          <span className="hint">{windows ? L('Ou cole no PowerShell:', 'Or paste in PowerShell:') : L('Ou cole no terminal:', 'Or paste in a terminal:')}</span>
          <code className="harness__cmd">{windows ? (ENGINES[engine].windows ?? ENGINES[engine].install).replace(/^npm /, 'npm.cmd ') : ENGINES[engine].install}</code>
        </div>
      )}
      {st.warning && <p className="hint hint--warn harness__body">{st.warning}</p>}
      {st.route === 'gateway' && picked && <p className="hint harness__body">{L(`Os agentes usam esse mesmo gateway. A telemetria do ${ENGINES[engine].label} fica desligada, pra nada sair por fora dele.`, `Agents use this same gateway. ${ENGINES[engine].label}'s telemetry stays off, so nothing leaves around it.`)}</p>}
      {st.soon && st.installed && <p className="hint harness__body">{L(`Já achei a sua configuração. O Elefante ainda não roda agentes no ${ENGINES[engine].label}: chega numa próxima versão.`, `Found your setup. Elefante doesn't run agents on ${ENGINES[engine].label} yet: it's coming in a future version.`)}</p>}
      {testing && (
        <div className="harness__body">
          <div className="harness__test">
            <ModelPicker value={model} onChange={setModel} engines={[engine]} />
            <button className="btn btn--primary btn--sm" disabled={!modelInfo(model)?.id} onClick={() => void test()}>
              {L('Mandar teste', 'Send a test')}
            </button>
          </div>
          {result && (
            <p className={`note ${result.ok ? 'note--ok' : 'note--error'}`}>
              <Icon name={result.ok ? 'check' : 'x'} size={14} /> {result.ok ? `${L('Funcionando.', 'Working.')} ${result.message}` : result.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// At a gateway: this sends data outside it. Allowed, but said plainly.
export function OutsideGateway({ what }: { what: string }): ReactNode {
  return (
    <p className="hint hint--warn">
      <Icon name="shield" size={13} /> {L('Fora do gateway:', 'Outside the gateway:')} {what} {L('Ligue só se a empresa permitir.', 'Only turn it on if your company allows it.')}
    </p>
  )
}

// ---------- their MCP servers ----------

// The MCP servers already set up in the harnesses. Adding one makes it a
// connector: agents reach it through the gateway, with grants and approvals.
export function HarnessMcps({ onAdded }: { onAdded: (id: string) => void }): ReactNode {
  const connectors = useStore((s) => s.connectors.length)
  const [found, setFound] = useState<HarnessMcp[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  useEffect(() => {
    let live = true
    void harnessMcps().then((f) => live && setFound(f))
    return () => {
      live = false
    }
  }, [connectors])

  async function add(m: HarnessMcp): Promise<void> {
    setBusy(m.key)
    setError(null)
    try {
      onAdded(await importHarnessMcp(m.key))
    } catch (err) {
      setError({ key: m.key, message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy('')
    }
  }

  if (!found?.length) return null
  return (
    <section className="card from-harness">
      <div className="from-harness__head">
        <strong>{L('Nos seus harnesses', 'In your harnesses')}</strong>
        <span className="muted small">{L('Os servidores MCP que você já configurou. Ao adicionar, os agentes passam a usar pelo Elefante, com as permissões e aprovações daqui.', 'The MCP servers you already set up. Once added, agents use them through Elefante, with the permissions and approvals set here.')}</span>
      </div>
      {found.map((m) => (
        <div key={m.key} className="from-harness__row">
          <span className="connector__icon">
            <Icon name={m.kind === 'stdio' ? 'terminal' : 'globe'} />
          </span>
          <span className="grow">
            <strong>{m.name}</strong>
            <span className="muted small mono truncate">{m.address}</span>
            {m.missing && !m.added && <span className="hint hint--warn">{L('Usa cabeçalhos que o Elefante não manda', 'Uses headers Elefante doesn’t send')} ({m.missing.join(', ')}){L(': pode não conectar.', ': it may not connect.')}</span>}
            {error?.key === m.key && <span className="hint hint--warn">{error.message}</span>}
          </span>
          {m.harnesses.map((e) => (
            <span key={e} className="tag">
              {ENGINES[e].label}
            </span>
          ))}
          {m.added ? (
            <span className="tag tag--ok">{L('adicionado', 'added')}</span>
          ) : (
            <button className="btn btn--sm" disabled={busy === m.key} onClick={() => void add(m)}>
              {busy === m.key ? L('Adicionando…', 'Adding…') : L('Adicionar', 'Add')}
            </button>
          )}
        </div>
      ))}
    </section>
  )
}

// ---------- Hermes-style API Providers Hub ----------

interface PresetInfo {
  id: ApiProviderId
  name: string
  badge: string
  descPt: string
  descEn: string
  defaultBaseUrl: string
  needsKey: boolean
  placeholder: string
  docsUrl: string
  defaultModels: string[]
}

const PROVIDER_UI_PRESETS: PresetInfo[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: '300+ Modelos · Recomendado',
    descPt: 'Use DeepSeek R1/V3, Claude 3.7 Sonnet, Gemini 2.5 Pro, GPT-4.1, Qwen e Llama 3.3 com uma única chave.',
    descEn: 'Use DeepSeek R1/V3, Claude 3.7 Sonnet, Gemini 2.5 Pro, GPT-4.1, Qwen and Llama 3.3 with a single key.',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    placeholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
    defaultModels: [
      'deepseek/deepseek-chat-v3-0324',
      'deepseek/deepseek-r1',
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.5-pro-preview',
      'openai/gpt-4.1',
      'qwen/qwen-2.5-coder-32b-instruct'
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API Oficial',
    badge: 'Ultra Econômico',
    descPt: 'Conecte direto na API oficial da DeepSeek (deepseek-chat V3 e deepseek-reasoner R1) com cache automático.',
    descEn: 'Connect straight to the official DeepSeek API (deepseek-chat V3 and deepseek-reasoner R1) with context caching.',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    needsKey: true,
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'ollama',
    name: 'Ollama (IA Local / GPU)',
    badge: '100% Grátis & Offline',
    descPt: 'Rode modelos locais na sua placa de vídeo (Qwen 2.5 Coder, DeepSeek R1, Llama 3.3) sem gastar nada por token.',
    descEn: 'Run local models on your GPU (Qwen 2.5 Coder, DeepSeek R1, Llama 3.3) with zero token cost.',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    needsKey: false,
    placeholder: 'Sem chave necessária (local)',
    docsUrl: 'https://ollama.com',
    defaultModels: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-r1:14b', 'llama3.2:latest']
  },
  {
    id: 'groq',
    name: 'Groq Cloud (LPU)',
    badge: 'Velocidade Extrema',
    descPt: 'Inferência instantânea (>500 tokens/s) para Llama 3.3 70B, DeepSeek R1 Distill e Qwen QwQ.',
    descEn: 'Instant inference (>500 tokens/s) for Llama 3.3 70B, DeepSeek R1 Distill and Qwen QwQ.',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    defaultModels: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b']
  },
  {
    id: 'openai',
    name: 'OpenAI API Direta',
    badge: 'Oficial',
    descPt: 'Use sua chave de API direta da OpenAI Platform (GPT-4.1, GPT-4.1 Mini, o3-mini).',
    descEn: 'Use your direct API key from OpenAI Platform (GPT-4.1, GPT-4.1 Mini, o3-mini).',
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini', 'o3-mini']
  },
  {
    id: 'anthropic',
    name: 'Anthropic API Direta',
    badge: 'Oficial',
    descPt: 'Use sua chave de API direta do Console Anthropic (Claude Sonnet 4, Claude 3.7 Sonnet, Haiku 3.5).',
    descEn: 'Use your direct API key from Anthropic Console (Claude Sonnet 4, Claude 3.7 Sonnet, Haiku 3.5).',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest']
  },
  {
    id: 'custom',
    name: 'Gateway Customizado (LM Studio / vLLM / LiteLLM / xAI)',
    badge: 'OpenAI-Compatible',
    descPt: 'Qualquer servidor compatível com /v1/chat/completions (LM Studio, vLLM, Together AI, Mistral, xAI Grok).',
    descEn: 'Any server compatible with /v1/chat/completions (LM Studio, vLLM, Together AI, Mistral, xAI Grok).',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    needsKey: false,
    placeholder: 'Chave de API (opcional)',
    docsUrl: 'https://lmstudio.ai',
    defaultModels: []
  }
]

export function ApiProvidersHub(): ReactNode {
  const apiProviders = useStore((s) => s.settings.apiProviders)
  return (
    <div className="stack" style={{ gap: 16 }}>
      {PROVIDER_UI_PRESETS.map((preset) => (
        <ApiProviderCard key={preset.id} preset={preset} config={apiProviders?.[preset.id]} />
      ))}
    </div>
  )
}

function ApiProviderCard({ preset, config }: { preset: PresetInfo; config?: ApiProviderConfig }): ReactNode {
  const enabled = config?.enabled ?? false
  const hasKey = config?.hasKey ?? false
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || preset.defaultBaseUrl)
  const [models, setModels] = useState<string[]>(config?.models?.length ? config.models : preset.defaultModels)
  const [apiKey, setApiKey] = useState('')
  const [newModel, setNewModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [testing, setTesting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (config?.baseUrl) setBaseUrl(config.baseUrl)
    if (config?.models?.length) setModels(config.models)
  }, [config?.baseUrl, config?.models])

  const ready = enabled && (!preset.needsKey || hasKey)

  async function save(nextEnabled = enabled, nextModels = models, nextKey?: string | null): Promise<void> {
    setBusy(true)
    setStatusMsg(null)
    try {
      lists.clear()
      await saveApiProvider({
        id: preset.id,
        enabled: nextEnabled,
        baseUrl: baseUrl.trim() || preset.defaultBaseUrl,
        models: nextModels,
        ...(nextKey !== undefined ? { apiKey: nextKey } : apiKey.trim() ? { apiKey: apiKey.trim() } : {})
      })
      if (apiKey.trim()) setApiKey('')
      setStatusMsg({ ok: true, text: L('Configuração salva! Os modelos já estão disponíveis nos agentes.', 'Saved! Models are now available in your agents.') })
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function detectModels(): Promise<void> {
    setFetching(true)
    setStatusMsg(null)
    try {
      const r = await fetchProviderModels({ id: preset.id, baseUrl, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) })
      if (r.error || !r.models.length) {
        setStatusMsg({ ok: false, text: r.error || L('Nenhum modelo retornado pelo endpoint.', 'No models returned by endpoint.') })
      } else {
        const merged = [...new Set([...models, ...r.models.slice(0, 25)])]
        setModels(merged)
        await save(true, merged)
        setStatusMsg({ ok: true, text: L(`${r.models.length} modelos detectados e sincronizados!`, `${r.models.length} models detected and synced!`) })
      }
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setFetching(false)
    }
  }

  async function runQuickTest(): Promise<void> {
    const firstModel = models[0] ?? preset.defaultModels[0]
    if (!firstModel) return
    setTesting(true)
    setStatusMsg(null)
    try {
      if (apiKey.trim() || !enabled) {
        await save(true, models)
      }
      const res = await testEngine(`api:${preset.id}/${firstModel}`)
      setStatusMsg({ ok: res.ok, text: res.message })
    } catch (err) {
      setStatusMsg({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      className={`harness ${ready ? 'is-picked' : ''}`}
      style={{
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div className="harness__head" style={{ padding: 0 }}>
        <button
          className={`harness__check ${enabled ? 'is-on' : ''}`}
          onClick={() => void save(!enabled)}
          title={enabled ? L('Desativar provedor', 'Disable provider') : L('Ativar provedor', 'Enable provider')}
        >
          {enabled && <Icon name="check" size={12} />}
        </button>
        <div className="grow">
          <div className="row row--center" style={{ gap: 8 }}>
            <strong style={{ fontSize: 14.5 }}>{preset.name}</strong>
            <span className="tag">{preset.badge}</span>
            {ready ? (
              <span className="tag tag--ok">{L(`Ativo · ${models.length} modelos`, `Active · ${models.length} models`)}</span>
            ) : enabled && preset.needsKey && !hasKey ? (
              <span className="tag tag--warn">{L('Falta a chave de API', 'Missing API key')}</span>
            ) : null}
          </div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {L(preset.descPt, preset.descEn)}
          </p>
        </div>
        <button className="btn btn--sm btn--ghost" onClick={() => openExternal(preset.docsUrl)}>
          {preset.needsKey ? L('Obter Chave ↗', 'Get Key ↗') : L('Site ↗', 'Website ↗')}
        </button>
      </div>

      <div className="grid2" style={{ gap: 10 }}>
        <div className="field" style={{ margin: 0 }}>
          <span className="field__label">{L('Chave de API (Cofre Criptografado)', 'API Key (Encrypted Vault)')}</span>
          {hasKey && !apiKey ? (
            <div className="row row--center">
              <span className="tag tag--ok">{L('Chave salva no cofre', 'Key saved in vault')}</span>
              <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void save(enabled, models, null)}>
                {L('Trocar / Remover', 'Change / Remove')}
              </button>
            </div>
          ) : (
            <div className="row">
              <input
                className="grow"
                type="password"
                value={apiKey}
                placeholder={preset.placeholder}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {apiKey.trim() && (
                <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => void save(true, models, apiKey.trim())}>
                  {L('Salvar Chave', 'Save Key')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="field" style={{ margin: 0 }}>
          <span className="field__label">{L('Endpoint Base URL (OpenAI-Compatible)', 'Base URL Endpoint')}</span>
          <div className="row">
            <input
              className="grow mono"
              value={baseUrl}
              placeholder={preset.defaultBaseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            {baseUrl.trim() !== (config?.baseUrl || preset.defaultBaseUrl) && (
              <button className="btn btn--sm" disabled={busy} onClick={() => void save(enabled, models)}>
                {L('Salvar URL', 'Save URL')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="field" style={{ margin: 0 }}>
        <div className="row row--between" style={{ marginBottom: 6 }}>
          <span className="field__label" style={{ margin: 0 }}>
            {L('Modelos habilitados neste provedor', 'Models enabled on this provider')}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn--sm btn--ghost" disabled={fetching} onClick={() => void detectModels()}>
              {fetching ? L('Buscando…', 'Fetching…') : L('Detectar modelos na API', 'Detect models from API')}
            </button>
            <button className="btn btn--sm" disabled={testing || (preset.needsKey && !hasKey && !apiKey.trim())} onClick={() => void runQuickTest()}>
              {testing ? L('Testando…', 'Testing…') : L('Testar conexão', 'Test connection')}
            </button>
          </div>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {models.map((m) => (
            <span
              key={m}
              className="tag"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                fontSize: 12
              }}
            >
              <code style={{ fontSize: 11.5 }}>{m}</code>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, opacity: 0.7 }}
                title={L('Remover modelo', 'Remove model')}
                onClick={() => {
                  const next = models.filter((x) => x !== m)
                  setModels(next)
                  void save(enabled, next)
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="row">
          <input
            className="grow mono"
            value={newModel}
            placeholder={L('Adicionar ID de modelo (ex: deepseek/deepseek-r1, qwen2.5-coder:32b)…', 'Add model ID (e.g. deepseek/deepseek-r1, qwen2.5-coder:32b)…')}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newModel.trim()) {
                e.preventDefault()
                const next = [...new Set([...models, newModel.trim()])]
                setModels(next)
                setNewModel('')
                void save(true, next)
              }
            }}
          />
          <button
            className="btn btn--sm"
            disabled={!newModel.trim() || busy}
            onClick={() => {
              const next = [...new Set([...models, newModel.trim()])]
              setModels(next)
              setNewModel('')
              void save(true, next)
            }}
          >
            {L('+ Adicionar Modelo', '+ Add Model')}
          </button>
        </div>
      </div>

      {statusMsg && (
        <p className={`note ${statusMsg.ok ? 'note--ok' : 'note--error'}`} style={{ margin: 0 }}>
          <Icon name={statusMsg.ok ? 'check' : 'x'} size={14} /> {statusMsg.text}
        </p>
      )}
    </div>
  )
}

