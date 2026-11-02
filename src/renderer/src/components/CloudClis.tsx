// Central de CLIs & Contas (Cloud & Dev CLI Hub):
// Shows in real time which infrastructure CLIs are installed and logged in
// (Supabase, Cloudflare, Railway, GitHub, Vercel, Firebase, Fly.io, Stripe, Docker, RTK),
// which account/email is active on each, and lets the user log in or install with 1 click!
import { useEffect, useState, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  installCloudCli,
  loadCloudClis,
  loginCloudCli,
  loginEngine,
  openExternal,
  refreshEngines,
  useStore,
  type CloudCliId,
  type CloudCliInfo,
  type EngineId
} from '../store'
import { Card, Sheet } from './Pages'
import { Icon } from './ui'

const CLI_GROUPS: {
  id: 'cloud' | 'devops' | 'ai'
  titlePt: string
  titleEn: string
  leadPt: string
  leadEn: string
  tools: CloudCliId[]
}[] = [
  {
    id: 'cloud',
    titlePt: 'Provedores de Cloud, Deploy & Bancos de Dados',
    titleEn: 'Cloud Providers, Deploy & Databases',
    leadPt: 'Autenticações de produção utilizadas pelos agentes para deploy e migrações nas pastas.',
    leadEn: 'Production credentials used by agents for deploy and migrations inside project folders.',
    tools: [
      'gh',
      'supabase',
      'cloudflare',
      'railway',
      'vercel',
      'firebase',
      'aws',
      'gcloud',
      'az',
      'netlify',
      'fly',
      'neon',
      'turso',
      'planetscale',
      'stripe'
    ]
  },
  {
    id: 'devops',
    titlePt: 'DevOps, Contêineres & Redes',
    titleEn: 'DevOps, Containers & Networking',
    leadPt: 'Infraestrutura de execução, orquestração e túneis locais de desenvolvimento.',
    leadEn: 'Execution runtime, orchestration and local development tunnels.',
    tools: ['docker', 'kubectl', 'terraform', 'ngrok', 'tailscale', 'npm']
  },
  {
    id: 'ai',
    titlePt: 'Otimização de Tokens & IA Local',
    titleEn: 'Token Optimization & Local AI',
    leadPt: 'Filtros de compressão de saída e modelos de inferência local rodando na máquina.',
    leadEn: 'Output compression proxies and local inference models running on machine.',
    tools: ['rtk', 'ollama', 'hf']
  }
]

const HARNESS_CARDS: { id: EngineId; name: string; descPt: string; descEn: string; mark: string }[] = [
  { id: 'claude', name: 'Claude Code CLI', descPt: 'Agente oficial Anthropic no terminal', descEn: 'Official Anthropic terminal agent', mark: 'CC' },
  { id: 'codex', name: 'OpenAI Codex CLI', descPt: 'Agente oficial OpenAI com plano ChatGPT', descEn: 'Official OpenAI agent with ChatGPT plan', mark: 'CX' },
  { id: 'gemini', name: 'Gemini CLI', descPt: 'Agente oficial Google Gemini no terminal', descEn: 'Official Google Gemini terminal agent', mark: 'GM' },
  { id: 'antigravity', name: 'Antigravity (agy)', descPt: 'Motor Google DeepMind Antigravity CLI', descEn: 'Google DeepMind Antigravity CLI harness', mark: 'AG' },
  { id: 'opencode', name: 'OpenCode CLI', descPt: 'Harness open-source multi-provedor', descEn: 'Open-source multi-provider harness', mark: 'OC' }
]

