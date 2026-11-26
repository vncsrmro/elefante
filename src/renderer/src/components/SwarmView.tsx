import { useMemo, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { L } from '../../../shared/lang'
import { call } from '../rpc'
import { isTeam, sendMessage, stopRun, useStore, type Agent } from '../store'
import { AgentAvatar, Icon, time } from './ui'

type SwarmSubTab = 'overview' | 'board' | 'members' | 'graph'

export function SwarmView(): ReactNode {
  const agents = useStore((s) => s.agents.filter(isTeam))
  const allAgents = useStore((s) => s.agents)
  const squads = useStore((s) => s.squads)
  const swarms = useStore((s) => s.conversations.filter((c) => c.topic === '__swarm__'))
  const projects = useStore((s) => s.conversations.filter((c) => c.kind === 'channel' && !!c.project && c.topic !== '__stage__' && c.topic !== '__swarm__'))

  const [activeId, setActiveId] = useState<string | null>(() => swarms[swarms.length - 1]?.id ?? null)
  const [subTab, setSubTab] = useState<SwarmSubTab>('overview')
  const [goal, setGoal] = useState('')
  const [selectedSquadId, setSelectedSquadId] = useState<string>(() => squads[0]?.id ?? 'custom')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const firstSquad = squads[0]
    if (firstSquad && firstSquad.agentIds.length > 0) return firstSquad.agentIds
    return agents.slice(0, 4).map((a) => a.id)
  })
  const [project, setProject] = useState<string>(() => projects[0]?.project ?? '')
  const [boardSearch, setBoardSearch] = useState('')
  const [intervene, setIntervene] = useState('')
  const [showLauncher, setShowLauncher] = useState(() => swarms.length === 0)

  const activeSwarm = swarms.find((s) => s.id === activeId) ?? swarms[swarms.length - 1]
  const messages = useStore((s) => (activeSwarm ? s.messages.filter((m) => m.conversationId === activeSwarm.id) : []))

  const swarmMembers: Agent[] = useMemo(() => {
    if (!activeSwarm) return []
    return activeSwarm.members.map((id) => allAgents.find((a) => a.id === id)).filter((a): a is Agent => !!a)
  }, [activeSwarm, allAgents])

  const coordinator = useMemo(
    () => swarmMembers.find((a) => !a.reportsTo) ?? swarmMembers[0],
    [swarmMembers]
  )
  const workers = useMemo(() => swarmMembers.filter((a) => a.id !== coordinator?.id), [swarmMembers, coordinator])

  const memberStates = useMemo(() => {
    const map = new Map<string, { status: 'working' | 'done' | 'waiting'; step: string; lastPost?: string; posts: number }>()
    for (const m of swarmMembers) {
      map.set(m.id, { status: 'waiting', step: L('Aguardando tarefa', 'Standing by'), posts: 0 })
    }
    for (const msg of messages) {
      if (msg.author.kind !== 'agent') continue
      const prev = map.get(msg.author.id) ?? { status: 'waiting', step: '', posts: 0 }
      const st = msg.run?.status
      const curStep = [...(msg.run?.steps ?? [])].reverse().find((s) => s.status === 'running')
      const status = st === 'working' ? 'working' : st === 'done' || msg.text.includes('[done]') ? 'done' : 'waiting'
      map.set(msg.author.id, {
        status,
        step: st === 'working' ? curStep?.label ?? L('Executando…', 'Working…') : msg.text.replace(/^\[done\]\s*/i, '').slice(0, 90),
        lastPost: msg.text,
        posts: prev.posts + 1
      })
    }
    return map
  }, [swarmMembers, messages])

  const activeWorkers = swarmMembers.filter((a) => memberStates.get(a.id)?.status === 'working')
  const doneWorkers = workers.filter((a) => memberStates.get(a.id)?.status === 'done')
  const isLive = activeWorkers.length > 0

  const boardPosts = useMemo(() => {
    const q = boardSearch.trim().toLowerCase()
    return messages.filter((m) => {
      if (!q) return true
      const authorId = m.author.kind === 'agent' ? m.author.id : null
      const author = authorId ? allAgents.find((a) => a.id === authorId)?.handle ?? '' : 'fundador'
      return m.text.toLowerCase().includes(q) || author.toLowerCase().includes(q)
    })
  }, [messages, boardSearch, allAgents])

  const selectSquad = (sqId: string): void => {
    setSelectedSquadId(sqId)
    const sq = squads.find((s) => s.id === sqId)
    if (sq) {
      setSelectedIds(sq.agentIds)
      if (sq.project) setProject(sq.project)
    }
  }

  const toggleAgent = (id: string): void => {
    setSelectedSquadId('custom')
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleLaunch = async (): Promise<void> => {
    if (!goal.trim() || selectedIds.length === 0) return
    const id = await call('startSwarm', {
      goal: goal.trim(),
      agentIds: selectedIds,
      ...(project ? { project } : {})
    })
    setActiveId(id)
    setGoal('')
    setShowLauncher(false)
    setSubTab('overview')
  }

  const handlePost = (): void => {
    if (!activeSwarm || !intervene.trim()) return
    sendMessage(activeSwarm.id, intervene.trim())
    setIntervene('')
  }

  const swarmGoalText = useMemo(() => {
    const first = messages.find((m) => m.author.kind === 'me')
    return first ? first.text.replace(/^\[SWARM GOAL\]\s*/i, '') : activeSwarm?.name.replace(/^Swarm:\s*/i, '') ?? ''
  }, [messages, activeSwarm])

  return (
    <div style={{ marginTop: 12 }}>
      {/* Top Swarm selector + New Swarm button */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {swarms.map((sw) => (
            <button
              key={sw.id}
              type="button"
              className={`stage-agent-chip ${activeSwarm?.id === sw.id ? 'is-on' : ''}`}
              onClick={() => {
                setActiveId(sw.id)
                setShowLauncher(false)
              }}
            >
              <span>🐝 {sw.name.replace(/^Swarm:\s*/i, '')}</span>
            </button>
          ))}
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowLauncher((v) => !v)}>
            <Icon name="plus" size={12} /> {L('Novo Swarm', 'New Swarm')}
          </button>
        </div>
        {activeSwarm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: isLive ? '#22c55e' : 'var(--muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isLive ? '#22c55e' : '#64748b' }} />
              {isLive ? L('Live · Executando em paralelo', 'Live · Running in parallel') : L('Concluído / Pronto', 'Done / Ready')}
            </span>
          </div>
        )}
      </div>

      {/* Launcher panel */}
      {showLauncher && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
            🐝 {L('Iniciar Missão Swarm (Execução Paralela Autônoma)', 'Start Swarm Mission (Parallel Autonomous Execution)')}
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            {L(
              'O Coordenador divide o objetivo em tarefas paralelas com posse de arquivos, os especialistas executam ao mesmo tempo e o verificador audita tudo no final. Você também pode digitar /swarm <objetivo> em qualquer chat.',
              'The Coordinator splits the goal into parallel tasks, specialists run simultaneously, and the verifier audits the result. You can also type /swarm <goal> in any chat.'
            )}
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {squads.map((sq) => (
              <button
                key={sq.id}
                type="button"
                className={`stage-agent-chip ${selectedSquadId === sq.id ? 'is-on' : ''}`}
                onClick={() => selectSquad(sq.id)}
              >
                {sq.name} ({sq.agentIds.length})
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`stage-agent-chip ${selectedIds.includes(a.id) ? 'is-on' : ''}`}
                onClick={() => toggleAgent(a.id)}
              >
                <AgentAvatar agent={a} size={18} />
                <span>@{a.handle}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              style={{ flex: '1 1 320px' }}
              placeholder={L('Descreva o objetivo do Swarm (ex.: Criar landing page da romei.ro, revisar copy e validar QA)...', 'Describe the Swarm goal...')}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLaunch()}
            />
            {projects.length > 0 && (
              <select className="input" style={{ width: 220 }} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">{L('Sem pasta vinculada', 'No project folder')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.project!}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn--primary" disabled={!goal.trim() || selectedIds.length === 0} onClick={() => void handleLaunch()}>
              {L('Iniciar Swarm', 'Start Swarm')}
            </button>
          </div>
        </div>
      )}

      {!activeSwarm ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🐝</div>
          <h2 style={{ marginBottom: 8 }}>{L('Seu Swarm está pronto para começar', 'Your swarm is ready to start')}</h2>
          <p className="muted" style={{ maxWidth: 460, margin: '0 auto' }}>
            {L(
              'Um objetivo → vários agentes trabalhando em paralelo → um Board compartilhado. Clique em "Novo Swarm" acima ou digite /swarm em qualquer projeto.',
              'One goal → many workers running in parallel → one shared Board.'
            )}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 18 }}>
          {/* Sub-tabs header matching Overview | Board | Members | Graph */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{swarmGoalText}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                {(
                  [
                    ['overview', L('Overview', 'Overview')],
                    ['board', `${L('Board', 'Board')} ${messages.length}`],
                    ['members', `${L('Members', 'Members')} ${swarmMembers.length}`],
                    ['graph', L('Graph', 'Graph')]
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSubTab(k)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: subTab === k ? '2px solid var(--accent, #d0ff22)' : '2px solid transparent',
                      color: subTab === k ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: subTab === k ? 700 : 500,
                      padding: '4px 2px 8px',
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {isLive && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  for (const m of messages) {
                    if (m.run?.status === 'working') stopRun(m.id)
                  }
                }}
              >
                {L('Parar Swarm', 'Stop Swarm')}
              </button>
            )}
          </div>

          {/* 1. OVERVIEW TAB */}
          {subTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>GOAL</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{swarmGoalText}</div>
              </div>

              {activeWorkers.length > 0 && (
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.28)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>
                    ● {L('Em execução', 'Running')} ({activeWorkers.length})
                  </div>
                  {activeWorkers.map((w) => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.role || w.name}</div>
                        <div className="muted small">{memberStates.get(w.id)?.step}</div>
                      </div>
                      <span className="stage-agent-chip is-on">
                        <AgentAvatar agent={w} size={16} /> @{w.handle}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
                  <span>
                    {doneWorkers.length} {L('de', 'of')} {Math.max(1, workers.length)} {L('tarefas concluídas', 'tasks done')}
                  </span>
                  <span className="muted small">{messages.length} {L('atualizações no Board', 'board updates')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workers.map((w) => {
                    const st = memberStates.get(w.id)
                    return (
                      <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span style={{ color: st?.status === 'done' ? '#22c55e' : st?.status === 'working' ? '#60a5fa' : 'var(--muted)' }}>
                            {st?.status === 'done' ? '✓' : st?.status === 'working' ? '◌' : '○'}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name}</div>
                            <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 540 }}>
                              {st?.step || w.role}
                            </div>
                          </div>
                        </div>
                        <span className="stage-agent-chip">
                          <AgentAvatar agent={w} size={16} /> @{w.handle}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Team roster strip */}
              <div>
                <div className="muted small" style={{ marginBottom: 8, fontWeight: 600 }}>{L('O time', 'The team')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {swarmMembers.map((m) => {
                    const st = memberStates.get(m.id)?.status
                    return (
                      <div key={m.id} className="stage-agent-chip" style={{ padding: '6px 10px' }}>
                        <AgentAvatar agent={m} size={18} />
                        <span>@{m.handle}</span>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: st === 'working' ? '#22c55e' : st === 'done' ? '#d0ff22' : '#64748b' }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. BOARD TAB */}
          {subTab === 'board' && (
            <div>
              <input
                type="text"
                className="input"
                style={{ width: '100%', marginBottom: 12 }}
                placeholder={L('Buscar no Board por agente ou conteúdo...', 'Search board posts...')}
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 460, overflowY: 'auto' }}>
                {boardPosts.map((msg, idx) => {
                  const agId = msg.author.kind === 'agent' ? msg.author.id : null
                  const ag = agId ? allAgents.find((a) => a.id === agId) : undefined
                  return (
                    <div key={msg.id} style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ag ? <AgentAvatar agent={ag} size={20} /> : <span>👤</span>}
                          <strong style={{ fontSize: 13 }}>{ag ? `@${ag.handle}` : L('Fundador', 'Founder')}</strong>
                          {msg.run?.status === 'working' && <span style={{ fontSize: 11, color: '#60a5fa' }}>● Working…</span>}
                        </div>
                        <span className="muted small">#{idx + 1} · {time(msg.at)}</span>
                      </div>
                      <div className="md" style={{ fontSize: 13 }}>
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.text || L('Pensando…', 'Thinking…')}</Markdown>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  type="text"
                  className="input"
                  style={{ flex: 1 }}
                  placeholder={L('Intervir no Board (use @handle para direcionar)...', 'Post to the board (@handle to direct)...')}
                  value={intervene}
                  onChange={(e) => setIntervene(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePost()}
                />
                <button type="button" className="btn btn--primary btn--sm" onClick={handlePost}>
                  {L('Enviar', 'Post')}
                </button>
              </div>
            </div>
          )}

          {/* 3. MEMBERS TAB */}
          {subTab === 'members' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {swarmMembers.map((m) => {
                const st = memberStates.get(m.id)
                const isCoord = m.id === coordinator?.id
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AgentAvatar agent={m} size={32} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong>@{m.handle}</strong>
                          <span className="muted small">{isCoord ? L('Coordenador', 'Coordinator') : m.name}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: st?.status === 'working' ? '#60a5fa' : st?.status === 'done' ? '#22c55e' : 'var(--muted)'
                            }}
                          >
                            {st?.status === 'working' ? 'Working' : st?.status === 'done' ? 'Done' : 'Standing by'}
                          </span>
                        </div>
                        <div className="muted small" style={{ marginTop: 2 }}>{st?.step || m.role}</div>
                      </div>
                    </div>
                    <div className="muted small" style={{ textAlign: 'right' }}>
                      <div>{m.modelId}</div>
                      <div>{st?.posts ?? 0} posts</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 4. GRAPH TAB (Hive Visual) */}
          {subTab === 'graph' && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', alignItems: 'center', minHeight: 280 }}>
                {/* Coordinator Hub */}
                {coordinator && (
                  <div style={{ padding: '22px 28px', borderRadius: 18, background: 'rgba(208,255,34,0.07)', border: '2px solid rgba(208,255,34,0.45)', minWidth: 190 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <AgentAvatar agent={coordinator} size={42} />
                    </div>
                    <div style={{ fontWeight: 700 }}>@{coordinator.handle}</div>
                    <div className="muted small">{L('Coordenador', 'Coordinator')}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#d0ff22' }}>
                      {doneWorkers.length} / {workers.length} {L('concluídas', 'done')}
                    </div>
                  </div>
                )}

                {/* Parallel Workers Cluster */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, flex: '1 1 380px', maxWidth: 640 }}>
                  {workers.map((w) => {
                    const st = memberStates.get(w.id)?.status
                    const border = st === 'done' ? '#22c55e' : st === 'working' ? '#60a5fa' : 'var(--border)'
                    return (
                      <div key={w.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                          <AgentAvatar agent={w} size={32} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>@{w.handle}</div>
                        <div style={{ fontSize: 11, marginTop: 4, color: st === 'done' ? '#22c55e' : st === 'working' ? '#60a5fa' : 'var(--muted)' }}>
                          {st === 'done' ? '✓ Done' : st === 'working' ? '● Working' : '◌ Waiting'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 18, fontSize: 12 }} className="muted">
                <span><span style={{ color: '#22c55e' }}>●</span> {L('Concluído', 'Tasks done')}</span>
                <span><span style={{ color: '#60a5fa' }}>●</span> {L('Executando em paralelo', 'Working')}</span>
                <span><span style={{ color: '#64748b' }}>●</span> {L('Aguardando', 'Waiting on')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
