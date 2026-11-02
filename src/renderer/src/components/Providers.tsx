import { useEffect, useState, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  fetchProviderModels,
  openExternal,
  saveApiProvider,
  testEngine,
  useStore,
  type ApiProviderConfig,
  type ApiProviderId
} from '../store'
import { clearModelLists } from './Harness'
import { Page, Toggle } from './Pages'
import { Icon } from './ui'

export interface ProviderPreset {
  id: ApiProviderId
  name: string
  shortName: string
  taglinePt: string
  taglineEn: string
  badgePt: string
  badgeEn: string
  descPt: string
  descEn: string
  accent: string
  gradient: string
  defaultBaseUrl: string
  needsKey: boolean
  placeholder: string
  docsUrl: string
  docsLabelPt: string
  docsLabelEn: string
  defaultModels: string[]
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    taglinePt: '300+ modelos em uma única chave',
    taglineEn: '300+ models with a single key',
    badgePt: 'Recomendado · Multi-Model',
    badgeEn: 'Recommended · Multi-Model',
    descPt:
      'Acesse DeepSeek R1 & V3, Claude 3.7 Sonnet, Gemini 2.5 Pro, GPT-4.1, Qwen 2.5 Coder e Llama 3.3 através de um único gateway global com roteamento inteligente e fallback automático.',
    descEn:
      'Access DeepSeek R1 & V3, Claude 3.7 Sonnet, Gemini 2.5 Pro, GPT-4.1, Qwen 2.5 Coder and Llama 3.3 through a single global gateway with smart routing and automatic fallback.',
    accent: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    placeholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
    docsLabelPt: 'Gerar Chave no OpenRouter ↗',
    docsLabelEn: 'Get Key on OpenRouter ↗',
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
    shortName: 'DeepSeek',
    taglinePt: 'DeepSeek V3 & R1 Reasoner direto',
    taglineEn: 'Direct DeepSeek V3 & R1 Reasoner',
    badgePt: 'Ultra Econômico · Cache KV',
    badgeEn: 'Ultra Low Cost · KV Cache',
    descPt:
      'Conecte diretamente na plataforma oficial da DeepSeek com suporte a Context Caching no disco, raciocínio profundo (R1) e execução de ferramentas MCP e Browser com custo de centavos.',
    descEn:
      'Connect directly to the official DeepSeek platform with automatic on-disk Context Caching, deep reasoning (R1) and full MCP & Browser tool execution for pennies.',
    accent: '#3b82f6',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 55%, #06b6d4 100%)',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    needsKey: true,
    placeholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    docsLabelPt: 'Abrir DeepSeek Platform ↗',
    docsLabelEn: 'Open DeepSeek Platform ↗',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'ollama',
    name: 'Ollama · IA Local (GPU)',
    shortName: 'Ollama Local',
    taglinePt: '100% Grátis, Privado & Offline',
    taglineEn: '100% Free, Private & Offline',
    badgePt: 'Local GPU · Custo Zero',
    badgeEn: 'Local GPU · Zero Cost',
    descPt:
      'Rode modelos abertos diretamente na sua placa de vídeo (NVIDIA RTX, AMD ou Apple Silicon) sem enviar nenhum dado para a nuvem e sem gastar nada por token.',
    descEn:
      'Run open-weights models directly on your GPU (NVIDIA RTX, AMD or Apple Silicon) without sending any data to the cloud and with zero token cost.',
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    needsKey: false,
    placeholder: 'Opcional para servidor Ollama local',
    docsUrl: 'https://ollama.com/library',
    docsLabelPt: 'Biblioteca Ollama ↗',
    docsLabelEn: 'Ollama Library ↗',
    defaultModels: ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-r1:14b', 'llama3.2:latest']
  },
  {
    id: 'groq',
    name: 'Groq Cloud (LPU)',
    shortName: 'Groq LPU',
    taglinePt: 'Velocidade extrema (>500 tok/s)',
    taglineEn: 'Extreme speed (>500 tok/s)',
    badgePt: 'Baixa Latência · LPU',
    badgeEn: 'Ultra Low Latency · LPU',
    descPt:
      'Inferência quase instantânea em chips LPU para agentes que precisam reagir em milissegundos no navegador, triagem de canais ou automação de rotinas.',
    descEn:
      'Near-instant inference on LPU hardware for agents that need millisecond reaction times in the browser, channel routing, or routine automation.',
    accent: '#f97316',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 55%, #fbbf24 100%)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    docsLabelPt: 'Console Groq Cloud ↗',
    docsLabelEn: 'Groq Cloud Console ↗',
    defaultModels: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b']
  },
  {
    id: 'openai',
    name: 'OpenAI Platform',
    shortName: 'OpenAI',
    taglinePt: 'GPT-4.1, GPT-4.1 Mini & o3-mini',
    taglineEn: 'GPT-4.1, GPT-4.1 Mini & o3-mini',
    badgePt: 'API Oficial',
    badgeEn: 'Official API',
    descPt:
      'Conecte sua chave direta da OpenAI Platform para usar a família GPT-4.1 e modelos de raciocínio série o sem precisar de CLI externo.',
    descEn:
      'Connect your direct OpenAI Platform key to run the GPT-4.1 family and o-series reasoning models without needing an external CLI.',
    accent: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 55%, #38bdf8 100%)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    placeholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabelPt: 'Chaves OpenAI Platform ↗',
    docsLabelEn: 'OpenAI Platform Keys ↗',
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini', 'o3-mini']
  },
  {
    id: 'anthropic',
    name: 'Anthropic Console',
    shortName: 'Anthropic',
    taglinePt: 'Claude Sonnet 4, 3.7 & Haiku 3.5',
    taglineEn: 'Claude Sonnet 4, 3.7 & Haiku 3.5',
    badgePt: 'API Oficial',
    badgeEn: 'Official API',
    descPt:
      'Use sua chave de API direta do Console Anthropic com suporte nativo à API compatível para agentes especialistas em engenharia de software e escrita.',
    descEn:
      'Use your direct API key from Anthropic Console with native compatibility for agents specialized in software engineering and writing.',
    accent: '#d97706',
    gradient: 'linear-gradient(135deg, #b45309 0%, #d97706 55%, #f59e0b 100%)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    docsLabelPt: 'Anthropic Console ↗',
    docsLabelEn: 'Anthropic Console ↗',
    defaultModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest']
  },
  {
    id: 'custom',
    name: 'Gateway Customizado',
    shortName: 'Custom Gateway',
    taglinePt: 'LM Studio, vLLM, LiteLLM, xAI, Mistral',
    taglineEn: 'LM Studio, vLLM, LiteLLM, xAI, Mistral',
    badgePt: 'OpenAI-Compatible',
    badgeEn: 'OpenAI-Compatible',
    descPt:
      'Conecte qualquer servidor local ou remoto que implemente o padrão /v1/chat/completions (LM Studio na porta 1234, vLLM, LiteLLM, Together AI, Fireworks ou xAI Grok).',
    descEn:
      'Connect any local or remote server implementing the /v1/chat/completions standard (LM Studio on port 1234, vLLM, LiteLLM, Together AI, Fireworks or xAI Grok).',
    accent: '#06b6d4',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 55%, #22d3ee 100%)',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    needsKey: false,
    placeholder: 'Bearer token / API Key (opcional)',
    docsUrl: 'https://lmstudio.ai',
    docsLabelPt: 'Site do LM Studio ↗',
    docsLabelEn: 'LM Studio Website ↗',
    defaultModels: []
  }
]

