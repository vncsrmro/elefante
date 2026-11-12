import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { L } from '../../../shared/lang'
import {
  EFFORTS,
  getState,
  MODELS,
  modelById,
  modelInfo,
  navigate,
  openDm,
  patchAgent,
  useStore,
  type Effort,
  type MemoryMode
} from '../store'
import { AgentAvatar, Icon, tokens } from './ui'
import { ProviderMark } from './ProviderMark'
import { ModelPicker } from './Harness'

export interface AgentQuickMenuProps {
  agentId: string
  anchorRect?: DOMRect
  clientPos?: { x: number; y: number }
  onClose: () => void
}

interface QuickModelOption {
  id: string
  label: string
  engine: string
  hint: string
}

const DEFAULT_QUICK_MODELS: QuickModelOption[] = [
  { id: 'sonnet', label: 'Claude Sonnet', engine: 'claude', hint: 'Equilibrado · Rápido' },
  { id: 'opus', label: 'Claude Opus', engine: 'claude', hint: 'Tarefas complexas' },
  { id: 'haiku', label: 'Claude Haiku', engine: 'claude', hint: 'Econômico · Ágil' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', engine: 'codex', hint: 'Raciocínio geral' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', engine: 'codex', hint: 'Problemas difíceis' },
  { id: 'gemini-4-argon-high', label: 'Gemini 4 Argon', engine: 'antigravity', hint: 'Mais capaz' },
  { id: 'gemini-3.8-flash-low', label: 'Gemini Flash', engine: 'antigravity', hint: 'Instantâneo (2s)' }
]

const FRIENDLY_MODEL_SLUGS: Record<string, { label: string; hint: string }> = {
  'deepseek-chat': { label: 'DeepSeek V3', hint: 'DeepSeek · Geral' },
  'deepseek-reasoner': { label: 'DeepSeek R1', hint: 'DeepSeek · Raciocínio' },
  'claude-3.7-sonnet': { label: 'Claude 3.7 Sonnet', hint: 'Anthropic' },
  'claude-3-7-sonnet-20250219': { label: 'Claude 3.7 Sonnet', hint: 'Anthropic' },
  'claude-3-5-sonnet-latest': { label: 'Claude 3.5 Sonnet', hint: 'Anthropic' },
  'claude-3-5-haiku-latest': { label: 'Claude 3.5 Haiku', hint: 'Anthropic' },
  'gemini-2.5-pro': { label: 'Gemini 2.5 Pro', hint: 'Google Gemini' },
  'gemini-2.5-flash': { label: 'Gemini 2.5 Flash', hint: 'Google Gemini' },
  'gemini-3.8-flash-low': { label: 'Gemini Flash', hint: 'Instantâneo (2s)' },
  'gemini-3.8-flash-medium': { label: 'Gemini Flash (Med)', hint: 'Equilibrado e ágil' },
  'gemini-3.8-flash-high': { label: 'Gemini Flash (High)', hint: 'Raciocínio profundo' },
  'gemini-4-argon-high': { label: 'Gemini 4 Argon', hint: 'Mais novo e capaz' },
  'gemini-4-argon-medium': { label: 'Gemini 4 Argon (Med)', hint: 'Equilibrado e rápido' },
  'claude-opus-5-5-high': { label: 'Claude Opus 5.5', hint: 'Raciocínio complexo' },
  'gpt-4.1': { label: 'GPT-4.1', hint: 'OpenAI' },
  'gpt-4.1-mini': { label: 'GPT-4.1 Mini', hint: 'OpenAI' },
  'gpt-4o': { label: 'GPT-4o', hint: 'OpenAI' },
  'gpt-4o-mini': { label: 'GPT-4o Mini', hint: 'OpenAI' },
  'o3-mini': { label: 'o3-mini', hint: 'OpenAI · Raciocínio' },
  'llama-3.3-70b-versatile': { label: 'Llama 3.3 70B', hint: 'Meta Llama' },
  'qwen-2.5-coder-32b': { label: 'Qwen 2.5 Coder', hint: 'Alibaba Qwen' }
}

