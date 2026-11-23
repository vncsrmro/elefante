import { useState, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { call } from '../rpc'
import { agentById, isTeam, sendMessage, stopRun, useStore } from '../store'
import { AgentAvatar, Icon, time } from './ui'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function StagePage(): ReactNode {
  const agents = useStore((s) => s.agents.filter(isTeam))
  const stages = useStore((s) => s.conversations.filter((c) => c.topic === '__stage__'))
  const projects = useStore((s) => s.conversations.filter((c) => c.kind === 'channel' && !!c.project && c.topic !== '__stage__'))

  const [activeId, setActiveId] = useState<string | null>(() => stages[stages.length - 1]?.id ?? null)
  const [topic, setTopic] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(() => agents.slice(0, 3).map((a) => a.id))
  const [rounds, setRounds] = useState(2)
  const [project, setProject] = useState<string>('')
  const [intervene, setIntervene] = useState('')

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
      <header className="page__head">
        <div>
          <h1>{L('Palco de Agentes', 'Agent Stage')}</h1>
          <p className="muted">
            {L('Coloque seus agentes para debater um tema em rodadas, comparar ideias e chegar a uma conclusão.', 'Put your agents on stage to debate a topic in rounds, compare ideas, and reach a conclusion.')}
          </p>
        </div>
      </header>

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
    </div>
  )
}
