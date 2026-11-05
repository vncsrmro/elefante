import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { agentById, useStore, type Agent, type Message, type Step, type TodoItem } from '../store'
import { AgentAvatar, Icon, time } from './ui'

interface MissionHubProps {
  message: Message
  todos: TodoItem[]
}

export function MissionHub({ message, todos }: MissionHubProps): ReactNode {
  const me = useStore((s) => s.me)
  const agent = useStore((s) => (message.author.kind === 'agent' ? agentById(s, message.author.id) : undefined))
  
  // Progress feed sort order: 'newest_first' (default, most recent on top) or 'oldest_first'
  const [order, setOrder] = useState<'newest_first' | 'oldest_first'>('newest_first')
  const feedRef = useRef<HTMLDivElement>(null)
  const todosRef = useRef<HTMLUListElement>(null)

  // Scrubber playback state: 0 (start) to 100 (realtime current)
  const [playbackPct, setPlaybackPct] = useState(100)
  const [isPlaying, setIsPlaying] = useState(false)
  const playTimerRef = useRef<number | null>(null)

  // Derive mission title from prior context or first todo
  const missionTitle = todos[0]?.title ? todos[0].title.replace(/^Passo \d+:\s*/i, '') : L('Missão em andamento', 'Mission in progress')
  const authorName = agent?.name ?? L('Agente', 'Agent')
  const userName = me.name || L('Você', 'You')

  // Calculate current completion
  const doneCount = todos.filter((t) => t.status === 'done').length
  const totalCount = todos.length
  const realPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // When scrubbing/playing, determine effective status of each item
  const effectivePct = isPlaying || playbackPct < 100 ? playbackPct : realPct

  // Segmented progress bar (16 segments)
  const SEGMENT_COUNT = 16
  const activeSegments = Math.round((effectivePct / 100) * SEGMENT_COUNT)

  // Progress narrative steps from message.run.steps
  const rawSteps = message.run?.steps ?? []
  const narrativeSteps = rawSteps.filter((s) => {
    const isThinking = s.label.toLowerCase().includes('pensand') || s.label.toLowerCase().includes('thinking')
    return !isThinking && (s.detail || s.note || s.command || s.status === 'done' || s.status === 'error')
  })

  // Display steps based on order ('newest_first' puts latest on top)
  const displaySteps = useMemo(() => {
    return order === 'newest_first' ? [...narrativeSteps].reverse() : narrativeSteps
  }, [narrativeSteps, order])

  // Auto-scroll feed: top if newest_first, bottom if oldest_first
  useEffect(() => {
    if (!feedRef.current) return
    if (order === 'oldest_first') {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    } else {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [narrativeSteps.length, order])

  // Auto-scroll checklist to active working todo
  useEffect(() => {
    if (!todosRef.current) return
    const activeEl = todosRef.current.querySelector('.mission-todo-row.is-working')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [todos])

  // Playback timer animation
  const togglePlay = (): void => {
    if (isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
      setIsPlaying(false)
      return
    }

    setIsPlaying(true)
    setPlaybackPct(0)
    const startTime = performance.now()
    const duration = 2400 // 2.4s replay
    
    playTimerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTime
      const progress = Math.min(100, (elapsed / duration) * 100)
      setPlaybackPct(progress)

      if (progress >= 100) {
        if (playTimerRef.current) clearInterval(playTimerRef.current)
        setIsPlaying(false)
      }
    }, 30)
  }

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
    }
  }, [])

  return (
    <div className="mission-hub">
      {/* Left: Mission Checklist & Player */}
      <div className="mission-hub__card mission-hub__card--checklist">
        {/* Mission Header */}
        <div className="mission-hub__header">
          <div className="mission-hub__flag-icon">
            <Icon name="flag" size={14} />
          </div>
          <div className="mission-hub__meta">
            <h3 className="mission-hub__title">{missionTitle}</h3>
            <span className="mission-hub__subtitle">
              {L(`Missão de ${authorName} · aberta por ${userName}`, `${authorName}'s mission · opened by ${userName}`)}
            </span>
          </div>
        </div>

        {/* Checklist */}
        <ul ref={todosRef} className="mission-hub__todos">
          {todos.map((todo, idx) => {
            // Determine simulated status during playback
            const itemThreshold = totalCount > 0 ? ((idx + 1) / totalCount) * 100 : 0
            const isSimulatedDone = effectivePct >= itemThreshold
            const isDone = isPlaying || playbackPct < 100 ? isSimulatedDone : todo.status === 'done'
            const isWorking = !isDone && (todo.status === 'in_progress' || (isPlaying && Math.abs(effectivePct - itemThreshold) < 15))
            const isCancelled = todo.status === 'cancelled'

            return (
              <li
                key={todo.id}
                className={`mission-todo-row ${isDone ? 'is-done' : ''} ${isWorking ? 'is-working' : ''}`}
              >
                <div className="mission-todo-row__status">
                  {isDone ? (
                    <span className="mission-todo-icon is-done">
                      <Icon name="check" size={11} />
                    </span>
                  ) : isWorking ? (
                    <span className="mission-todo-icon is-working">
                      <span className="mission-todo-dot" />
                    </span>
                  ) : isCancelled ? (
                    <span className="mission-todo-icon is-cancelled">–</span>
                  ) : (
                    <span className="mission-todo-icon is-pending" />
                  )}
                </div>

                <span className="mission-todo-row__title">{todo.title}</span>

                {/* Agent badge for task owner */}
                <div className="mission-todo-row__agent" title={authorName}>
                  {agent && <AgentAvatar agent={agent} size={15} />}
                  <span className="mission-todo-agent-name">{authorName}</span>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Segmented Progress Bar */}
        <div className="mission-hub__segmented-bar">
          {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`mission-hub__segment ${i < activeSegments ? 'is-filled' : ''}`}
            />
          ))}
        </div>

        {/* Timeline Slider & Play Control */}
        <div className="mission-hub__timeline">
          <span className="mission-hub__day-tag">
            {L('Dia 1', 'Day 1')}
          </span>

          <div className="mission-hub__slider-wrap">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(effectivePct)}
              onChange={(e) => {
                if (isPlaying && playTimerRef.current) clearInterval(playTimerRef.current)
                setIsPlaying(false)
                setPlaybackPct(Number(e.target.value))
              }}
              className="mission-hub__slider"
              title={L(`Linha do tempo: ${Math.round(effectivePct)}%`, `Timeline: ${Math.round(effectivePct)}%`)}
            />
          </div>

          <button
            className={`mission-hub__play-btn ${isPlaying ? 'is-playing' : ''}`}
            onClick={togglePlay}
            type="button"
            title={isPlaying ? L('Pausar linha do tempo', 'Pause timeline') : L('Reproduzir evolução da missão', 'Play mission evolution')}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={12} />
            <span>{isPlaying ? L('Pausar', 'Pause') : L('Play', 'Play')}</span>
          </button>
        </div>
      </div>

      {/* Right: Progress Stream ("What the agent shares while it works") */}
      <div className="mission-hub__card mission-hub__card--progress">
        <div className="mission-hub__progress-header">
          <div className="mission-hub__progress-icon">
            <Icon name="terminal" size={14} />
          </div>
          <div className="mission-hub__progress-text">
            <h4 className="mission-hub__progress-title">{L('Progresso', 'Progress')}</h4>
            <span className="mission-hub__progress-desc">
              {L('O que o agente compartilha enquanto trabalha', 'What the agent shares while it works')}
            </span>
          </div>
          <button
            className={`mission-hub__order-btn ${order === 'newest_first' ? 'is-active' : ''}`}
            onClick={() => setOrder(order === 'newest_first' ? 'oldest_first' : 'newest_first')}
            type="button"
            title={order === 'newest_first' ? L('Alternar para ordem cronológica (antigos primeiro)', 'Switch to chronological order (oldest first)') : L('Alternar para mais recentes no topo', 'Switch to newest at top')}
          >
            <Icon name="refresh" size={11} />
            <span>{order === 'newest_first' ? L('Recente no topo', 'Newest first') : L('Cronológico', 'Chronological')}</span>
          </button>
        </div>

        <div ref={feedRef} className="mission-hub__feed">
          {displaySteps.length === 0 ? (
            <div className="mission-hub__feed-empty">
              <span className="mission-hub__feed-empty-dot" />
              <span>{L('Aguardando primeiras atualizações do agente…', 'Waiting for initial updates from agent…')}</span>
            </div>
          ) : (
            displaySteps.map((step, idx) => {
              const textNote = step.note || (step.detail ? `${step.label}: ${step.detail}` : step.label)
              const stepTime = step.at ? time(step.at) : time(message.at)
              const isLatest = order === 'newest_first' && idx === 0

              return (
                <div key={step.id} className={`mission-feed-item ${isLatest ? 'is-latest' : ''}`}>
                  <div className="mission-feed-item__avatar">
                    {agent ? <AgentAvatar agent={agent} size={20} /> : <span className="mission-feed-item__avatar-fallback" />}
                  </div>
                  <div className="mission-feed-item__content">
                    <p className="mission-feed-item__text">
                      <strong className="mission-feed-item__author">{authorName}</strong>{' '}
                      {textNote}
                    </p>
                    <div className="mission-feed-item__meta">
                      <span className="mission-feed-item__time">
                        {L('Dia 1', 'Day 1')} · {stepTime}
                      </span>
                      {isLatest && (
                        <span className="mission-feed-item__badge-new">
                          <span className="mission-feed-item__pulse-dot" />
                          {L('Mais recente', 'Latest')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