function normalizeModelKey(id: string): string {
  return id
    .replace(/^(api|claude|codex|opencode|pi|gemini|antigravity):/i, '')
    .trim()
    .toLowerCase()
}

export function isSameModelId(a: string, b: string): boolean {
  if (a === b) return true
  return normalizeModelKey(a) === normalizeModelKey(b)
}

export function formatAgentModel(modelId: string): { label: string; shortLabel: string; hint: string; engine: string } {
  const info = modelById(getState(), modelId) ?? modelInfo(modelId)
  const rawSlug = modelId.replace(/^(api|claude|codex|opencode|pi|gemini|antigravity):/i, '').trim()
  const baseSlug = (rawSlug.split('/').pop() ?? rawSlug).replace(/:latest$/i, '')

  const friendly = FRIENDLY_MODEL_SLUGS[baseSlug.toLowerCase()] ?? FRIENDLY_MODEL_SLUGS[rawSlug.toLowerCase()]
  const listed = MODELS.find((m) => m.id === rawSlug || m.id === modelId)

  if (listed) {
    return {
      label: listed.label,
      shortLabel: friendly?.label ?? listed.label,
      hint: listed.hint,
      engine: listed.engine
    }
  }

  if (friendly) {
    return {
      label: friendly.label,
      shortLabel: friendly.label,
      hint: friendly.hint,
      engine: info?.engine ?? 'api'
    }
  }

  if (info && info.hint && info.hint !== 'Nome próprio' && info.hint !== 'Custom name') {
    return {
      label: info.label,
      shortLabel: info.label,
      hint: info.hint,
      engine: info.engine
    }
  }

  const providerPart = rawSlug.includes('/') ? rawSlug.split('/')[0]! : info?.engine ?? 'IA'
  const providerLabel = providerPart.charAt(0).toUpperCase() + providerPart.slice(1)
  return {
    label: baseSlug,
    shortLabel: baseSlug,
    hint: `${providerLabel} · ${L('Modelo ativo', 'Active model')}`,
    engine: info?.engine ?? 'api'
  }
}

