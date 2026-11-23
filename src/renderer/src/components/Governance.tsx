import { useState, useMemo, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  type Agent,
  navigate,
  navigateBack,
  openDm,
  openTuca,
  patchAgent,
  saveSquad,
  removeSquad,
  useStore,
  newAgentDraft
} from '../store'
import { AgentAvatar, Icon, MeAvatar, TucaMark } from './ui'

export type GovViewMode = 'people' | 'groups'

interface DepartmentMeta {
  id: string
  name: string
  color: string
  icon: string
  bgColor: string
}

const PALETTE: Array<{ color: string; bgColor: string }> = [
  { color: '#a3e635', bgColor: 'rgba(163, 230, 53, 0.14)' },
  { color: '#22d3ee', bgColor: 'rgba(34, 211, 238, 0.14)' },
  { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.14)' },
  { color: '#f43f5e', bgColor: 'rgba(244, 63, 94, 0.14)' },
  { color: '#c084fc', bgColor: 'rgba(192, 132, 252, 0.14)' },
  { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.14)' },
  { color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.14)' }
]

const hashColor = (name: string): { color: string; bgColor: string } => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

const getDeptMeta = (name?: string): DepartmentMeta => {
  const clean = name?.trim() || 'Geral'
  const c = hashColor(clean.toLowerCase())
  return { id: clean, name: clean, color: c.color, icon: 'folder', bgColor: c.bgColor }
}

