import { useMemo, useState, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { call } from '../rpc'
import {
  agentById,
  isTeam,
  openDm,
  removeSquad,
  saveSquad,
  sendMessage,
  stopRun,
  useStore,
  type Squad,
  type SquadAutonomy,
  type SquadMode
} from '../store'
import { AgentAvatar, Icon, time } from './ui'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function StagePage(): ReactNode {
  const agents = useStore((s) => s.agents.filter(isTeam))
  const squads = useStore((s) => s.squads)
  const allMessages = useStore((s) => s.messages)
  const stages = useStore((s) => s.conversations.filter((c) => c.topic === '__stage__'))
  const projects = useStore((s) => s.conversations.filter((c) => c.kind === 'channel' && !!c.project && c.topic !== '__stage__'))

  const [tab, setTab] = useState<'office' | 'debate'>('office')
  const [selectedSquadId, setSelectedSquadId] = useState<string>('all')
  const [creatingSquad, setCreatingSquad] = useState(false)
  const [sqName, setSqName] = useState('')
  const [sqMode, setSqMode] = useState<SquadMode>('hierarchical')
  const [sqChief, setSqChief] = useState('')
  const [sqAgents, setSqAgents] = useState<string[]>([])

  // Debate state
  const [activeId, setActiveId] = useState<string | null>(() => stages[stages.length - 1]?.id ?? null)
  const [topic, setTopic] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => agents.slice(0, 3).map((a) => a.id))
  const [rounds, setRounds] = useState(2)
  const [project, setProject] = useState<string>('')
  const [intervene, setIntervene] = useState('')

  const activeSquad: Squad | undefined = squads.find((s) => s.id === selectedSquadId)
  const officeAgents = useMemo(() => {
    if (!activeSquad) return agents
    return agents.filter((a) => activeSquad.agentIds.includes(a.id))
  }, [agents, activeSquad])

  const chiefAgent = useMemo(() => {
    if (activeSquad?.chiefId) return officeAgents.find((a) => a.id === activeSquad.chiefId)
    return officeAgents.find((a) => a.isChief)
  }, [officeAgents, activeSquad])

  const teamAgents = useMemo(() => {
    if (!chiefAgent) return officeAgents
    return officeAgents.filter((a) => a.id !== chiefAgent.id)
  }, [officeAgents, chiefAgent])

  // Live status per agent from their latest active/recent message
  const agentActivity = useMemo(() => {
    const map = new Map<string, { status: 'working' | 'waiting' | 'idle'; label: string; at: number }>()
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i]!
      if (m.author.kind !== 'agent') continue
      if (map.has(m.author.id)) continue
      const st = m.run?.status
      if (st === 'working') {
        const curStep = [...(m.run?.steps ?? [])].reverse().find((s) => s.status === 'running')
        map.set(m.author.id, { status: 'working', label: curStep?.label ?? L('Pensando…', 'Thinking…'), at: m.at })
      } else if (st === 'waiting_input' || st === 'waiting_approval') {
        map.set(m.author.id, { status: 'waiting', label: L('Aguardando você', 'Waiting on you'), at: m.at })
      } else {
        map.set(m.author.id, { status: 'idle', label: m.text.slice(0, 60) || L('Livre', 'Idle'), at: m.at })
      }
    }
    return map
  }, [allMessages])

  // Live wiretap feed of recent agent messages for the selected squad
  const wiretapFeed = useMemo(() => {
    const ids = new Set(officeAgents.map((a) => a.id))
    return allMessages
      .filter((m) => m.author.kind === 'agent' && ids.has(m.author.id))
      .slice(-25)
      .reverse()
  }, [allMessages, officeAgents])

  const handleSaveSquad = async (): Promise<void> => {
    if (!sqName.trim() || sqAgents.length === 0) return
    const saved = await saveSquad({
      id: '',
      name: sqName.trim(),
      mode: sqMode,
      autonomy: 'autonomous',
      chiefId: sqChief || sqAgents[0],
      agentIds: sqAgents
    })
    setSelectedSquadId(saved.id)
    setCreatingSquad(false)
    setSqName('')
    setSqAgents([])
  }

  const setAutonomy = (autonomy: SquadAutonomy): void => {
    if (!activeSquad) return
    void saveSquad({ ...activeSquad, autonomy })
  }

  const activeConv = stages.find((s) => s.id === activeId) ?? stages[stages.length - 1]
  const messages = useStore((s) => (activeConv ? s.messages.filter((m) => m.conversationId === activeConv.id) : []))
  const allAgents = useStore((s) => s.agents)

  const toggleAgent = (id: string): void => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleStart = async (): Promise<void> => {
    if (!topic.trim() || selectedIds.length < 2) return
    const id = await call('startStage', {
      topic: topic.trim(),
      agentIds: selectedIds,
      rounds,
      ...(project ? { project } : {})
    })
    setActiveId(id)
    setTopic('')
  }

  const handleIntervene = (): void => {
    if (!activeConv || !intervene.trim()) return
    sendMessage(activeConv.id, intervene.trim())
    setIntervene('')
  }

  const workingMsg = messages.find((m) => m.run?.status === 'working')
  const workingAgentId = workingMsg?.author.kind === 'agent' ? workingMsg.author.id : null

  return (
    <div className="page stage-page">
      <header className="page__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1>{L('Escritório & Palco', 'Office & Stage')}</h1>
          <p className="muted">
            {L('Organize seus Squads, acompanhe os agentes ao vivo no escritório ou coloque-os para debater no palco.', 'Organize Squads, watch agents live in the office, or put them on stage to debate.')}
          </p>
        </div>
        <div className="topbar__view-toggle">
          <button type="button" className={`view-toggle-btn ${tab === 'office' ? 'is-active' : ''}`} onClick={() => setTab('office')}>
            <Icon name="users" size={13} />
            <span>{L('Escritório Vivo', 'Live Office')}</span>
          </button>
          <button type="button" className={`view-toggle-btn ${tab === 'debate' ? 'is-active' : ''}`} onClick={() => setTab('debate')}>
            <Icon name="spark" size={13} />
            <span>{L('Palco de Debates', 'Debate Stage')}</span>
          </button>
        </div>
      </header>

      {tab === 'office' ? (
        <div className="office-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginTop: 12 }}>
          <div>
            {/* Squad bar + Autonomy brake */}
            <div className="card" style={{ padding: 12, marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className={`stage-agent-chip ${selectedSquadId === 'all' ? 'is-on' : ''}`}
                  onClick={() => setSelectedSquadId('all')}
                >
                  {L('Todos os agentes', 'All agents')} ({agents.length})
                </button>
                {squads.map((sq) => (
                  <button
                    key={sq.id}
                    type="button"
                    className={`stage-agent-chip ${selectedSquadId === sq.id ? 'is-on' : ''}`}
                    onClick={() => setSelectedSquadId(sq.id)}
                  >
                    <span>{sq.name}</span>
                    <span className="muted small">({sq.agentIds.length})</span>
                  </button>
                ))}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreatingSquad((v) => !v)}>
                  <Icon name="plus" size={12} /> {L('Novo Squad', 'New Squad')}
                </button>
              </div>

              {activeSquad && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="muted small">{L('Autonomia:', 'Autonomy:')}</span>
                  {(['autonomous', 'supervised', 'paused'] as const).map((au) => (
                    <button
                      key={au}
                      type="button"
                      className={`btn btn--xs ${activeSquad.autonomy === au ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setAutonomy(au)}
                    >
                      {au === 'autonomous' ? L('Autônomo', 'Autonomous') : au === 'supervised' ? L('Supervisionado', 'Supervised') : L('Pausado', 'Paused')}
                    </button>
                  ))}
                  <button type="button" className="btn btn--xs btn--ghost" title={L('Excluir Squad', 'Delete Squad')} onClick={() => { removeSquad(activeSquad.id); setSelectedSquadId('all') }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              )}
            </div>

            {creatingSquad && (
              <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder={L('Nome do Squad (ex: Estúdio de Vídeo, Clientes)…', 'Squad name (e.g. Video Studio, Clients)…')}
                    value={sqName}
                    onChange={(e) => setSqName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <select className="input" value={sqMode} onChange={(e) => setSqMode(e.target.value as SquadMode)} style={{ width: 170 }}>
                    <option value="hierarchical">{L('Hierárquico (Líder)', 'Hierarchical (Chief)')}</option>
                    <option value="pipeline">{L('Pipeline (Sequencial)', 'Pipeline (Sequential)')}</option>
                    <option value="debate">{L('Debate livre', 'Free debate')}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span className="muted small">{L('Agentes:', 'Agents:')}</span>
                  {agents.map((a) => {
                    const on = sqAgents.includes(a.id)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`stage-agent-chip ${on ? 'is-on' : ''}`}
                        onClick={() => setSqAgents((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                      >
                        <AgentAvatar agent={a} size={16} />
                        <span>{a.name}</span>
                      </button>
                    )
                  })}
                </div>
                {sqAgents.length > 0 && sqMode === 'hierarchical' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="muted small">{L('Líder do Squad:', 'Squad Chief:')}</span>
                    <select className="input" value={sqChief || sqAgents[0]} onChange={(e) => setSqChief(e.target.value)} style={{ width: 200 }}>
                      {sqAgents.map((id) => {
                        const ag = agents.find((a) => a.id === id)
                        return ag ? <option key={id} value={id}>{ag.name}</option> : null
                      })}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreatingSquad(false)}>{L('Cancelar', 'Cancel')}</button>
                  <button type="button" className="btn btn--primary btn--sm" disabled={!sqName.trim() || sqAgents.length === 0} onClick={() => void handleSaveSquad()}>
                    {L('Salvar Squad', 'Save Squad')}
                  </button>
                </div>
              </div>
            )}

            {/* Chief desk */}
            {chiefAgent && (
              <div style={{ marginBottom: 14 }}>
                <div className="muted small" style={{ marginBottom: 6 }}>{L('Liderança / Coordenação', 'Leadership / Coordination')}</div>
                <OfficeDesk agent={chiefAgent} activity={agentActivity.get(chiefAgent.id)} isChief />
              </div>
            )}

            {/* Team desks */}
            <div className="muted small" style={{ marginBottom: 6 }}>{L('Estações da Equipe', 'Team Desks')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {teamAgents.map((ag) => (
                <OfficeDesk key={ag.id} agent={ag} activity={agentActivity.get(ag.id)} />
              ))}
            </div>
          </div>

          {/* Live Wiretap Feed */}
          <aside className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', maxHeight: '72vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong>{L('Bastidores ao Vivo', 'Live Wiretap')}</strong>
              <span className="muted small">{wiretapFeed.length}</span>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {wiretapFeed.length === 0 ? (
                <div className="muted small">{L('Nenhuma atividade recente neste Squad.', 'No recent activity in this Squad.')}</div>
              ) : (
                wiretapFeed.map((m) => {
                  const ag = m.author.kind === 'agent' ? agents.find((a) => a.id === m.author.id) : undefined
                  if (!ag) return null
                  return (
                    <div key={m.id} style={{ padding: 8, borderRadius: 8, background: 'var(--bg-2, rgba(255,255,255,0.03))', fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <AgentAvatar agent={ag} size={16} busy={m.run?.status === 'working'} />
                        <strong>{ag.name}</strong>
                        <span className="muted" style={{ marginLeft: 'auto' }}>{time(m.at)}</span>
                      </div>
                      <div className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.text || (m.run?.status === 'working' ? L('Trabalhando…', 'Working…') : '')}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        </div>
      ) : (
        <>
          <section className="stage-setup card">
            <div className="stage-setup__row">
              <input
                type="text"
                className="input stage-setup__topic"
                placeholder={L('Tema ou pergunta para os agentes debaterem…', 'Topic or question for the agents to debate…')}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) void handleStart()
                }}
              />
              <select className="input" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} style={{ width: 130 }}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    {r} {L(r === 1 ? 'rodada' : 'rodadas', r === 1 ? 'round' : 'rounds')}
                  </option>
                ))}
              </select>
              {projects.length > 0 && (
                <select className="input" value={project} onChange={(e) => setProject(e.target.value)} style={{ width: 180 }}>
                  <option value="">{L('Sem pasta de projeto', 'No project folder')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.project!}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="btn btn--primary"
                disabled={!topic.trim() || selectedIds.length < 2}
                onClick={() => void handleStart()}
              >
                <Icon name="spark" size={14} /> {L('Iniciar Debate', 'Start Debate')}
              </button>
            </div>

            <div className="stage-setup__agents">
              <span className="muted small">{L('Participantes (mín. 2):', 'Participants (min. 2):')}</span>
              {agents.map((a) => {
                const on = selectedIds.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`stage-agent-chip ${on ? 'is-on' : ''}`}
                    onClick={() => toggleAgent(a.id)}
                  >
                    <AgentAvatar agent={a} size={18} />
                    <span>{a.name}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {stages.length > 1 && (
            <div className="stage-history">
              {stages.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className={`stage-history__tab ${activeConv?.id === st.id ? 'is-active' : ''}`}
                  onClick={() => setActiveId(st.id)}
                >
                  {st.name.replace(/^Palco:\s*/i, '')}
                </button>
              ))}
            </div>
          )}

          {activeConv ? (
            <div className="stage-arena">
              <div className="stage-cast">
                {activeConv.members.map((mid) => {
                  const ag = allAgents.find((a) => a.id === mid)
                  if (!ag) return null
                  const speaking = workingAgentId === ag.id
                  return (
                    <div key={ag.id} className={`stage-cast__card ${speaking ? 'is-speaking' : ''}`}>
                      <AgentAvatar agent={ag} size={32} busy={speaking} />
                      <div>
                        <div className="stage-cast__name">{ag.name}</div>
                        <div className="muted small">{speaking ? L('Falando agora…', 'Speaking now…') : ag.role}</div>
                      </div>
                    </div>
                  )
                })}
                {workingMsg && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => stopRun(workingMsg.id)}>
                    <Icon name="stop" size={13} /> {L('Parar fala atual', 'Stop current turn')}
                  </button>
                )}
              </div>

              <div className="stage-feed">
                {messages.map((m) => {
                  const ag = m.author.kind === 'agent' ? agentById({ agents: allAgents } as Parameters<typeof agentById>[0], m.author.id) : undefined
                  return (
                    <div key={m.id} className={`stage-msg ${ag ? 'stage-msg--agent' : 'stage-msg--me'}`}>
                      <div className="stage-msg__head">
                        {ag ? <AgentAvatar agent={ag} size={22} busy={m.run?.status === 'working'} /> : <Icon name="user" size={16} />}
                        <strong>{ag ? ag.name : L('Você (Moderador)', 'You (Moderator)')}</strong>
                        <span className="muted small">{time(m.at)}</span>
                      </div>
                      <div className="md stage-msg__body">
                        <Markdown remarkPlugins={[remarkGfm]}>{m.text || (m.run?.status === 'working' ? L('Pensando…', 'Thinking…') : '')}</Markdown>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="stage-intervene">
                <input
                  type="text"
                  className="input"
                  placeholder={L('Intervir no debate (use @nome para direcionar ou mande para todos)…', 'Intervene in the debate (use @name or send to all)…')}
                  value={intervene}
                  onChange={(e) => setIntervene(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) handleIntervene()
                  }}
                />
                <button type="button" className="btn btn--primary" onClick={handleIntervene} disabled={!intervene.trim()}>
                  {L('Enviar', 'Send')}
                </button>
              </div>
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 40 }}>
              <Icon name="spark" size={24} />
              <p>{L('Nenhum debate ativo ainda.', 'No active debate yet.')}</p>
              <p className="muted">{L('Escolha um tema e pelo menos 2 agentes acima para começar.', 'Pick a topic and at least 2 agents above to begin.')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OfficeDesk({
  agent,
  activity,
  isChief
}: {
  agent: ReturnType<typeof useStore<ReturnType<typeof isTeam> extends boolean ? never : never>> extends never ? never : import('../store').Agent
  activity?: { status: 'working' | 'waiting' | 'idle'; label: string; at: number }
  isChief?: boolean
}): ReactNode {
  const working = activity?.status === 'working'
  const waiting = activity?.status === 'waiting'
  return (
    <div
      className={`card office-desk ${working ? 'is-speaking' : ''}`}
      style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
      onClick={() => void openDm(agent.id)}
      title={L(`Abrir chat com ${agent.name}`, `Open chat with ${agent.name}`)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AgentAvatar agent={agent} size={32} busy={working} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</strong>
            {isChief && <span className="tag">{L('Líder', 'Chief')}</span>}
          </div>
          <div className="muted small" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agent.role}
          </div>
        </div>
      </div>
      <div className="small" style={{ color: working ? 'var(--accent)' : waiting ? 'var(--warn, #eab308)' : 'var(--muted)' }}>
        {working ? `● ${activity.label}` : waiting ? `◐ ${activity.label}` : `○ ${L('Livre', 'Idle')}`}
      </div>
    </div>
  )
}
