import { useState, useRef, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  agentById,
  decideApproval,
  navigate,
  pendingApprovals,
  setInboxOpen,
  useStore,
  type Agent,
  type Approval,
  type Routine
} from '../store'
import { AgentAvatar, Icon, ago, time } from './ui'

export function OneInboxDrawer(): ReactNode {
  const isOpen = useStore((s) => s.inboxOpen)
  if (!isOpen) return null

  return (
    <div className="inbox-backdrop" onClick={() => setInboxOpen(false)}>
      <aside className="inbox-drawer" onClick={(e) => e.stopPropagation()}>
        <OneInboxContent onClose={() => setInboxOpen(false)} />
      </aside>
    </div>
  )
}

export function OneInboxContent({ onClose }: { onClose?: () => void }): ReactNode {
  const s = useStore((s) => s)
  const pending = pendingApprovals(s)
  const tasksWaiting = s.tasks.filter((t) => t.waiting && t.status === 'review')
  const totalWaiting = pending.length + tasksWaiting.length

  const pastApprovals = s.approvals.filter((a) => a.state !== 'pending').slice(-8)
  const recentRoutines = s.routines.filter((r) => r.lastAt).slice(-6)

  return (
    <div className="one-inbox">
      {/* Inbox Header */}
      <header className="one-inbox__header">
        <div className="one-inbox__header-left">
          <div className="one-inbox__icon">
            <Icon name="bell" size={16} />
          </div>
          <div>
            <h2 className="one-inbox__title">{L('One inbox', 'One inbox')}</h2>
            <p className="one-inbox__subtitle">
              {L('O que está esperando por você fica no topo', "What's waiting on you stays on top")}
            </p>
          </div>
        </div>

        {onClose && (
          <button className="icon-btn" onClick={onClose} title={L('Fechar', 'Close')}>
            <Icon name="x" size={16} />
          </button>
        )}
      </header>

      <div className="one-inbox__scroll">
        {/* Section: Waiting on you */}
        <div className="one-inbox__section">
          <div className="one-inbox__section-title">
            <span className="one-inbox__clock-icon">
              <Icon name="clock" size={13} />
            </span>
            <span className="one-inbox__waiting-label">
              {L('Esperando você', 'Waiting on you')}
            </span>
            <span className="one-inbox__waiting-count">· {totalWaiting}</span>
          </div>

          {totalWaiting === 0 ? (
            <div className="one-inbox__empty-waiting">
              <span className="one-inbox__check-circle">
                <Icon name="check" size={12} />
              </span>
              <span>{L('Tudo em dia! Nenhuma ação pendente dos agentes.', 'All caught up! No pending agent actions.')}</span>
            </div>
          ) : (
            <div className="one-inbox__waiting-list">
              {pending.map((approval) => (
                <InboxApprovalCard key={approval.id} approval={approval} />
              ))}

              {tasksWaiting.map((task) => (
                <InboxTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Section: Earlier */}
        <div className="one-inbox__section one-inbox__section--earlier">
          <div className="one-inbox__section-title">
            <span className="one-inbox__earlier-label">{L('Anteriores', 'Earlier')}</span>
          </div>

          <div className="one-inbox__earlier-list">
            {pastApprovals.map((ap) => {
              const agent = agentById(s, ap.agentId)
              const actionLabel = formatActionName(ap)
              const stateLabel =
                ap.state === 'approved'
                  ? L('Aprovado', 'Approved')
                  : ap.state === 'refused'
                  ? L('Recusado', 'Refused')
                  : L('Expirado', 'Expired')

              return (
                <div key={ap.id} className="one-inbox__earlier-item">
                  <div className="one-inbox__earlier-avatar">
                    {agent ? <AgentAvatar agent={agent} size={22} /> : <span className="avatar-dot" />}
                  </div>
                  <div className="one-inbox__earlier-info">
                    <p className="one-inbox__earlier-text">
                      <strong>{agent?.name ?? L('Agente', 'Agent')}:</strong> {actionLabel} ·{' '}
                      <span className={`status-tag status-tag--${ap.state}`}>{stateLabel}</span>
                    </p>
                    <span className="one-inbox__earlier-time">{ap.decidedAt ? ago(ap.decidedAt) : ago(ap.createdAt)}</span>
                  </div>
                </div>
              )
            })}

            {recentRoutines.map((routine) => {
              const agent = agentById(s, routine.agentId)
              return (
                <div key={routine.id} className="one-inbox__earlier-item">
                  <div className="one-inbox__earlier-avatar">
                    {agent ? <AgentAvatar agent={agent} size={22} /> : <span className="avatar-dot" />}
                  </div>
                  <div className="one-inbox__earlier-info">
                    <p className="one-inbox__earlier-text">
                      <strong>{routine.name}</strong> {L('executado com sucesso', 'ready')}
                    </p>
                    <span className="one-inbox__earlier-time">{routine.lastAt ? time(routine.lastAt) : ''}</span>
                  </div>
                </div>
              )
            })}

            {pastApprovals.length === 0 && recentRoutines.length === 0 && (
              <div className="one-inbox__empty-earlier">
                <span>{L('Sem histórico recente', 'No recent history')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InboxApprovalCard({ approval }: { approval: Approval }): ReactNode {
  const agent = useStore((s) => agentById(s, approval.agentId))
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const [hold, setHold] = useState(0)
  const timer = useRef<number | null>(null)

  const isHighRisk = approval.highRisk
  const actionTitle = formatActionName(approval)
  const expiresText = formatExpires(approval.expiresAt)

  // Hold to approve (1.5s press)
  const startHold = (): void => {
    const started = performance.now()
    const tick = (): void => {
      const p = Math.min(1, (performance.now() - started) / 1500)
      setHold(p)
      if (p >= 1) {
        timer.current = null
        decideApproval(approval.id, 'approved')
        return
      }
      timer.current = requestAnimationFrame(tick)
    }
    timer.current = requestAnimationFrame(tick)
  }

  const cancelHold = (): void => {
    if (timer.current) cancelAnimationFrame(timer.current)
    timer.current = null
    setHold(0)
  }

  return (
    <div className={`inbox-card ${isHighRisk ? 'is-high-risk' : ''}`}>
      <div className="inbox-card__header">
        <div className="inbox-card__agent">
          {agent && <AgentAvatar agent={agent} size={22} />}
          <span className="inbox-card__agent-name">{agent?.name ?? L('Agente', 'Agent')}</span>
        </div>

        <span className="inbox-card__expire-badge" title={time(approval.expiresAt)}>
          {expiresText}
        </span>
      </div>

      <h4 className="inbox-card__title">{actionTitle}</h4>

      {approval.why && <p className="inbox-card__why">{approval.why}</p>}

      {refusing ? (
        <form
          className="inbox-card__refuse-form"
          onSubmit={(e) => {
            e.preventDefault()
            decideApproval(approval.id, 'refused', reason.trim() || undefined)
          }}
        >
          <input
            type="text"
            autoFocus
            className="input input--sm"
            placeholder={L('Motivo da recusa (o agente aprende com isso)…', 'Reason for refusal…')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => setRefusing(false)}>
              {L('Voltar', 'Back')}
            </button>
            <button type="submit" className="btn btn--danger btn--xs">
              {L('Confirmar Recusa', 'Refuse')}
            </button>
          </div>
        </form>
      ) : (
        <div className="inbox-card__actions">
          {isHighRisk ? (
            <button
              className="btn btn--primary btn--hold btn--sm"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              style={{ ['--hold' as string]: `${hold * 100}%` }}
            >
              <span>{hold > 0 ? L('Segure…', 'Hold…') : L('Segure para aprovar', 'Hold to approve')}</span>
            </button>
          ) : (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => decideApproval(approval.id, 'approved')}
            >
              <Icon name="check" size={12} />
              <span>{L('Aprovar', 'Approve')}</span>
            </button>
          )}

          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setRefusing(true)}
            title={L('Recusar chamada', 'Refuse call')}
          >
            {L('Recusar', 'Refuse')}
          </button>

          <button
            className="btn btn--ghost btn--sm"
            onClick={() => navigate({ kind: 'conversation', id: approval.conversationId, message: approval.messageId })}
            title={L('Ver no canal', 'View in channel')}
          >
            <Icon name="send" size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function InboxTaskCard({ task }: { task: import('../../../shared/types').Task }): ReactNode {
  const agent = useStore((s) => (task.agentId ? agentById(s, task.agentId) : undefined))
  return (
    <div className="inbox-card inbox-card--task">
      <div className="inbox-card__header">
        <div className="inbox-card__agent">
          {agent && <AgentAvatar agent={agent} size={22} />}
          <span className="inbox-card__agent-name">{agent?.name ?? L('Agente', 'Agent')}</span>
          <span className="inbox-card__task-tag">#{task.number}</span>
        </div>
        <span className="inbox-card__expire-badge">{L('em revisão', 'in review')}</span>
      </div>

      <h4 className="inbox-card__title">{task.title}</h4>
      {task.description && <p className="inbox-card__why">{task.description}</p>}

      <div className="inbox-card__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => navigate({ kind: 'conversation', id: task.conversationId, message: task.messageId })}
        >
          <Icon name="send" size={11} />
          <span>{L('Responder no chat', 'Reply in chat')}</span>
        </button>
      </div>
    </div>
  )
}

function formatActionName(approval: Approval): string {
  if (approval.tool === 'pedir_acesso') {
    return `${approval.connectorName}: ${L('Acesso', 'Access')} (${approval.args['nivel'] ?? 'read'})`
  }
  if (approval.tool === 'abrir_pr') {
    return `${L('Abrir PR em', 'Open PR in')} ${String(approval.args['repo'] ?? '')}`
  }
  if (approval.connectorId === 'navegador') {
    return `${L('Navegador: Clicar em', 'Browser: Click on')} ${String(approval.args['alvo'] ?? approval.args['url'] ?? '')}`
  }
  return `${approval.connectorName} · ${approval.tool.replace(/_/g, ' ')}`
}

function formatExpires(expiresAt?: number): string {
  if (!expiresAt) return ''
  const remainingMs = expiresAt - Date.now()
  if (remainingMs <= 0) return L('expirado', 'expired')
  const hours = Math.round(remainingMs / 3_600_000)
  if (hours >= 1) return L(`expira em ${hours} h`, `expires in ${hours} h`)
  const minutes = Math.round(remainingMs / 60_000)
  return L(`expira em ${minutes} min`, `expires in ${minutes} min`)
}