function ProviderGlyph({ id, size = 20 }: { id: ApiProviderId; size?: number }): ReactNode {
  switch (id) {
    case 'openrouter':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M8.5 11 15.5 7M8.5 13l7 4" />
        </svg>
      )
    case 'deepseek':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c4.97 0 9 3.58 9 8 0 2.8-1.63 5.27-4.1 6.7L18 21l-3.8-1.4c-.72.13-1.45.2-2.2.2-4.97 0-9-3.58-9-8s4.03-8 9-8Z" />
          <path d="m10 9 2 3 2-3M12 12v4" />
        </svg>
      )
    case 'ollama':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="14" height="14" rx="3" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
        </svg>
      )
    case 'groq':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 3 14h8l-1 8 11-12h-8l1-8Z" />
        </svg>
      )
    case 'openai':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2a4.5 4.5 0 0 1 4.3 3.2A4.5 4.5 0 0 1 21 9.5a4.5 4.5 0 0 1-1.7 3.5A4.5 4.5 0 0 1 17.5 19a4.5 4.5 0 0 1-5.5 2.2A4.5 4.5 0 0 1 6.5 19a4.5 4.5 0 0 1-1.8-6A4.5 4.5 0 0 1 7.7 5.2 4.5 4.5 0 0 1 12 2Z" />
        </svg>
      )
    case 'anthropic':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 19 12 5l4.5 14M9 14.5h6" />
          <path d="M16.5 8 20 19" />
        </svg>
      )
    case 'custom':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="6" rx="2" />
          <rect x="3" y="14" width="18" height="6" rx="2" />
          <circle cx="7" cy="7" r="1" fill="currentColor" />
          <circle cx="7" cy="17" r="1" fill="currentColor" />
          <path d="M11 7h6M11 17h6" />
        </svg>
      )
  }
}