export function GovernancePage(): ReactNode {
  const agents = useStore((s) => s.agents)
  const squads = useStore((s) => s.squads)
  const me = useStore((s) => s.me)
  const view = useStore((s) => s.view)
  const initialFocusId = view?.kind === 'governance' ? view.focusAgentId : undefined

  const [mode, setMode] = useState<GovViewMode>('people')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(() => {
    if (initialFocusId) return agents.find((a) => a.id === initialFocusId) ?? null
    return null
  })
  const [newTeamModalOpen, setNewTeamModalOpen] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDirectorId, setNewTeamDirectorId] = useState('')

  // Drag-and-drop state
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string): void => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Fante: bot creator & architect
  const fante = useMemo(() => {
    return agents.find((a) => a.kind === 'tuca' || a.handle === 'fante')
  }, [agents])

  // Active non-Fante agents
  const teamAgents = useMemo(() => {
    return agents.filter((a) => !a.archived && a.id !== fante?.id && a.kind !== 'tuca')
  }, [agents, fante])

  // Modular Teams / Squads: union of saved squads and distinct agent.department values
  const modularTeams = useMemo(() => {
    const teamNames = new Set<string>()
    for (const sq of squads) if (sq.name.trim()) teamNames.add(sq.name.trim())
    for (const a of teamAgents) if (a.department?.trim()) teamNames.add(a.department.trim())
    if (teamNames.size === 0) teamNames.add('Geral')

    return Array.from(teamNames).map((teamName) => {
      const sq = squads.find((s) => s.name.toLowerCase() === teamName.toLowerCase())
      const members = teamAgents.filter(
        (a) => (a.department?.trim() || 'Geral').toLowerCase() === teamName.toLowerCase()
      )
      // Find the Director of this team:
      // 1) sq.chiefId, 2) agent whose id/name is referenced by others' reportsTo/responsible,
      // 3) agent with responsible === 'Você (Fundador)' or reportsTo === 'founder', 4) first member
      let director: Agent | undefined = sq?.chiefId ? members.find((m) => m.id === sq.chiefId) : undefined
      if (!director) {
        director = members.find((m) =>
          members.some(
            (other) =>
              other.id !== m.id &&
              (other.reportsTo === m.id ||
                other.responsible?.toLowerCase() === m.name.toLowerCase() ||
                other.responsible?.toLowerCase() === m.handle.toLowerCase())
          )
        )
      }
      if (!director && members.length > 0) {
        director = members.find((m) => m.isChiefOfStaff) ?? members[0]
      }
      const subordinates = members.filter((m) => m.id !== director?.id)
      return {
        teamName,
        squad: sq,
        director,
        subordinates,
        members
      }
    })
  }, [squads, teamAgents])

  const allTeamNames = useMemo(() => modularTeams.map((t) => t.teamName), [modularTeams])

  const handleDropOnTeam = (teamName: string, director?: Agent): void => {
    if (!draggedAgentId) return
    const agent = agents.find((a) => a.id === draggedAgentId)
    if (!agent) return

    const isDirector = director?.id === agent.id
    patchAgent(agent.id, {
      department: teamName,
      responsible: isDirector ? 'Você (Fundador)' : (director?.name ?? 'Você (Fundador)'),
      reportsTo: isDirector ? undefined : director?.id,
      responsibleRole: isDirector ? 'Diretor' : teamName
    })

    // Also keep squad record in sync if one exists
    const sq = squads.find((s) => s.name.toLowerCase() === teamName.toLowerCase())
    if (sq && !sq.agentIds.includes(agent.id)) {
      void saveSquad({ ...sq, agentIds: [...sq.agentIds, agent.id] })
    }

    showToast(
      L(
        `✨ ${agent.name} agora faz parte da equipe ${teamName}${director && !isDirector ? ` (responde a ${director.name})` : ''}!`,
        `✨ ${agent.name} is now in ${teamName}!`
      )
    )
    setDraggedAgentId(null)
    setDragOverTeam(null)
  }

  const handleMakeDirector = (teamName: string, newDirector: Agent, members: Agent[]): void => {
    patchAgent(newDirector.id, {
      department: teamName,
      responsible: 'Você (Fundador)',
      reportsTo: undefined,
      responsibleRole: 'Diretor'
    })
    for (const m of members) {
      if (m.id !== newDirector.id) {
        patchAgent(m.id, {
          department: teamName,
          responsible: newDirector.name,
          reportsTo: newDirector.id,
          responsibleRole: teamName
        })
      }
    }
    const sq = squads.find((s) => s.name.toLowerCase() === teamName.toLowerCase())
    if (sq) {
      void saveSquad({ ...sq, chiefId: newDirector.id })
    }
    showToast(L(`👑 ${newDirector.name} agora é o Diretor da equipe ${teamName}!`, `👑 ${newDirector.name} is now Director of ${teamName}!`))
  }

  const handleCreateTeam = async (): Promise<void> => {
    const clean = newTeamName.trim()
    if (!clean) return
    const dir = teamAgents.find((a) => a.id === newTeamDirectorId)
    await saveSquad({
      id: '',
      name: clean,
      mode: 'hierarchical',
      autonomy: 'autonomous',
      chiefId: dir?.id,
      agentIds: dir ? [dir.id] : []
    })
    if (dir) {
      patchAgent(dir.id, {
        department: clean,
        responsible: 'Você (Fundador)',
        reportsTo: undefined,
        responsibleRole: 'Diretor'
      })
    }
    setNewTeamName('')
    setNewTeamDirectorId('')
    setNewTeamModalOpen(false)
    showToast(L(`✨ Equipe ${clean} criada!`, `✨ Team ${clean} created!`))
  }

  return (
    <div className="gov-page">
      <header className="gov-header">
        <div className="gov-header__left">
          <button
            className="btn btn--sm gov-back-btn"
            onClick={navigateBack}
            title={L('Voltar para a tela anterior', 'Back to previous view')}
          >
            <Icon name="back" size={14} />
            <span>{L('Voltar', 'Back')}</span>
          </button>

          <div className="gov-header__title-group">
            <h1 className="gov-title">{L('Arquitetura de Equipes & Governança', 'Squad Architecture & Governance')}</h1>
            <p className="gov-subtitle">
              {L(
                `${modularTeams.length} ${modularTeams.length === 1 ? 'equipe modular' : 'equipes modulares'} · ${teamAgents.length} agentes ativos`,
                `${modularTeams.length} modular squads · ${teamAgents.length} active agents`
              )}
            </p>
          </div>
        </div>

        <div className="gov-header__actions">
          <div className="gov-pill-toggle">
            <button
              className={`gov-pill-btn ${mode === 'people' ? 'is-active' : ''}`}
              onClick={() => setMode('people')}
            >
              {L('Organograma', 'Org Chart')}
            </button>
            <button
              className={`gov-pill-btn ${mode === 'groups' ? 'is-active' : ''}`}
              onClick={() => setMode('groups')}
            >
              {L('Cards por Equipe', 'Squad Cards')}
            </button>
          </div>

          <button
            className="btn btn--sm gov-template-btn"
            onClick={() => setNewTeamModalOpen(true)}
          >
            <Icon name="plus" size={14} />
            <span>{L('Nova Equipe / Squad', 'New Team / Squad')}</span>
          </button>

          <button className="btn btn--sm btn--primary" onClick={openTuca}>
            <Icon name="spark" size={14} />
            <span>{L('Criar Bot com Fante', 'Create Bot with Fante')}</span>
          </button>
        </div>
      </header>

      <div className="gov-canvas">
        {mode === 'people' ? (
          <div className="gov-tree-container">
            {/* TOP LEVEL: Founder (You) + Fante (Bot Creator) side by side */}
            <div className="gov-root-wrapper">
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Founder Card */}
                <div className="gov-root-card" style={{ borderColor: 'var(--accent)' }}>
                  <div className="gov-root-avatar-wrap">
                    <MeAvatar initials={me.initials} size={38} />
                    <span className="gov-status-dot gov-status-dot--green" />
                  </div>
                  <div className="gov-root-info">
                    <div className="gov-root-name">{L('Você (Fundador)', 'You (Founder)')}</div>
                    <div className="gov-root-subtitle">{L('comando geral das equipes', 'overall command of all squads')}</div>
                  </div>
                </div>

                {/* Fante: Bot Creator & Right Hand */}
                <div
                  className="gov-root-card"
                  style={{ cursor: 'pointer', opacity: 0.95 }}
                  onClick={openTuca}
                  title={L('Clique para conversar com o Fante e criar novos bots', 'Click to talk to Fante and create new bots')}
                >
                  <div className="gov-root-avatar-wrap">
                    <TucaMark size={36} />
                    <span className="gov-status-dot gov-status-dot--green" />
                  </div>
                  <div className="gov-root-info">
                    <div className="gov-root-name">{fante?.name ?? 'Fante'}</div>
                    <div className="gov-root-subtitle">{L('criador de bots & arquiteto', 'bot creator & architect')}</div>
                  </div>
                </div>
              </div>

              <div className="gov-stem-vertical" />
            </div>

            {/* SECOND LEVEL: Modular Squads / Teams side by side */}
            <div className="gov-branch-container">
              <div className="gov-crossbar-line" />

              <div className="gov-leaders-row">
                {modularTeams.map((team) => {
                  const dept = getDeptMeta(team.teamName)
                  const isTarget = dragOverTeam === team.teamName
                  const dir = team.director

                  return (
                    <div
                      key={team.teamName}
                      className={`gov-leader-column ${isTarget ? 'is-drag-target' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverTeam !== team.teamName) setDragOverTeam(team.teamName)
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverTeam(null)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDropOnTeam(team.teamName, dir)
                      }}
                    >
                      <div className="gov-stem-to-leader" />

                      {/* Team Header + Director Card */}
                      <div
                        className="gov-leader-card"
                        style={{ borderColor: isTarget ? dept.color : undefined, minWidth: 230 }}
                      >
                        <div className="gov-dept-pill" style={{ backgroundColor: dept.bgColor, color: dept.color, marginBottom: 8 }}>
                          <span className="gov-dept-icon-dot" style={{ backgroundColor: dept.color }} />
                          <span style={{ fontWeight: 700 }}>{team.teamName}</span>
                        </div>

                        {dir ? (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                            onClick={() => setEditingAgent(dir)}
                            title={L(`Diretor da equipe ${team.teamName} · Clique para configurar`, `Director of ${team.teamName} · Click to configure`)}
                          >
                            <AgentAvatar agent={dir} size={32} />
                            <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <strong style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dir.name}</strong>
                                <span className="tag" style={{ fontSize: 10, padding: '1px 5px' }}>{L('Diretor', 'Director')}</span>
                              </div>
                              <div className="muted small" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {dir.role || L('Coordenação da equipe', 'Squad Director')}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="muted small" style={{ padding: '6px 0' }}>
                            {L('Sem diretor definido ainda', 'No director assigned yet')}
                          </div>
                        )}

                        {isTarget && (
                          <div className="gov-drop-hint" style={{ color: dept.color }}>
                            {L(`Soltar na equipe ${team.teamName}`, `Drop into ${team.teamName}`)}
                          </div>
                        )}
                      </div>

                      <div className="gov-stem-under-leader" />

                      {/* Subordinates in this Team */}
                      <div className="gov-agent-leaves-list">
                        {team.subordinates.map((agent) => {
                          const isBeingDragged = draggedAgentId === agent.id
                          return (
                            <div
                              key={agent.id}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', agent.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setDraggedAgentId(agent.id)
                              }}
                              onDragEnd={() => {
                                setDraggedAgentId(null)
                                setDragOverTeam(null)
                              }}
                              className={`gov-agent-leaf-card ${isBeingDragged ? 'is-dragging' : ''}`}
                              onClick={() => setEditingAgent(agent)}
                              title={L(`Responde a ${dir?.name ?? 'Você'} · Arraste para mover ou clique para editar`, `Reports to ${dir?.name ?? 'You'} · Drag to move or click to edit`)}
                            >
                              <span className="gov-drag-grip">⋮⋮</span>
                              <div className="gov-agent-avatar-wrap">
                                <AgentAvatar agent={agent} size={28} />
                              </div>
                              <div className="gov-agent-leaf-info">
                                <div className="gov-agent-leaf-name">{agent.name}</div>
                                <div className="gov-agent-leaf-role">
                                  {agent.role || L('Especialista', 'Specialist')}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="icon-btn icon-btn--sm"
                                title={L(`Tornar ${agent.name} Diretor de ${team.teamName}`, `Make ${agent.name} Director of ${team.teamName}`)}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMakeDirector(team.teamName, agent, team.members)
                                }}
                              >
                                <Icon name="spark" size={12} />
                              </button>
                            </div>
                          )
                        })}

                        <button
                          className="gov-add-leaf-btn"
                          onClick={() => {
                            const draft = newAgentDraft()
                            draft.department = team.teamName
                            draft.responsible = dir ? dir.name : 'Você (Fundador)'
                            draft.reportsTo = dir?.id
                            draft.responsibleRole = dir ? team.teamName : 'Diretor'
                            navigate({ kind: 'new-agent', draft })
                          }}
                          title={L(`Criar novo bot na equipe ${team.teamName}`, `Create new bot in ${team.teamName}`)}
                        >
                          <Icon name="plus" size={12} />
                          <span>{L(`+ Bot em ${team.teamName}`, `+ Bot in ${team.teamName}`)}</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="gov-departments-grid">
            {modularTeams.map((team) => {
              const dept = getDeptMeta(team.teamName)
              const isTargetDept = dragOverTeam === team.teamName

              return (
                <div
                  key={team.teamName}
                  className={`gov-dept-card ${isTargetDept ? 'is-drag-target' : ''}`}
                  style={{ borderColor: isTargetDept ? dept.color : undefined }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverTeam(team.teamName)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverTeam(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropOnTeam(team.teamName, team.director)
                  }}
                >
                  <div className="gov-dept-card__header">
                    <div className="gov-dept-badge" style={{ backgroundColor: dept.bgColor, color: dept.color }}>
                      <span className="gov-dept-icon-dot" style={{ backgroundColor: dept.color }} />
                      <span className="gov-dept-name">{team.teamName}</span>
                    </div>
                    <span className="gov-dept-count">
                      {team.members.length} {team.members.length === 1 ? L('agente', 'agent') : L('agentes', 'agents')}
                    </span>
                    {team.squad && team.members.length === 0 && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        title={L('Remover equipe vazia', 'Remove empty squad')}
                        onClick={() => removeSquad(team.squad!.id)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </div>

                  {team.director && (
                    <div className="gov-dept-leaders">
                      <span className="gov-dept-leaders__label">{L('Diretor da Equipe:', 'Squad Director:')}</span>
                      <div className="gov-dept-leaders__tags">
                        <span className="gov-leader-tag">👑 {team.director.name}</span>
                      </div>
                    </div>
                  )}

                  <div className="gov-dept-agents-list">
                    {team.members.map((agent) => {
                      const isDir = team.director?.id === agent.id
                      return (
                        <div
                          key={agent.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', agent.id)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggedAgentId(agent.id)
                          }}
                          onDragEnd={() => {
                            setDraggedAgentId(null)
                            setDragOverTeam(null)
                          }}
                          className={`gov-dept-agent-row ${draggedAgentId === agent.id ? 'is-dragging' : ''}`}
                          onClick={() => setEditingAgent(agent)}
                        >
                          <span className="gov-drag-grip">⋮⋮</span>
                          <AgentAvatar agent={agent} size={28} />
                          <div className="gov-dept-agent-info">
                            <span className="gov-dept-agent-name">{agent.name}</span>
                            <span className="gov-dept-agent-role">{agent.role || L('Especialista', 'Specialist')}</span>
                          </div>
                          <span className="gov-dept-agent-resp">
                            {isDir ? L('👑 Diretor', '👑 Director') : `${L('Responde a', 'Reports to')} ${team.director?.name ?? 'Você'}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    className="btn btn--sm gov-dept-add-btn"
                    onClick={() => {
                      const draft = newAgentDraft()
                      draft.department = team.teamName
                      draft.responsible = team.director ? team.director.name : 'Você (Fundador)'
                      draft.reportsTo = team.director?.id
                      navigate({ kind: 'new-agent', draft })
                    }}
                  >
                    <Icon name="plus" size={13} />
                    <span>{L(`Novo bot em ${team.teamName}`, `New bot in ${team.teamName}`)}</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="gov-toast">
          <Icon name="spark" size={15} />
          <span>{toastMessage}</span>
        </div>
      )}

      {editingAgent && (
        <EditHierarchyModal
          agent={editingAgent}
          allAgents={teamAgents}
          teamNames={allTeamNames}
          onClose={() => setEditingAgent(null)}
        />
      )}

      {newTeamModalOpen && (
        <div className="gov-modal-backdrop" onClick={() => setNewTeamModalOpen(false)}>
          <div className="gov-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gov-modal__header">
              <div>
                <h2 className="gov-modal__title">{L('Nova Equipe / Squad Modular', 'New Modular Team / Squad')}</h2>
                <span className="gov-modal__subtitle">{L('Ex.: Little Faith Squad, romei.ro, Atendimento Clientes…', 'E.g. Little Faith Squad, romei.ro, Client Support…')}</span>
              </div>
              <button className="icon-btn" onClick={() => setNewTeamModalOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="gov-modal__body">
              <div className="gov-form-group">
                <label className="gov-label">{L('Nome da Equipe / Empresa / Projeto', 'Team / Company / Project Name')}</label>
                <input
                  className="gov-input"
                  value={newTeamName}
                  placeholder={L('Ex.: romei.ro', 'E.g. romei.ro')}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="gov-form-group">
                <label className="gov-label">{L('Diretor da Equipe (opcional)', 'Team Director (optional)')}</label>
                <select
                  className="gov-input"
                  value={newTeamDirectorId}
                  onChange={(e) => setNewTeamDirectorId(e.target.value)}
                >
                  <option value="">{L('Escolher depois / Criar novo bot', 'Pick later / Create new bot')}</option>
                  {teamAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role || a.department || 'Bot'})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="gov-modal__footer">
              <div className="gov-modal__footer-right">
                <button className="btn btn--sm" onClick={() => setNewTeamModalOpen(false)}>{L('Cancelar', 'Cancel')}</button>
                <button className="btn btn--sm btn--primary" disabled={!newTeamName.trim()} onClick={() => void handleCreateTeam()}>
                  {L('Criar Equipe', 'Create Team')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditHierarchyModal({
  agent,
  allAgents,
  teamNames,
  onClose
}: {
  agent: Agent
  allAgents: Agent[]
  teamNames: string[]
  onClose: () => void
}): ReactNode {
  const [department, setDepartment] = useState(agent.department ?? teamNames[0] ?? 'Little Faith Squad')
  const [reportsToId, setReportsToId] = useState(agent.reportsTo ?? '')
  const [role, setRole] = useState(agent.role ?? '')

  const possibleLeaders = useMemo(() => {
    return allAgents.filter((a) => a.id !== agent.id)
  }, [allAgents, agent.id])

  const handleSave = (): void => {
    const cleanTeam = department.trim() || 'Geral'
    const leaderBot = allAgents.find((a) => a.id === reportsToId)
    patchAgent(agent.id, {
      department: cleanTeam,
      reportsTo: leaderBot ? leaderBot.id : undefined,
      responsible: leaderBot ? leaderBot.name : 'Você (Fundador)',
      responsibleRole: leaderBot ? cleanTeam : 'Diretor',
      role: role.trim() || undefined
    })
    onClose()
  }

  return (
    <div className="gov-modal-backdrop" onClick={onClose}>
      <div className="gov-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gov-modal__header">
          <div className="gov-modal__agent-preview">
            <AgentAvatar agent={agent} size={36} />
            <div>
              <h2 className="gov-modal__title">{agent.name}</h2>
              <span className="gov-modal__subtitle">@{agent.handle}</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gov-modal__body">
          <div className="gov-form-group">
            <label className="gov-label">{L('Equipe / Squad (ou digite uma nova)', 'Team / Squad (or type a new one)')}</label>
            <input
              className="gov-input"
              value={department}
              placeholder={L('Ex.: Little Faith Squad, romei.ro…', 'E.g. Little Faith Squad, romei.ro…')}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <div className="gov-quick-pills" style={{ marginTop: 6 }}>
              {teamNames.map((tName) => (
                <button
                  key={tName}
                  type="button"
                  className={`gov-mini-pill ${department.toLowerCase() === tName.toLowerCase() ? 'is-selected' : ''}`}
                  onClick={() => setDepartment(tName)}
                >
                  {tName}
                </button>
              ))}
            </div>
          </div>

          <div className="gov-form-group">
            <label className="gov-label">{L('A quem este agente responde?', 'Who does this agent report to?')}</label>
            <select
              className="gov-input"
              value={reportsToId}
              onChange={(e) => setReportsToId(e.target.value)}
            >
              <option value="">{L('👑 Direto a Você (Fundador) — Diretor desta Equipe', '👑 Directly to You (Founder) — Director of this Team')}</option>
              {possibleLeaders.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name} ({lead.department || 'Geral'} · {lead.role || 'Bot'})
                </option>
              ))}
            </select>
          </div>

          <div className="gov-form-group">
            <label className="gov-label">{L('Função Específica na Equipe', 'Specific Role in Team')}</label>
            <input
              className="gov-input"
              value={role}
              placeholder={L('Ex.: Diretor de Produção, Roteiro, Arte, Tech Lead, Dev…', 'E.g. Production Director, Script, Art, Tech Lead, Dev…')}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
        </div>

        <div className="gov-modal__footer">
          <div className="gov-modal__footer-left">
            <button
              className="btn btn--sm"
              onClick={() => {
                onClose()
                navigate({ kind: 'agent', id: agent.id })
              }}
            >
              <Icon name="gear" size={13} />
              <span>{L('Configurar Agente', 'Agent Settings')}</span>
            </button>
            <button
              className="btn btn--sm"
              onClick={() => {
                onClose()
                void openDm(agent.id)
              }}
            >
              <Icon name="message" size={13} />
              <span>{L('Abrir Chat', 'Open Chat')}</span>
            </button>
          </div>

          <div className="gov-modal__footer-right">
            <button className="btn btn--sm" onClick={onClose}>{L('Cancelar', 'Cancel')}</button>
            <button className="btn btn--sm btn--primary" onClick={handleSave}>{L('Salvar', 'Save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
