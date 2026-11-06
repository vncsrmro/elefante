import { ProviderMark } from './ProviderMark'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { navigate, toggleRightPanel, updateSettings, useStore, type State } from '../store'
import { call } from '../rpc'
import { Icon } from './ui'
import type { CloudCliInfo, HostDiscoveryResult, UsageReport } from '../../../shared/types'

export function StatusBar(): ReactNode {
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const pendingApprovals = useStore((s) => s.approvals.filter((a) => a.state === 'pending').length)
  const routinesCount = useStore((s) => s.routines.filter((r) => r.enabled).length)
  const engines = useStore((s) => s.settings.engines)
  const rtkEnabled = useStore((s) => s.settings.rtkEnabled !== false)
  const apiProviders = useStore((s) => s.settings.apiProviders)
  const quota = useStore((s) => s.settings.quota)
  const receiptCount = useStore((s) => s.messages.reduce((n, m) => n + (m.run?.receipt ? 1 : 0), 0))
  const hasDeepSeek = !!(apiProviders?.deepseek?.hasKey || apiProviders?.deepseek?.enabled)
  const [clis, setClis] = useState<CloudCliInfo[]>([])
  const [usageData, setUsageData] = useState<UsageReport | null>(null)
  const [hostsData, setHostsData] = useState<HostDiscoveryResult | null>(null)
  const [hostsOpen, setHostsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [codexQuota, setCodexQuota] = useState<Awaited<ReturnType<typeof getCodexQuota>>>(null)
  const [refreshingHosts, setRefreshingHosts] = useState(false)
  const hostsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = (): void => { void getCodexQuota().then((q) => { if (!cancelled) setCodexQuota(q) }).catch(() => { if (!cancelled) setCodexQuota(null) }) }
    refresh()
    const timer = setInterval(refresh, 300000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [receiptCount])

  // Fetch active CLIs count, usage summary, and dynamic host discovery
  useEffect(() => {
    let cancel = false
    void call('cloudClis').then((res) => {
      if (!cancel && Array.isArray(res)) setClis(res)
    })
    void call('usage').then((res) => {
      if (!cancel && res) setUsageData(res)
    })
    void call('hosts').then((res) => {
      if (!cancel && res) setHostsData(res)
    })
    return () => {
      cancel = true
    }
  }, [receiptCount])

  // Close hosts popover on click outside
  useEffect(() => {
    if (!hostsOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (hostsRef.current && !hostsRef.current.contains(e.target as Node)) {
        setHostsOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [hostsOpen])

  const refreshHosts = async (): Promise<void> => {
    setRefreshingHosts(true)
    try {
      const res = await call('hosts')
      if (res) setHostsData(res)
    } finally {
      setRefreshingHosts(false)
    }
  }

  const loggedInClis = clis.filter((c) => c.loggedIn).length
  const totalClis = clis.length || 24

  // Calculate total tokens used today or from report
  const totalTokens = usageData?.total ?? 0
  const totalCostUsd = usageData?.apiUsd ?? 0

  const formatTokens = (tokens: number): string => {
    if (tokens < 1000) return `${tokens}`
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`
    return `${(tokens / 1000000).toFixed(2)}M`
  }

  const resetIn = (at: number): string => {
    const minutes = Math.max(0, Math.round((at - Date.now()) / 60000))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days) return `${days}d ${hours % 24}h`
    return `${hours}h ${minutes % 60}m`
  }

  // Active harnesses
  const activeEngines = Object.entries(engines)
    .filter(([_, conf]) => conf?.loggedIn)
    .map(([id]) => id.charAt(0).toUpperCase() + id.slice(1))

  return (
    <footer className="status-bar">
      {/* Left items */}
      <div className="status-bar__section status-bar__section--left">
        {/* Token Usage Badge */}
        <button
          className="status-bar__item status-bar__item--clickable"
          onClick={() => setUsageOpen((v) => !v)}
          aria-expanded={usageOpen}
          title={L('Abrir resumo de uso', 'Open usage summary')}
        >
          <span className="status-bar__dot status-bar__dot--green" />
          <span className="status-bar__usage">
            <span className="status-bar__label">{L('Uso', 'Usage')}</span>
            <strong>{formatTokens(totalTokens)} {L('tokens no mês', 'tokens this month')}</strong>
          </span>
          {codexQuota?.primary && <span className="status-bar__quota">Codex {Math.round(Math.max(0, 100 - codexQuota.primary.usedPercent))}% {L('restante', 'remaining')}</span>}
          {quota?.fiveHour && <span className="status-bar__quota">Claude 5h {Math.round((1 - quota.fiveHour.utilization) * 100)}% {resetIn(quota.fiveHour.resetsAt)}</span>}
          {quota?.sevenDay && <span className="status-bar__quota">Claude 7d {Math.round((1 - quota.sevenDay.utilization) * 100)}% {resetIn(quota.sevenDay.resetsAt)}</span>}
          {totalCostUsd > 0 && <span className="muted small">(${totalCostUsd.toFixed(2)})</span>}
        </button>

        {usageOpen && (
          <div className="status-usage-popover" role="dialog" aria-label={L('Resumo de uso', 'Usage summary')}>
            <div className="status-usage-popover__head"><strong>{L('Uso', 'Usage')}</strong><button onClick={() => setUsageOpen(false)} aria-label={L('Fechar', 'Close')}>×</button></div>
            <p>{L('Consumo registrado no mês', 'Recorded usage this month')}</p>
            <div>{formatTokens(totalTokens)} tokens · {usageData?.replies ?? 0} {L('respostas', 'replies')}</div>
            <p className="provider-heading"><ProviderMark model="codex" size={24} />Codex <span className="provider-subtitle">OpenAI</span></p>
            {[codexQuota?.primary, codexQuota?.secondary].map((window, index) => window && <div className="quota-window" key={index}>
              <div className="quota-window__label"><span>{window.windowDurationMins ? window.windowDurationMins >= 1440 ? `${window.windowDurationMins / 1440} ${L('dias', 'days')}` : `${window.windowDurationMins / 60}h` : L('Janela de uso', 'Usage window')}</span><strong>{Math.round(Math.max(0, 100 - window.usedPercent))}% {L('restante', 'remaining')}</strong></div>
              <meter min={0} max={100} value={Math.max(0, 100 - window.usedPercent)} aria-label={L('Quota restante', 'Remaining quota')} />
            </div>)}
            <div className="muted">{codexQuota?.primary ? `${codexQuota.primary.usedPercent}% ${L('usado', 'used')}${codexQuota.primary.resetsAt ? ` · ${resetIn(codexQuota.primary.resetsAt * 1000)}` : ''}` : L('Quota indisponível.', 'Quota unavailable.')}</div>
            {codexQuota?.secondary && <div className="muted">{codexQuota.secondary.usedPercent}% {L('usado', 'used')}{codexQuota.secondary.resetsAt ? ` · ${resetIn(codexQuota.secondary.resetsAt * 1000)}` : ''}</div>}
            <p className="provider-heading"><ProviderMark model="claude" size={24} />Claude <span className="provider-subtitle">Anthropic</span></p>
            <div className="muted">{quota?.fiveHour ? `${Math.round(quota.fiveHour.utilization * 100)}% ${L('usado', 'used')} · ${resetIn(quota.fiveHour.resetsAt)}` : L('Quota ainda não informada.', 'No quota reported yet.')}</div>
            <button className="status-usage-popover__link" onClick={() => { setUsageOpen(false); navigate({ kind: 'usage' }) }}>{L('Detalhes e histórico de uso →', 'Usage details and history →')}</button>
          </div>
        )}

        <span className="status-bar__divider" />

        {/* DeepSeek Status */}
        {hasDeepSeek ? (
          <div
            className="status-bar__item status-bar__item--highlight"
            title={L('DeepSeek R1/V3 conectado no ecossistema', 'DeepSeek R1/V3 connected')}
          >
            <span className="status-bar__icon">⚡</span>
            <span>DeepSeek: <strong>{L('Conectado', 'Connected')}</strong></span>
          </div>
        ) : (
          <button
            className="status-bar__item status-bar__item--clickable"
            onClick={() => navigate({ kind: 'providers' })}
            title={L('DeepSeek não configurado. Clique para configurar chave de API ou endpoint local em Provedores', 'DeepSeek not configured. Click to configure in Providers')}
          >
            <span className="status-bar__icon">⚡</span>
            <span>DeepSeek: <span className="muted">{L('configurar', 'configure')}</span></span>
          </button>
        )}

        <span className="status-bar__divider" />

        {/* RTK Token Killer Indicator */}
        <button
          className="status-bar__item status-bar__item--clickable"
          onClick={() => updateSettings({ rtkEnabled: !rtkEnabled })}
          title={L(
            rtkEnabled
              ? 'RTK (Rust Token Killer) ativo: comprimindo ruído em saídas de terminal e economizando tokens. Clique para desativar'
              : 'RTK desativado. Clique para ativar',
            rtkEnabled ? 'RTK active: compressing terminal outputs. Click to disable' : 'RTK disabled. Click to enable'
          )}
        >
          <Icon name="terminal" size={11} />
          <span>RTK: <strong>{rtkEnabled ? L('Ativo', 'Active') : L('Desativado', 'Disabled')}</strong></span>
        </button>

        <span className="status-bar__divider" />

        {/* Cloud CLIs Status */}
        <button
          className="status-bar__item status-bar__item--clickable"
          onClick={() => navigate({ kind: 'clis' })}
          title={L('Ver Central de CLIs & Contas na Nuvem', 'View Cloud CLIs & Accounts Hub')}
        >
          <span className="status-bar__icon">🌐</span>
          <span>
            {loggedInClis > 0 ? (
              <strong>{loggedInClis}/{totalClis} CLIs</strong>
            ) : (
              <span>{totalClis} CLIs</span>
            )}
          </span>
        </button>

        <span className="status-bar__divider" />

        {/* Active Harnesses summary */}
        {activeEngines.length > 0 && (
          <div
            className="status-bar__item status-bar__item--engines"
            title={L(`Modelos ativos: ${activeEngines.join(', ')}`, `Active harnesses: ${activeEngines.join(', ')}`)}
          >
            <Icon name="spark" size={11} />
            <span>{activeEngines.slice(0, 3).join(' · ')}{activeEngines.length > 3 ? '…' : ''}</span>
          </div>
        )}

        {/* Routines count */}
        {routinesCount > 0 && (
          <>
            <span className="status-bar__divider" />
            <button
              className="status-bar__item status-bar__item--clickable"
              onClick={() => navigate({ kind: 'routines' })}
              title={L(`${routinesCount} rotinas automáticas ativas`, `${routinesCount} active routines`)}
            >
              <Icon name="clock" size={11} />
              <span>{routinesCount} {L('rotinas', 'routines')}</span>
            </button>
          </>
        )}
      </div>

      {/* Right items */}
      <div className="status-bar__section status-bar__section--right">
        {/* Pending approvals badge */}
        {pendingApprovals > 0 && (
          <button
            className="status-bar__item status-bar__item--warn"
            onClick={() => navigate({ kind: 'approvals' })}
            title={L(`${pendingApprovals} aprovação(ões) pendente(s)`, `${pendingApprovals} pending approval(s)`)}
          >
            <Icon name="shield" size={11} />
            <span><strong>{pendingApprovals} {L('pendente', 'pending')}</strong></span>
          </button>
        )}

        {/* Dynamic Host Info & Popover */}
        {(() => {
          const connectedHosts = hostsData?.hosts.filter((h) => h.connected) ?? []
          const connectedCount = hostsData?.connected ?? 1
          const connectedNames = connectedHosts.map((h) => (h.kind === 'local' ? 'local' : h.name))
          const hostLabel =
            connectedCount > 1
              ? `${connectedCount} hosts (${connectedNames.join(', ')})`
              : connectedHosts[0]?.machineName
                ? `1 host local (${connectedHosts[0].machineName})`
                : '1 host local'

          return (
            <div className="status-bar__host-wrapper" ref={hostsRef}>
              <button
                className={`status-bar__item status-bar__item--clickable status-bar__item--host ${hostsOpen ? 'is-active' : ''}`}
                onClick={() => setHostsOpen((v) => !v)}
                title={L(
                  `${connectedCount} host(s) ativo(s): ${connectedNames.join(', ')}. Clique para gerenciar hosts e conexões`,
                  `${connectedCount} active host(s): ${connectedNames.join(', ')}. Click to manage hosts`
                )}
              >
                <span className="status-bar__dot status-bar__dot--green" />
                <span>{hostLabel}</span>
              </button>

              {hostsOpen && (
                <div className="hosts-popover">
                  <div className="hosts-popover__header">
                    <div className="hosts-popover__title">
                      <Icon name="terminal" size={13} />
                      <strong>{L('Hosts & Ambientes', 'Hosts & Environments')}</strong>
                    </div>
                    <button
                      className={`icon-btn icon-btn--xs ${refreshingHosts ? 'spin' : ''}`}
                      onClick={() => void refreshHosts()}
                      title={L('Atualizar lista de hosts', 'Refresh hosts')}
                      disabled={refreshingHosts}
                    >
                      <Icon name="refresh" size={11} />
                    </button>
                  </div>

                  <div className="hosts-popover__list">
                    {(hostsData?.hosts ?? []).map((h) => (
                      <div key={h.id} className={`hosts-popover__item ${h.connected ? 'is-connected' : 'is-offline'}`}>
                        <span className={`status-bar__dot ${h.connected ? 'status-bar__dot--green' : 'status-bar__dot--gray'}`} />
                        <div className="hosts-popover__info">
                          <div className="hosts-popover__item-name">
                            <strong>{h.name === 'this machine' ? (h.machineName || 'Local') : h.name}</strong>
                            <span className="tag tag--xs">{h.kind.toUpperCase()}</span>
                          </div>
                          <span className="small muted">
                            {h.detail || (h.connected ? L('Conectado', 'Connected') : L('Desconectado', 'Disconnected'))}
                          </span>
                        </div>
                        <span className={`hosts-popover__status-badge ${h.connected ? 'badge--ok' : 'badge--muted'}`}>
                          {h.connected ? L('Ativo', 'Active') : L('Offline', 'Offline')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="hosts-popover__footer">
                    <span className="small muted">
                      {L(
                        `${connectedCount} de ${hostsData?.total ?? 1} host(s) pronto(s) para execução`,
                        `${connectedCount} of ${hostsData?.total ?? 1} host(s) ready`
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Toggle Right Panel (Files & Code Editor) */}
        <button
          className={`status-bar__btn ${rightPanelOpen ? 'is-active' : ''}`}
          onClick={toggleRightPanel}
          title={L('Alternar Painel de Arquivos e Editor de Código (Ctrl+B)', 'Toggle Files & Code Editor Panel (Ctrl+B)')}
        >
          <Icon name="sidebarRight" size={12} />
          <span>{L('Arquivos & Editor', 'Files & Editor')}</span>
        </button>
      </div>
    </footer>
  )
}

function getCodexQuota() { return call('codexQuota') }