export function ProvidersPage(): ReactNode {
  const apiProviders = useStore((s) => s.settings.apiProviders)
  const [selectedId, setSelectedId] = useState<ApiProviderId>('openrouter')

  const selectedPreset = PROVIDER_PRESETS.find((p) => p.id === selectedId) ?? PROVIDER_PRESETS[0]!
  const selectedConfig = apiProviders?.[selectedPreset.id]

  const activeCount = PROVIDER_PRESETS.filter((p) => {
    const c = apiProviders?.[p.id]
    return c?.enabled && (!p.needsKey || c?.hasKey)
  }).length

  const totalModels = PROVIDER_PRESETS.reduce((acc, p) => {
    const c = apiProviders?.[p.id]
    if (!c?.enabled || (p.needsKey && !c?.hasKey)) return acc
    return acc + (c.models?.length ? c.models.length : p.defaultModels.length)
  }, 0)

  return (
    <Page
      title={L('Provedores & APIs', 'Providers & APIs')}
      subtitle={L(
        'Hub nativo estilo Hermes Agent: conecte OpenRouter, DeepSeek, Ollama Local (GPU), Groq, OpenAI ou Anthropic direto no Elefante. Todos os modelos recebem acesso automático ao Navegador, Computador/SSH, Memória e Conectores MCP.',
        'Hermes Agent-style native hub: connect OpenRouter, DeepSeek, Local Ollama (GPU), Groq, OpenAI or Anthropic directly in Elefante. Every model gets automatic access to Browser, Computer/SSH, Memory and MCP Connectors.'
      )}
    >
      <div className="pv-shell">
        {/* Top Metrics Strip */}
        <div className="pv-metrics">
          <div className="pv-metric">
            <span className="pv-metric__icon" style={{ background: 'rgba(16, 185, 129, 0.14)', color: '#34d399' }}>
              <Icon name="cpu" size={16} />
            </span>
            <div className="pv-metric__body">
              <span className="pv-metric__label">{L('Provedores Ativos', 'Active Providers')}</span>
              <strong className="pv-metric__value">
                {activeCount} <span className="muted small">/ {PROVIDER_PRESETS.length}</span>
              </strong>
            </div>
          </div>

          <div className="pv-metric">
            <span className="pv-metric__icon" style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8' }}>
              <Icon name="spark" size={16} />
            </span>
            <div className="pv-metric__body">
              <span className="pv-metric__label">{L('Modelos Disponíveis', 'Available Models')}</span>
              <strong className="pv-metric__value">
                {totalModels} <span className="muted small">{L('prontos', 'ready')}</span>
              </strong>
            </div>
          </div>

          <div className="pv-metric">
            <span className="pv-metric__icon" style={{ background: 'rgba(139, 92, 246, 0.14)', color: '#a78bfa' }}>
              <Icon name="lock" size={16} />
            </span>
            <div className="pv-metric__body">
              <span className="pv-metric__label">{L('Cofre de Chaves', 'Key Vault')}</span>
              <strong className="pv-metric__value">{L('Criptografado', 'Encrypted')}</strong>
            </div>
          </div>

          <div className="pv-metric">
            <span className="pv-metric__icon" style={{ background: 'rgba(245, 158, 11, 0.14)', color: '#fbbf24' }}>
              <Icon name="plug" size={16} />
            </span>
            <div className="pv-metric__body">
              <span className="pv-metric__label">{L('Gateway MCP & Browser', 'MCP & Browser Gateway')}</span>
              <strong className="pv-metric__value">{L('100% Integrado', '100% Integrated')}</strong>
            </div>
          </div>
        </div>

        {/* Master-Detail Studio */}
        <div className="pv-studio">
          {/* Left Rail: Provider Selector */}
          <aside className="pv-rail" aria-label={L('Lista de provedores', 'Provider list')}>
            <div className="pv-rail__head">
              <span>{L('Catálogo de Provedores', 'Provider Catalog')}</span>
            </div>
            <div className="pv-rail__list">
              {PROVIDER_PRESETS.map((p) => {
                const cfg = apiProviders?.[p.id]
                const enabled = cfg?.enabled ?? false
                const hasKey = cfg?.hasKey ?? false
                const ready = enabled && (!p.needsKey || hasKey)
                const needsKeyWarn = enabled && p.needsKey && !hasKey
                const modelCount = cfg?.models?.length ? cfg.models.length : p.defaultModels.length
                const isSelected = p.id === selectedPreset.id

                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pv-item ${isSelected ? 'is-selected' : ''} ${ready ? 'is-ready' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="pv-item__emblem" style={{ background: p.gradient }}>
                      <ProviderGlyph id={p.id} size={19} />
                    </span>
                    <span className="pv-item__info">
                      <span className="pv-item__top">
                        <strong className="pv-item__name">{p.shortName}</strong>
                        <span
                          className={`pv-status-dot ${ready ? 'is-ok' : needsKeyWarn ? 'is-warn' : ''}`}
                          title={
                            ready
                              ? L('Ativo e pronto', 'Active and ready')
                              : needsKeyWarn
                                ? L('Falta chave de API', 'Missing API key')
                                : L('Desativado', 'Disabled')
                          }
                        />
                      </span>
                      <span className="pv-item__sub">{L(p.taglinePt, p.taglineEn)}</span>
                    </span>
                    {ready && <span className="pv-item__count">{modelCount}</span>}
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Right Studio Panel */}
          <div className="pv-detail">
            <ProviderInspector key={selectedPreset.id} preset={selectedPreset} config={selectedConfig} />
          </div>
        </div>
      </div>
    </Page>
  )
}

function ProviderInspector({ preset, config }: { preset: ProviderPreset; config?: ApiProviderConfig }): ReactNode {
  const enabled = config?.enabled ?? false
  const hasKey = config?.hasKey ?? false
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || preset.defaultBaseUrl)
  const [models, setModels] = useState<string[]>(config?.models?.length ? config.models : preset.defaultModels)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [newModel, setNewModel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [testingModel, setTestingModel] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setBaseUrl(config?.baseUrl || preset.defaultBaseUrl)
    setModels(config?.models?.length ? config.models : preset.defaultModels)
    setApiKey('')
    setBanner(null)
  }, [preset.id, config?.baseUrl, config?.models, preset.defaultBaseUrl, preset.defaultModels])

  const ready = enabled && (!preset.needsKey || hasKey)
  const urlChanged = baseUrl.trim() !== (config?.baseUrl || preset.defaultBaseUrl)

  async function persist(nextEnabled = enabled, nextModels = models, nextKey?: string | null, nextUrl = baseUrl): Promise<void> {
    setBusy(true)
    setBanner(null)
    try {
      clearModelLists()
      await saveApiProvider({
        id: preset.id,
        enabled: nextEnabled,
        baseUrl: nextUrl.trim() || preset.defaultBaseUrl,
        models: nextModels,
        ...(nextKey !== undefined ? { apiKey: nextKey } : apiKey.trim() ? { apiKey: apiKey.trim() } : {})
      })
      if (apiKey.trim() || nextKey !== undefined) setApiKey('')
      setBanner({
        ok: true,
        text: L(
          `${preset.shortName} atualizado! Os modelos habilitados já aparecem na escolha de modelo de qualquer agente.`,
          `${preset.shortName} updated! Enabled models now appear in any agent's model picker.`
        )
      })
    } catch (err) {
      setBanner({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function syncFromApi(): Promise<void> {
    setFetching(true)
    setBanner(null)
    try {
      const r = await fetchProviderModels({
        id: preset.id,
        baseUrl: baseUrl.trim() || preset.defaultBaseUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {})
      })
      if (r.error || !r.models.length) {
        setBanner({
          ok: false,
          text: r.error || L('Nenhum modelo retornado pelo endpoint. Verifique se o servidor/chave está ativo.', 'No models returned by endpoint. Check if the server/key is active.')
        })
      } else {
        const merged = [...new Set([...models, ...r.models.slice(0, 30)])]
        setModels(merged)
        await persist(true, merged)
        setBanner({
          ok: true,
          text: L(`${r.models.length} modelos detectados no endpoint e sincronizados com sucesso!`, `${r.models.length} models detected from endpoint and synced!`)
        })
      }
    } catch (err) {
      setBanner({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setFetching(false)
    }
  }

  async function testSingleModel(modelSlug?: string): Promise<void> {
    const target = modelSlug ?? models[0] ?? preset.defaultModels[0]
    if (!target) {
      setBanner({ ok: false, text: L('Adicione pelo menos um modelo para testar.', 'Add at least one model to test.') })
      return
    }
    setTestingModel(target)
    setBanner(null)
    try {
      if (apiKey.trim() || !enabled) {
        await persist(true, models)
      }
      const res = await testEngine(`api:${preset.id}/${target}`)
      setBanner({
        ok: res.ok,
        text: res.ok ? `${L('Conexão verificada', 'Connection verified')} (${target}): ${res.message}` : `${L('Falha ao testar', 'Test failed')} (${target}): ${res.message}`
      })
    } catch (err) {
      setBanner({ ok: false, text: err instanceof Error ? err.message : String(err) })
    } finally {
      setTestingModel(null)
    }
  }

  function addCustomModel(): void {
    const clean = newModel.trim()
    if (!clean) return
    const next = [...new Set([...models, clean])]
    setModels(next)
    setNewModel('')
    void persist(true, next)
  }

  return (
    <div className="pv-inspector">
      {/* Hero Banner Card */}
      <section className="pv-hero" style={{ '--pv-accent': preset.accent } as React.CSSProperties}>
        <div className="pv-hero__glow" style={{ background: preset.gradient }} />
        <div className="pv-hero__main">
          <div className="pv-hero__emblem" style={{ background: preset.gradient }}>
            <ProviderGlyph id={preset.id} size={26} />
          </div>
          <div className="pv-hero__text">
            <div className="pv-hero__title-row">
              <h2>{preset.name}</h2>
              <span className="pv-badge">{L(preset.badgePt, preset.badgeEn)}</span>
              {ready ? (
                <span className="tag tag--ok">{L('Conectado & Ativo', 'Connected & Active')}</span>
              ) : enabled && preset.needsKey && !hasKey ? (
                <span className="tag tag--warn">{L('Aguardando Chave', 'Awaiting Key')}</span>
              ) : (
                <span className="tag">{L('Desativado', 'Disabled')}</span>
              )}
            </div>
            <p className="pv-hero__desc">{L(preset.descPt, preset.descEn)}</p>
          </div>
        </div>

        <div className="pv-hero__bar">
          <label className="pv-switch-wrap" onClick={() => void persist(!enabled)}>
            <Toggle on={enabled} onChange={(v) => void persist(v)} />
            <span>{enabled ? L('Provedor habilitado no Elefante', 'Provider enabled in Elefante') : L('Ativar este provedor', 'Enable this provider')}</span>
          </label>

          <div className="pv-hero__actions">
            <button className="btn btn--sm btn--ghost" onClick={() => openExternal(preset.docsUrl)}>
              {L(preset.docsLabelPt, preset.docsLabelEn)}
            </button>
            <button
              className="btn btn--sm btn--primary"
              disabled={testingModel !== null || (preset.needsKey && !hasKey && !apiKey.trim())}
              onClick={() => void testSingleModel()}
            >
              <Icon name="zap" size={14} />
              {testingModel ? L('Testando…', 'Testing…') : L('Testar Conexão', 'Test Connection')}
            </button>
          </div>
        </div>
      </section>

      {/* Status Alert Banner */}
      {banner && (
        <div className={`pv-alert ${banner.ok ? 'pv-alert--ok' : 'pv-alert--err'}`}>
          <Icon name={banner.ok ? 'check' : 'x'} size={15} />
          <span>{banner.text}</span>
          <button type="button" className="pv-alert__close" onClick={() => setBanner(null)}>
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {/* Credentials & Endpoint Grid */}
      <div className="pv-cards-grid">
        {/* Card 1: API Key Vault */}
        <section className="pv-card">
          <div className="pv-card__head">
            <span className="pv-card__icon">
              <Icon name="key" size={16} />
            </span>
            <div>
              <h3>{L('Chave de API (Cofre do Sistema)', 'API Key (System Vault)')}</h3>
              <p className="muted small">
                {preset.needsKey
                  ? L('Guardada com criptografia do sistema operacional. Nunca aparece em texto puro.', 'Encrypted by your OS keychain. Never exposed in plaintext.')
                  : L('Este provedor roda localmente sem exigir chave, mas você pode informar um token se usar proxy autenticado.', 'Runs locally without requiring a key, though you may set a token if behind an auth proxy.')}
              </p>
            </div>
          </div>

          {hasKey && !apiKey ? (
            <div className="pv-vault-saved">
              <div className="pv-vault-saved__badge">
                <Icon name="lock" size={15} />
                <div>
                  <strong>{L('Chave criptografada ativa no cofre', 'Encrypted key active in vault')}</strong>
                  <span className="muted small">•••••••••••••••</span>
                </div>
              </div>
              <button className="btn btn--sm btn--ghost" disabled={busy} onClick={() => void persist(enabled, models, null)}>
                {L('Trocar / Remover', 'Replace / Remove')}
              </button>
            </div>
          ) : (
            <div className="pv-input-group">
              <div className="pv-input-wrap">
                <input
                  type={showKey ? 'text' : 'password'}
                  className="mono"
                  value={apiKey}
                  placeholder={preset.placeholder}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKey.trim()) {
                      e.preventDefault()
                      void persist(true, models, apiKey.trim())
                    }
                  }}
                />
                <button
                  type="button"
                  className="pv-input-eye"
                  title={showKey ? L('Ocultar', 'Hide') : L('Mostrar', 'Show')}
                  onClick={() => setShowKey((v) => !v)}
                >
                  <Icon name="eye" size={15} />
                </button>
              </div>
              <button
                className="btn btn--primary"
                disabled={busy || !apiKey.trim()}
                onClick={() => void persist(true, models, apiKey.trim())}
              >
                {busy ? L('Salvando…', 'Saving…') : L('Salvar no Cofre', 'Save to Vault')}
              </button>
            </div>
          )}
        </section>

        {/* Card 2: Base URL Endpoint */}
        <section className="pv-card">
          <div className="pv-card__head">
            <span className="pv-card__icon">
              <Icon name="globe" size={16} />
            </span>
            <div>
              <h3>{L('Endpoint da API (Base URL)', 'API Endpoint (Base URL)')}</h3>
              <p className="muted small">
                {L(
                  'Endereço compatível com OpenAI (/v1/chat/completions). Altere se usar proxy, Ollama em outra máquina ou LiteLLM.',
                  'OpenAI-compatible address (/v1/chat/completions). Change if using a proxy, remote Ollama, or LiteLLM.'
                )}
              </p>
            </div>
          </div>

          <div className="pv-input-group">
            <input
              className="mono"
              value={baseUrl}
              placeholder={preset.defaultBaseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            {baseUrl.trim() !== preset.defaultBaseUrl && (
              <button
                className="btn btn--sm btn--ghost"
                disabled={busy}
                onClick={() => {
                  setBaseUrl(preset.defaultBaseUrl)
                  void persist(enabled, models, undefined, preset.defaultBaseUrl)
                }}
              >
                {L('Padrão', 'Reset')}
              </button>
            )}
            {urlChanged && (
              <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => void persist(enabled, models)}>
                {L('Salvar URL', 'Save URL')}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Card 3: Enabled Models Studio */}
      <section className="pv-card">
        <div className="pv-card__head pv-card__head--between">
          <div className="row row--center" style={{ gap: 10 }}>
            <span className="pv-card__icon">
              <Icon name="layers" size={16} />
            </span>
            <div>
              <div className="row row--center" style={{ gap: 8 }}>
                <h3>{L('Catálogo de Modelos do Provedor', 'Provider Model Catalog')}</h3>
                <span className="pv-count-pill">{models.length}</span>
              </div>
              <p className="muted small">
                {L(
                  'Estes modelos ficam disponíveis no seletor de qualquer agente e também para o Router e Memória.',
                  'These models become available in any agent’s model selector as well as Router and Memory.'
                )}
              </p>
            </div>
          </div>

          <div className="pv-card__actions">
            {preset.defaultModels.length > 0 && models.length < preset.defaultModels.length && (
              <button
                className="btn btn--sm btn--ghost"
                disabled={busy}
                onClick={() => {
                  const merged = [...new Set([...models, ...preset.defaultModels])]
                  setModels(merged)
                  void persist(true, merged)
                }}
              >
                {L('Restaurar Padrões', 'Restore Defaults')}
              </button>
            )}
            <button className="btn btn--sm" disabled={fetching} onClick={() => void syncFromApi()}>
              <Icon name="refresh" size={14} />
              {fetching ? L('Sincronizando…', 'Syncing…') : L('Auto-Detectar da API', 'Auto-Detect from API')}
            </button>
          </div>
        </div>

        {models.length === 0 ? (
          <div className="pv-models-empty">
            <p className="muted small">
              {L(
                'Nenhum modelo listado ainda. Clique em "Auto-Detectar da API" ou digite o ID do modelo abaixo.',
                'No models listed yet. Click "Auto-Detect from API" or type a model ID below.'
              )}
            </p>
          </div>
        ) : (
          <div className="pv-models-grid">
            {models.map((m) => {
              const isTestingThis = testingModel === m
              return (
                <div key={m} className="pv-model-chip">
                  <div className="pv-model-chip__info">
                    <code className="pv-model-chip__id">{m}</code>
                    <span className="pv-model-chip__route">api:{preset.id}/{m}</span>
                  </div>
                  <div className="pv-model-chip__btns">
                    <button
                      type="button"
                      className="pv-model-chip__btn"
                      title={L('Testar este modelo agora', 'Test this model now')}
                      disabled={testingModel !== null}
                      onClick={() => void testSingleModel(m)}
                    >
                      {isTestingThis ? '…' : <Icon name="zap" size={12} />}
                    </button>
                    <button
                      type="button"
                      className="pv-model-chip__btn pv-model-chip__btn--del"
                      title={L('Remover modelo da lista', 'Remove model from list')}
                      onClick={() => {
                        const next = models.filter((x) => x !== m)
                        setModels(next)
                        void persist(enabled, next)
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pv-add-model">
          <input
            className="mono"
            value={newModel}
            placeholder={L(
              'Adicionar ID de modelo (ex: deepseek/deepseek-r1, anthropic/claude-3.7-sonnet, qwen2.5-coder:32b)…',
              'Add model ID (e.g. deepseek/deepseek-r1, anthropic/claude-3.7-sonnet, qwen2.5-coder:32b)…'
            )}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newModel.trim()) {
                e.preventDefault()
                addCustomModel()
              }
            }}
          />
          <button className="btn btn--primary" disabled={!newModel.trim() || busy} onClick={addCustomModel}>
            <Icon name="plus" size={15} />
            {L('Adicionar Modelo', 'Add Model')}
          </button>
        </div>
      </section>
    </div>
  )
}