export function AgentQuickMenu({ agentId, anchorRect, clientPos, onClose }: AgentQuickMenuProps): ReactNode {
  const cardRef = useRef<HTMLDivElement>(null)
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId))
  const settings = useStore((s) => s.settings)
  const currentConv = useStore((s) => {
    const v = s.view
    return v && v.kind === 'conversation' ? s.conversations.find((c) => c.id === v.id) : undefined
  })
  const isCurrentDm = currentConv?.kind === 'dm' && currentConv.name === agentId

  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>(() => {
    const width = 364
    const estimatedHeight = 490
    let top = 20
    let left = 20

    if (clientPos) {
      left = clientPos.x + 6
      top = clientPos.y + 6
    } else if (anchorRect) {
      if (anchorRect.top < 120) {
        top = anchorRect.bottom + 8
        left = anchorRect.left
      } else {
        left = anchorRect.right + 12
        top = anchorRect.top - 16
      }
    }

    if (typeof window !== 'undefined') {
      if (left + width > window.innerWidth - 16) {
        if (anchorRect && anchorRect.left > width + 20) {
          left = anchorRect.left - width - 12
        } else {
          left = Math.max(16, window.innerWidth - width - 16)
        }
      }
      if (left < 16) left = 16
      if (top + estimatedHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - estimatedHeight - 16)
      }
      if (top < 16) top = 16
    }
    return { top, left }
  })

  // Dynamically clamp position after layout measurement
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    let { top, left } = coords
    if (left + rect.width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - rect.width - 12)
    }
    if (top + rect.height > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - rect.height - 12)
    }
    if (top !== coords.top || left !== coords.left) {
      setCoords({ top, left })
    }
  }, [showFullPicker, feedback, coords])

  // Handle outside click and escape key
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  if (!agent) return null

  // Copy handle
  const handleCopyHandle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    void navigator.clipboard.writeText(`@${agent.handle}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Model switch
  const handleSelectModel = (modelId: string): void => {
    if (isSameModelId(modelId, agent.modelId)) return
    patchAgent(agent.id, { modelId })
    const formatted = formatAgentModel(modelId)
    setFeedback(L(`Modelo trocado para ${formatted.shortLabel}!`, `Model switched to ${formatted.shortLabel}!`))
    setTimeout(() => setFeedback(null), 2500)
  }

  // Effort switch
  const handleSelectEffort = (effort: Effort): void => {
    if (effort === agent.effort) return
    patchAgent(agent.id, { effort })
    const efLabel = EFFORTS.find((e) => e.id === effort)?.label ?? effort
    setFeedback(L(`Raciocínio: ${efLabel}`, `Reasoning: ${efLabel}`))
    setTimeout(() => setFeedback(null), 2000)
  }

  // Web search toggle
  const handleToggleWeb = (): void => {
    const next = agent.web === false
    patchAgent(agent.id, { web: next })
    setFeedback(next ? L('Pesquisa Web ativada', 'Web search enabled') : L('Pesquisa Web desativada', 'Web search disabled'))
    setTimeout(() => setFeedback(null), 2000)
  }

  // Memory mode switch
  const handleCycleMemory = (): void => {
    const modes: MemoryMode[] = ['auto', 'approve', 'read']
    const next = modes[(modes.indexOf(agent.memory) + 1) % modes.length]!
    patchAgent(agent.id, { memory: next })
    const memLabel = next === 'auto' ? L('Automática', 'Automatic') : next === 'approve' ? L('Com aprovação', 'With approval') : L('Apenas leitura', 'Read-only')
    setFeedback(L(`Memória: ${memLabel}`, `Memory: ${memLabel}`))
    setTimeout(() => setFeedback(null), 2000)
  }

  // Navigate actions
  const handleOpenFullProfile = (): void => {
    navigate({ kind: 'agent', id: agent.id })
    onClose()
  }

  const handleOpenDm = (): void => {
    void openDm(agent.id)
    onClose()
  }

  const handleOpenProviders = (): void => {
    navigate({ kind: 'providers' })
    onClose()
  }

  // Collect configured quick models without duplicates
  const quickModels: QuickModelOption[] = [...DEFAULT_QUICK_MODELS]
  if (settings.apiProviders) {
    for (const [providerId, cfg] of Object.entries(settings.apiProviders)) {
      if (cfg?.enabled && cfg.models?.length) {
        for (const m of cfg.models.slice(0, 2)) {
          const fullId = `api:${providerId}/${m}`
          if (quickModels.some((qm) => isSameModelId(qm.id, fullId))) continue
          const formatted = formatAgentModel(fullId)
          quickModels.push({
            id: fullId,
            label: formatted.shortLabel,
            engine: 'api',
            hint: formatted.hint
          })
        }
      }
    }
  }

  // Ensure current model is present in quick list if not already
  const currentFormatted = formatAgentModel(agent.modelId)
  const hasCurrentInQuick = quickModels.some((m) => isSameModelId(m.id, agent.modelId))
  if (!hasCurrentInQuick) {
    quickModels.unshift({
      id: agent.modelId,
      label: currentFormatted.shortLabel,
      engine: currentFormatted.engine,
      hint: currentFormatted.hint
    })
  }

  // Progress of monthly limit
  const limitPct = agent.limit > 0 ? Math.min(100, Math.round((agent.used / agent.limit) * 100)) : 0

  return createPortal(
    <div
      ref={cardRef}
      className={`agent-quick-card c-${agent.color}`}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999
      }}
      role="dialog"
      aria-label={L(`Administração de @${agent.handle}`, `Manage @${agent.handle}`)}
    >
      {/* Discord-style Banner */}
      <div className="agent-quick-card__banner">
        <button
          type="button"
          className="agent-quick-card__close-btn"
          onClick={onClose}
          title={L('Fechar (Esc)', 'Close (Esc)')}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Overlapping Avatar & Header Identity */}
      <div className="agent-quick-card__profile">
        <div className="agent-quick-card__top-row">
          <div className="agent-quick-card__avatar-wrap">
            <AgentAvatar agent={agent} size={50} />
            <span
              className="agent-quick-card__status-dot"
              title={L('Agente ativo e pronto para responder', 'Agent active and ready to reply')}
            />
          </div>

          <div className="agent-quick-card__identity">
            <div className="agent-quick-card__name-row">
              <h2 className="agent-quick-card__name">{agent.name}</h2>
              {agent.kind === 'tuca' && <span className="agent-quick-card__tag agent-quick-card__tag--fante">Fante</span>}
            </div>

            <div className="agent-quick-card__handle-row">
              <button
                type="button"
                className="agent-quick-card__handle-btn"
                onClick={handleCopyHandle}
                title={L('Clique para copiar @handle', 'Click to copy @handle')}
              >
                <span>@{agent.handle}</span>
                <Icon name="copy" size={11} />
                {copied && <span className="agent-quick-card__copied-badge">{L('Copiado!', 'Copied!')}</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="agent-quick-card__badges">
          {agent.role && <span className="agent-quick-card__role-badge">{agent.role}</span>}
          {agent.department && (
            <span className="agent-quick-card__dept-badge">
              {agent.department}
              {agent.responsible ? ` · ${agent.responsible}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Visual Instant Feedback Banner */}
      {feedback && (
        <div className="agent-quick-card__feedback" role="alert">
          <Icon name="check" size={13} />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="agent-quick-card__content">
        {/* Quick Model Switcher - THE CORE FEATURE */}
        <div className="agent-quick-card__section">
          <div className="agent-quick-card__section-head">
            <div className="agent-quick-card__section-title">
              <Icon name="spark" size={12} />
              <span>{L('Troca Rápida de Modelo', 'Quick Model Switch')}</span>
            </div>
            <button
              type="button"
              className="agent-quick-card__link-btn"
              onClick={() => setShowFullPicker(!showFullPicker)}
              title={L('Mostrar seletor completo de modelos e provedores', 'Show complete model and provider picker')}
            >
              {showFullPicker ? L('Recolher', 'Collapse') : L('Mais modelos…', 'More models…')}
            </button>
          </div>

          {/* Current Active Model Card */}
          <div className="agent-quick-card__active-model">
            <div className="agent-quick-card__active-model-info">
              <ProviderMark model={agent.modelId} size={22} />
              <div className="agent-quick-card__active-model-text">
                <span className="agent-quick-card__active-model-label" title={currentFormatted.label}>
                  {currentFormatted.label}
                </span>
                <span className="agent-quick-card__active-model-sub">
                  {currentFormatted.hint} · <strong className="agent-quick-card__ready-text">{L('Pronto', 'Ready')}</strong>
                </span>
              </div>
            </div>
            <span className="agent-quick-card__active-pill">{L('Ativo', 'Active')}</span>
          </div>

          {/* 1-Click Quick Models Grid */}
          <div className="agent-quick-card__quick-grid">
            {quickModels.map((qm) => {
              const isSelected = isSameModelId(qm.id, agent.modelId)
              return (
                <button
                  key={qm.id}
                  type="button"
                  className={`agent-quick-card__model-btn ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectModel(qm.id)}
                  title={`${qm.label} — ${qm.hint}`}
                >
                  <ProviderMark model={qm.id} size={14} />
                  <span className="agent-quick-card__model-btn-label">{qm.label}</span>
                  {isSelected && <Icon name="check" size={11} />}
                </button>
              )
            })}
          </div>

          {/* Expandable Full ModelPicker for any engine / provider / custom model */}
          {showFullPicker && (
            <div className="agent-quick-card__picker-wrap">
              <span className="agent-quick-card__picker-hint">
                {L('Escolha qualquer outro provedor ou modelo cadastrado:', 'Pick any other configured provider or model:')}
              </span>
              <ModelPicker
                value={agent.modelId}
                onChange={(m) => handleSelectModel(m)}
              />
            </div>
          )}
        </div>

        {/* Reasoning Effort Section */}
        <div className="agent-quick-card__section">
          <div className="agent-quick-card__section-head">
            <div className="agent-quick-card__section-title">
              <Icon name="bolt" size={12} />
              <span>{L('Esforço de Raciocínio', 'Reasoning Effort')}</span>
            </div>
          </div>
          <div className="agent-quick-card__effort-group" role="radiogroup">
            {EFFORTS.map((ef) => {
              const active = agent.effort === ef.id
              return (
                <button
                  key={ef.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`agent-quick-card__effort-btn ${active ? 'is-active' : ''}`}
                  onClick={() => handleSelectEffort(ef.id)}
                >
                  {ef.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick Capabilities & Administration */}
        <div className="agent-quick-card__section">
          <div className="agent-quick-card__section-head">
            <div className="agent-quick-card__section-title">
              <Icon name="sliders" size={12} />
              <span>{L('Capacidades & Consumo', 'Capabilities & Usage')}</span>
            </div>
          </div>

          <div className="agent-quick-card__caps-row">
            {/* Web Search */}
            <button
              type="button"
              className={`agent-quick-card__cap-pill ${agent.web !== false ? 'is-active' : ''}`}
              onClick={handleToggleWeb}
              title={L('Alternar pesquisa na web', 'Toggle web search')}
            >
              <Icon name="spark" size={11} />
              <span>{agent.web !== false ? L('Web: ON', 'Web: ON') : L('Web: OFF', 'Web: OFF')}</span>
            </button>

            {/* Memory Mode */}
            <button
              type="button"
              className="agent-quick-card__cap-pill is-active"
              onClick={handleCycleMemory}
              title={L('Clique para alternar modo de memória (Auto → Aprovar → Leitura)', 'Click to cycle memory mode (Auto → Approve → Read)')}
            >
              <Icon name="book" size={11} />
              <span>
                {agent.memory === 'auto' ? L('Mem: Auto', 'Mem: Auto') : agent.memory === 'approve' ? L('Mem: Aprovar', 'Mem: Approve') : L('Mem: Leitura', 'Mem: Read')}
              </span>
            </button>

            {/* Computer Execution */}
            <span
              className={`agent-quick-card__cap-pill ${agent.computer ? 'is-active' : 'is-muted'}`}
              title={agent.computer ? L(`Execução: ${agent.computerKind === 'mac' ? 'Mac/PC' : 'Linux container'}`, `Execution: ${agent.computerKind === 'mac' ? 'Mac/PC' : 'Linux container'}`) : L('Sem ambiente de computador', 'No computer environment')}
            >
              <Icon name="terminal" size={11} />
              <span>{agent.computer ? (agent.computerKind === 'mac' ? 'Host PC' : 'Sandbox') : L('Sem PC', 'No PC')}</span>
            </span>
          </div>

          {/* Token Usage / Quota Meter */}
          <div className="agent-quick-card__quota">
            <div className="agent-quick-card__quota-labels">
              <span>{L('Consumo mensal', 'Monthly tokens')}</span>
              <strong>{tokens(agent.used)} / {tokens(agent.limit)} ({limitPct}%)</strong>
            </div>
            <div className="agent-quick-card__quota-bar">
              <div
                className="agent-quick-card__quota-fill"
                style={{ width: `${limitPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Discord-style Action Buttons Footer */}
      <div className="agent-quick-card__footer">
        <button
          type="button"
          className="agent-quick-card__action-btn agent-quick-card__action-btn--primary"
          onClick={handleOpenFullProfile}
        >
          <Icon name="gear" size={13} />
          <span>{L('Configurações do Agente', 'Agent Settings')}</span>
        </button>

        <div className="agent-quick-card__footer-sub">
          {!isCurrentDm && (
            <button
              type="button"
              className="agent-quick-card__action-btn"
              onClick={handleOpenDm}
              title={L(`Abrir conversa direta com @${agent.handle}`, `Open direct message with @${agent.handle}`)}
            >
              <Icon name="message" size={13} />
              <span>{L('Conversar em DM', 'Chat in DM')}</span>
            </button>
          )}

          <button
            type="button"
            className="agent-quick-card__action-btn"
            onClick={handleOpenProviders}
            title={L('Gerenciar provedores, chaves e servidores locais de IA', 'Manage providers, keys and local AI servers')}
          >
            <Icon name="plug" size={13} />
            <span>{L('Provedores & APIs', 'Providers & APIs')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