export function CloudClisPage(): ReactNode {
  const engines = useStore((s) => s.settings.engines)
  const rtkEnabled = useStore((s) => s.settings.rtkEnabled !== false)
  const cavemanMode = useStore((s) => s.settings.cavemanMode ?? 'lite')
  const [clis, setClis] = useState<CloudCliInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'logged' | 'missing'>('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const refreshAll = async (): Promise<void> => {
    setLoading(true)
    refreshEngines()
    try {
      const list = await loadCloudClis()
      setClis(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  const showToast = (msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(null), 4500)
  }

  const handleLogin = async (cli: CloudCliInfo): Promise<void> => {
    const res = await loginCloudCli(cli.id, cli.loginCmd)
    if (res.opened) {
      showToast(L(`Terminal aberto para autenticar ${cli.name} (${cli.loginCmd})`, `Terminal opened to authenticate ${cli.name} (${cli.loginCmd})`))
      setTimeout(() => void refreshAll(), 6000)
    } else {
      await navigator.clipboard.writeText(cli.loginCmd).catch(() => {})
      showToast(L(`Comando copiado: ${cli.loginCmd}`, `Command copied: ${cli.loginCmd}`))
    }
  }

  const handleInstall = async (cli: CloudCliInfo): Promise<void> => {
    const res = await installCloudCli(cli.id, cli.installCmd)
    if (res.opened) {
      showToast(L(`Instalando ${cli.name} no terminal…`, `Installing ${cli.name} in terminal…`))
      setTimeout(() => void refreshAll(), 9000)
    } else {
      await navigator.clipboard.writeText(cli.installCmd).catch(() => {})
      showToast(L(`Comando copiado: ${cli.installCmd}`, `Command copied: ${cli.installCmd}`))
    }
  }

  const copyCmd = async (cmd: string): Promise<void> => {
    await navigator.clipboard.writeText(cmd).catch(() => {})
    showToast(L(`Comando copiado: ${cmd}`, `Command copied: ${cmd}`))
  }

  const loggedCount = clis.filter((c) => c.installed && c.loggedIn).length
  const installedCount = clis.filter((c) => c.installed).length
  const harnessLogged = HARNESS_CARDS.filter((h) => engines[h.id]?.loggedIn).length

  const matchesSearch = (text: string): boolean => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return text.toLowerCase().includes(q)
  }

  const filterCli = (c: CloudCliInfo): boolean => {
    if (filter === 'logged' && (!c.installed || !c.loggedIn)) return false
    if (filter === 'missing' && c.installed && c.loggedIn) return false
    if (search.trim()) {
      const match = matchesSearch(c.name) || matchesSearch(c.description) || matchesSearch(c.account ?? '') || matchesSearch(c.id)
      if (!match) return false
    }
    return true
  }

  return (
    <Sheet
      wide
      title={L('Central de CLIs & Contas Conectadas', 'Cloud CLIs & Connected Accounts')}
      lede={L(
        'Veja instantaneamente quais CLIs estão instaladas e autenticadas na sua máquina. Seus agentes operam com essas credenciais diretamente nas pastas dos projetos.',
        'Instantly see which CLIs are installed and authenticated on your machine. Your agents operate with these credentials directly inside project folders.'
      )}
      actions={
        <button className="btn btn--ghost btn--sm" onClick={() => void refreshAll()} disabled={loading}>
          <Icon name="refresh" size={13} />
          <span>{loading ? L('Verificando…', 'Checking…') : L('Atualizar status', 'Refresh')}</span>
        </button>
      }
    >
      {toast && (
        <div className="cli-toast">
          <Icon name="check" size={14} />
          <span>{toast}</span>
        </div>
      )}

      {/* Unified Minimalist KPI Metric Row */}
      <div className="pv-metrics" style={{ marginBottom: 16 }}>
        <div className="pv-metric">
          <span className="pv-metric__icon" style={{ background: 'rgba(52, 211, 153, 0.12)', color: 'var(--ok)' }}>
            <Icon name="check" size={16} />
          </span>
          <div className="pv-metric__body">
            <span className="pv-metric__label">{L('CLIs Conectadas', 'Logged In CLIs')}</span>
            <strong className="pv-metric__value">
              {loggedCount} <span className="muted small">/ {clis.length || 24}</span>
            </strong>
          </div>
        </div>

        <div className="pv-metric">
          <span className="pv-metric__icon" style={{ background: 'rgba(56, 189, 248, 0.12)', color: 'var(--c-sky)' }}>
            <Icon name="terminal" size={16} />
          </span>
          <div className="pv-metric__body">
            <span className="pv-metric__label">{L('Binários no PATH', 'Binaries on PATH')}</span>
            <strong className="pv-metric__value">
              {installedCount} <span className="muted small">/ {clis.length || 24}</span>
            </strong>
          </div>
        </div>

        <div className="pv-metric">
          <span className="pv-metric__icon" style={{ background: 'rgba(168, 85, 247, 0.12)', color: 'var(--c-violet)' }}>
            <Icon name="cpu" size={16} />
          </span>
          <div className="pv-metric__body">
            <span className="pv-metric__label">{L('Motores de Agentes', 'Agent Harnesses')}</span>
            <strong className="pv-metric__value">
              {harnessLogged} <span className="muted small">/ {HARNESS_CARDS.length}</span>
            </strong>
          </div>
        </div>

        <div className="pv-metric">
          <span className="pv-metric__icon" style={{ background: 'rgba(196, 240, 66, 0.14)', color: 'var(--accent)' }}>
            <Icon name="zap" size={16} />
          </span>
          <div className="pv-metric__body">
            <span className="pv-metric__label">RTK & Caveman</span>
            <strong className="pv-metric__value" style={{ color: 'var(--ok)' }}>
              {rtkEnabled ? 'RTK ON' : 'OFF'} · {cavemanMode.toUpperCase()}
            </strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="tabs-line" style={{ margin: '8px 0 16px' }}>
        <button className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
          {L('Todas as ferramentas', 'All tools')} ({clis.length || 24})
        </button>
        <button className={filter === 'logged' ? 'is-on' : ''} onClick={() => setFilter('logged')}>
          {L('Conectadas', 'Logged in')} ({loggedCount})
        </button>
        <button className={filter === 'missing' ? 'is-on' : ''} onClick={() => setFilter('missing')}>
          {L('Pendentes / Não instaladas', 'Pending / Missing')} ({(clis.length || 24) - loggedCount})
        </button>
        <div className="grow" />
        <div className="tabs-line__find">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('Filtrar ferramenta ou conta…', 'Filter tool or account…')}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && clis.length === 0 && (
          <div className="card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <p className="hint" style={{ justifyContent: 'center', gap: 8, fontSize: '13px' }}>
              <Icon name="refresh" size={15} />
              <span>{L('Identificando ferramentas e contas conectadas na máquina…', 'Detecting tools and connected accounts on machine…')}</span>
            </p>
          </div>
        )}

        {/* Sections for CLIs */}
        {CLI_GROUPS.map((group) => {
          const groupClis = clis.filter((c) => group.tools.includes(c.id)).filter(filterCli)
          if (groupClis.length === 0) return null

          return (
            <Card key={group.id} title={L(group.titlePt, group.titleEn)} lead={L(group.leadPt, group.leadEn)}>
              <div className="cli-list">
                {groupClis.map((cli) => (
                  <div key={cli.id} className="cli-row">
                    <div className="cli-row__meta">
                      <span className="cli-row__badge">
                        {cli.id.slice(0, 3).toUpperCase()}
                      </span>
                      <div className="cli-row__title">
                        <div className="cli-row__head">
                          <strong className="cli-row__name">{cli.name}</strong>
                          {cli.version && <span className="cli-row__ver">v{cli.version}</span>}
                        </div>
                        <span className="cli-row__desc">{cli.description}</span>
                      </div>
                    </div>

                    <div className="cli-row__center">
                      {!cli.installed ? (
                        <>
                          <span className="tag">{L('Não instalado', 'Not installed')}</span>
                          <span className="cli-row__cmd-hint" title={cli.installCmd}>
                            {cli.installCmd}
                          </span>
                        </>
                      ) : cli.loggedIn ? (
                        <>
                          <span className="tag tag--ok">● {L('Conectado', 'Connected')}</span>
                          <span className="cli-row__account" title={cli.account ?? ''}>
                            {cli.account ?? L('Sessão ativa', 'Active session')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="tag tag--warn">{L('Pendente login', 'Pending login')}</span>
                          <span className="cli-row__cmd-hint" title={cli.loginCmd}>
                            {cli.loginCmd}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="cli-row__actions">
                      {!cli.installed ? (
                        <button className="btn btn--sm btn--primary" onClick={() => void handleInstall(cli)}>
                          <Icon name="terminal" size={13} />
                          <span>{L('Instalar', 'Install')}</span>
                        </button>
                      ) : !cli.loggedIn ? (
                        <button className="btn btn--sm btn--primary" onClick={() => void handleLogin(cli)}>
                          <Icon name="terminal" size={13} />
                          <span>{L('Entrar', 'Sign in')}</span>
                        </button>
                      ) : (
                        <button className="btn btn--sm btn--ghost" onClick={() => void handleLogin(cli)} title={L('Reautenticar ou trocar conta', 'Reauthenticate')}>
                          <Icon name="refresh" size={13} />
                          <span>{L('Reautenticar', 'Reauth')}</span>
                        </button>
                      )}

                      <button
                        className="btn btn--sm btn--ghost icon-btn"
                        onClick={() => void copyCmd(cli.loggedIn ? cli.loginCmd : cli.installCmd)}
                        title={L('Copiar comando do terminal', 'Copy command')}
                      >
                        <Icon name="copy" size={13} />
                      </button>

                      {cli.docsUrl && (
                        <button
                          className="btn btn--sm btn--ghost icon-btn"
                          onClick={() => openExternal(cli.docsUrl)}
                          title={L('Abrir documentação', 'Open docs')}
                        >
                          <Icon name="globe" size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}

        {/* Section for Terminal Agent Harnesses */}
        {matchesSearch('harness') || matchesSearch('claude') || matchesSearch('codex') || matchesSearch('gemini') || matchesSearch('antigravity') || matchesSearch('opencode') ? (
          <Card
            title={L('Motores de Agentes no Terminal (Harnesses)', 'AI Agent Terminal Harnesses')}
            lead={L(
              'Os terminais oficiais em que os agentes Elefante rodam diretamente na sua máquina, com o plano e login de cada um.',
              'Official terminal CLI harnesses where Elefante agents run directly on your computer, using your accounts and plans.'
            )}
          >
            <div className="cli-list">
              {HARNESS_CARDS.map((h) => {
                const st = engines[h.id]
                const isLogged = st?.loggedIn ?? false
                const isInstalled = st?.installed ?? false

                return (
                  <div key={h.id} className="cli-row">
                    <div className="cli-row__meta">
                      <span className="cli-row__badge" style={{ color: 'var(--accent)' }}>
                        {h.mark}
                      </span>
                      <div className="cli-row__title">
                        <div className="cli-row__head">
                          <strong className="cli-row__name">{h.name}</strong>
                          {st?.version && <span className="cli-row__ver">v{st.version}</span>}
                        </div>
                        <span className="cli-row__desc">{L(h.descPt, h.descEn)}</span>
                      </div>
                    </div>

                    <div className="cli-row__center">
                      {!isInstalled ? (
                        <span className="tag">{L('Não instalado', 'Not installed')}</span>
                      ) : isLogged ? (
                        <>
                          <span className="tag tag--ok">● {L('Conectado', 'Connected')}</span>
                          <span className="cli-row__account" title={st?.account ?? ''}>
                            {st?.account ?? (st?.route === 'plan' ? L('Plano Ativo', 'Active Plan') : L('Logado', 'Logged In'))}
                          </span>
                        </>
                      ) : (
                        <span className="tag tag--warn">{L('Pendente login', 'Not signed in')}</span>
                      )}
                    </div>

                    <div className="cli-row__actions">
                      {!isLogged ? (
                        <button className="btn btn--sm btn--primary" onClick={() => void loginEngine(h.id)}>
                          <Icon name="terminal" size={13} />
                          <span>{L('Entrar', 'Sign in')}</span>
                        </button>
                      ) : (
                        <button className="btn btn--sm btn--ghost" onClick={() => void loginEngine(h.id)}>
                          <Icon name="refresh" size={13} />
                          <span>{L('Reautenticar', 'Reauth')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}
      </div>
    </Sheet>
  )
}
