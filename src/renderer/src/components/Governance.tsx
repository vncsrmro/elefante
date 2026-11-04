import { useState, useMemo, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  type Agent,
  isTeam,
  navigate,
  navigateBack,
  openDm,
  openTuca,
  patchAgent,
  useStore,
  newAgentDraft
} from '../store'
import { AgentAvatar, Icon, TucaMark } from './ui'

export type GovViewMode = 'people' | 'groups'

interface DepartmentMeta {
  id: string
  name: string
  color: string
  icon: string
  bgColor: string
}

export const DEPARTMENTS: DepartmentMeta[] = [
  { id: 'Engenharia', name: 'Engenharia', color: '#22d3ee', icon: 'code', bgColor: 'rgba(34, 211, 238, 0.12)' },
  { id: 'Produto', name: 'Produto', color: '#10b981', icon: 'compass', bgColor: 'rgba(16, 185, 129, 0.12)' },
  { id: 'Vendas', name: 'Vendas', color: '#f59e0b', icon: 'briefcase', bgColor: 'rgba(245, 158, 11, 0.12)' },
  { id: 'Suporte', name: 'Suporte', color: '#f43f5e', icon: 'lifeBuoy', bgColor: 'rgba(244, 63, 94, 0.12)' },
  { id: 'Financeiro', name: 'Financeiro', color: '#eab308', icon: 'creditCard', bgColor: 'rgba(234, 179, 8, 0.12)' },
  { id: 'Admin', name: 'Admin', color: '#818cf8', icon: 'shield', bgColor: 'rgba(129, 140, 248, 0.12)' },
  { id: 'Operações', name: 'Operações', color: '#14b8a6', icon: 'sliders', bgColor: 'rgba(20, 184, 166, 0.12)' },
  { id: 'Dono', name: 'Dono', color: '#c084fc', icon: 'crown', bgColor: 'rgba(192, 132, 252, 0.12)' }
]

const getDeptMeta = (name?: string): DepartmentMeta => {
  if (!name) return { id: 'Geral', name: 'Geral', color: '#94a3b8', icon: 'folder', bgColor: 'rgba(148, 163, 184, 0.12)' }
  const found = DEPARTMENTS.find((d) => d.id.toLowerCase() === name.toLowerCase() || d.name.toLowerCase() === name.toLowerCase())
  if (found) return found
  return { id: name, name, color: '#38bdf8', icon: 'tag', bgColor: 'rgba(56, 189, 248, 0.12)' }
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function GovernancePage(): ReactNode {
  const agents = useStore((s) => s.agents)
  const view = useStore((s) => s.view)
  const initialFocusId = view?.kind === 'governance' ? view.focusAgentId : undefined

  const [mode, setMode] = useState<GovViewMode>('people')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(() => {
    if (initialFocusId) {
      return agents.find((a) => a.id === initialFocusId) ?? null
    }
    return null
  })
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [showGuide, setShowGuide] = useState(true)

  // Drag-and-drop state
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null)
  const [dragOverLeader, setDragOverLeader] = useState<string | null>(null)
  const [dragOverChief, setDragOverChief] = useState(false)
  const [dragOverDept, setDragOverDept] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string): void => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Identify Chief of Staff (Braço Direito)
  const chief = useMemo(() => {
    const designated = agents.find((a) => a.isChiefOfStaff)
    if (designated) return designated
    const fante = agents.find((a) => a.kind === 'tuca' || a.handle === 'fante')
    if (fante) return fante
    return agents[0]
  }, [agents])

  // Non-chief active agents
  const teamAgents = useMemo(() => {
    return agents.filter((a) => !a.archived && a.id !== chief?.id)
  }, [agents, chief])

  // Group by Leader / Responsible person
  const leaderGroups = useMemo(() => {
    const map = new Map<string, { leaderName: string; department: string; role: string; agents: Agent[] }>()

    for (const a of teamAgents) {
      const leaderName = a.responsible || a.reportsTo || 'Você (Fundador)'
      const department = a.department || a.responsibleRole || 'Operações'
      const role = a.responsibleRole || department

      const key = `${leaderName}::${department}`
      if (!map.has(key)) {
        map.set(key, { leaderName, department, role, agents: [] })
      }
      map.get(key)!.agents.push(a)
    }

    return Array.from(map.values())
  }, [teamAgents])

  // Group by Department
  const departmentGroups = useMemo(() => {
    const map = new Map<string, { department: string; agents: Agent[]; leaders: Set<string> }>()

    for (const a of teamAgents) {
      const department = a.department || 'Operações'
      if (!map.has(department)) {
        map.set(department, { department, agents: [], leaders: new Set() })
      }
      const g = map.get(department)!
      g.agents.push(a)
      if (a.responsible) g.leaders.add(a.responsible)
    }

    return Array.from(map.values())
  }, [teamAgents])

  const totalBotsCount = (chief ? 1 : 0) + teamAgents.length
  const totalLeadersCount = Math.max(1, leaderGroups.length)

  // Drag and drop handlers
  const handleDropOnLeader = (leaderName: string, department: string, role: string): void => {
    if (!draggedAgentId) return
    const agent = agents.find((a) => a.id === draggedAgentId)
    if (!agent) return

    patchAgent(agent.id, {
      responsible: leaderName,
      department: department,
      responsibleRole: role,
      isChiefOfStaff: false
    })

    showToast(L(`✨ ${agent.name} agora responde a ${leaderName} (${department})!`, `✨ ${agent.name} now reports to ${leaderName} (${department})!`))
    setDraggedAgentId(null)
    setDragOverLeader(null)
  }

  const handleDropOnChief = (): void => {
    if (!draggedAgentId) return
    const agent = agents.find((a) => a.id === draggedAgentId)
    if (!agent) return

    for (const a of agents) {
      if (a.id !== agent.id && a.isChiefOfStaff) {
        patchAgent(a.id, { isChiefOfStaff: false })
      }
    }

    patchAgent(agent.id, {
      isChiefOfStaff: true,
      department: 'Executivo',
      role: agent.role || 'Braço Direito'
    })

    showToast(L(`⭐ ${agent.name} foi definido como o Braço Direito da empresa!`, `⭐ ${agent.name} is now the Chief of Staff!`))
    setDraggedAgentId(null)
    setDragOverChief(false)
  }

  const handleDropOnDept = (deptName: string): void => {
    if (!draggedAgentId) return
    const agent = agents.find((a) => a.id === draggedAgentId)
    if (!agent) return

    patchAgent(agent.id, {
      department: deptName
    })

    showToast(L(`✨ ${agent.name} transferido para o setor de ${deptName}!`, `✨ ${agent.name} moved to ${deptName}!`))
    setDraggedAgentId(null)
    setDragOverDept(null)
  }

  return (
    <div className="gov-page">
      {/* Top Header with Back Button and Mode Toggle */}
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
            <h1 className="gov-title">{L('Quem cuida de quem', 'Who manages who')}</h1>
            <p className="gov-subtitle">
              {L(
                `${totalBotsCount} agentes e as ${totalLeadersCount} pessoas responsáveis por eles`,
                `${totalBotsCount} agents and the ${totalLeadersCount} people responsible for them`
              )}
            </p>
          </div>
        </div>

        <div className="gov-header__actions">
          {/* View Mode Toggle Pill */}
          <div className="gov-pill-toggle">
            <button
              className={`gov-pill-btn ${mode === 'people' ? 'is-active' : ''}`}
              onClick={() => setMode('people')}
            >
              {L('Por pessoa', 'By person')}
            </button>
            <button
              className={`gov-pill-btn ${mode === 'groups' ? 'is-active' : ''}`}
              onClick={() => setMode('groups')}
            >
              {L('Por grupo', 'By group')}
            </button>
          </div>

          <button
            className="btn btn--sm gov-template-btn"
            title={L('Estruturar equipes recomendadas para empresas autônomas', 'Structure recommended autonomous squads')}
            onClick={() => setTemplateModalOpen(true)}
          >
            <Icon name="sitemap" size={14} />
            <span>{L('Estruturar Equipe', 'Structure Team')}</span>
          </button>

          <button className="btn btn--sm btn--primary" onClick={openTuca}>
            <Icon name="plus" size={14} />
            <span>{L('Novo Bot', 'New Bot')}</span>
          </button>
        </div>
      </header>

      {/* Philosophy & Autonomous Squad Guidance Card */}
      {showGuide && (
        <div className="gov-guide-banner">
          <div className="gov-guide-banner__content">
            <div className="gov-guide-banner__badge">
              <span>{L('GOVERNANÇA & AUTONOMIA · ARRASTE E SOLTE ATIVADO', 'GOVERNANCE & AUTONOMY · DRAG & DROP ENABLED')}</span>
            </div>
            <h3 className="gov-guide-banner__heading">
              {L('O Teste dos 2 Dias Off: sua empresa roda sem você?', 'The 2-Day Off Test: does your business run without you?')}
            </h3>
            <p className="gov-guide-banner__text">
              {L(
                'Muitos criam bots soltos sem hierarquia e continuam sobrecarregados. Para ter uma empresa autônoma que não para se você ficar 2 dias offline, estruture quem cuida de quem: 1 Braço Direito geral (Fante), líderes para cada setor e bots com rotinas bem definidas. Arraste qualquer bot para mudar seu líder na hora!',
                'Many deploy isolated bots without hierarchy and remain overwhelmed. To build an autonomous business that keeps running if you go offline for 2 days, assign who manages who: 1 Chief of Staff (Fante), leads per area, and bots with routines. Drag and drop any bot to reassign instantly!'
              )}
            </p>
          </div>
          <div className="gov-guide-banner__actions">
            <button className="btn btn--sm btn--primary" onClick={() => setTemplateModalOpen(true)}>
              {L('✨ Aplicar Squad Recomendado', '✨ Apply Recommended Squad')}
            </button>
            <button className="icon-btn icon-btn--sm" onClick={() => setShowGuide(false)} title={L('Fechar', 'Close')}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Scroll Area */}
      <div className="gov-canvas">
        {mode === 'people' ? (
          <div className="gov-tree-container">
            {/* Root Node: Chief of Staff / Braço Direito (Drop Zone) */}
            <div className="gov-root-wrapper">
              <div
                className={`gov-root-card ${dragOverChief ? 'is-drag-target' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverChief(true)
                }}
                onDragLeave={() => setDragOverChief(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDropOnChief()
                }}
                onClick={() => chief && setEditingAgent(chief)}
                title={L('Clique para configurar ou solte um bot aqui para torná-lo Braço Direito', 'Click to configure or drop an agent here to make it Chief of Staff')}
              >
                <div className="gov-root-avatar-wrap">
                  {chief?.kind === 'tuca' ? (
                    <TucaMark size={36} />
                  ) : chief ? (
                    <AgentAvatar agent={chief} size={36} />
                  ) : (
                    <span className="gov-avatar-fallback">B</span>
                  )}
                  <span className="gov-status-dot gov-status-dot--green" />
                </div>
                <div className="gov-root-info">
                  <div className="gov-root-name">{chief ? chief.name : 'Fante'}</div>
                  <div className="gov-root-subtitle">
                    {dragOverChief ? L('⭐ Solte para definir como Braço Direito', '⭐ Drop to set as Chief of Staff') : L('seu braço direito', 'your chief of staff')}
                  </div>
                </div>
              </div>

              {/* Vertical connector dropping down from Root Card */}
              <div className="gov-stem-vertical" />
            </div>

            {/* Tree Branching Canvas */}
            {leaderGroups.length > 0 && (
              <div className="gov-branch-container">
                {/* Horizontal crossbar spanning across all leader nodes */}
                <div className="gov-crossbar-line" />

                {/* Grid row of leaders */}
                <div className="gov-leaders-row">
                  {leaderGroups.map((group, idx) => {
                    const dept = getDeptMeta(group.department)
                    const initials = getInitials(group.leaderName)
                    const isTarget = dragOverLeader === group.leaderName

                    return (
                      <div
                        key={idx}
                        className={`gov-leader-column ${isTarget ? 'is-drag-target' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragOverLeader !== group.leaderName) setDragOverLeader(group.leaderName)
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverLeader(null)
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          handleDropOnLeader(group.leaderName, group.department, group.role)
                        }}
                      >
                        {/* Vertical drop line from horizontal crossbar to leader card */}
                        <div className="gov-stem-to-leader" />

                        {/* Leader Card */}
                        <div
                          className="gov-leader-card"
                          style={{ borderColor: isTarget ? dept.color : undefined }}
                        >
                          <div className="gov-leader-card__top">
                            <div className="gov-initials-badge">
                              <span>{initials}</span>
                              <span className="gov-status-dot gov-status-dot--green" />
                            </div>
                          </div>

                          <div className="gov-leader-name">{group.leaderName}</div>

                          <div className="gov-dept-pill" style={{ backgroundColor: dept.bgColor, color: dept.color }}>
                            <span className="gov-dept-icon-dot" style={{ backgroundColor: dept.color }} />
                            <span>{dept.name}</span>
                          </div>

                          {isTarget && (
                            <div className="gov-drop-hint" style={{ color: dept.color }}>
                              {L('Soltar aqui', 'Drop here')}
                            </div>
                          )}
                        </div>

                        {/* Stem from Leader to Agents */}
                        <div className="gov-stem-under-leader" />

                        {/* Leaf Agent Cards attached under this leader (Draggable) */}
                        <div className="gov-agent-leaves-list">
                          {group.agents.map((agent) => {
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
                                  setDragOverLeader(null)
                                  setDragOverChief(false)
                                  setDragOverDept(null)
                                }}
                                className={`gov-agent-leaf-card ${isBeingDragged ? 'is-dragging' : ''}`}
                                onClick={() => setEditingAgent(agent)}
                                title={L(`Arraste para trocar de líder ou clique para editar ${agent.name}`, `Drag to reassign leader or click to edit ${agent.name}`)}
                              >
                                <span className="gov-drag-grip" title={L('Arraste para mover de responsável', 'Drag to reassign')}>
                                  ⋮⋮
                                </span>
                                <div className="gov-agent-avatar-wrap">
                                  <AgentAvatar agent={agent} size={28} />
                                </div>
                                <div className="gov-agent-leaf-info">
                                  <div className="gov-agent-leaf-name">{agent.name}</div>
                                  <div className="gov-agent-leaf-role">
                                    {agent.role || agent.department || L('Especialista', 'Specialist')}
                                  </div>
                                </div>
                                <div className="gov-agent-leaf-status">
                                  <span className={`gov-status-dot gov-status-dot--${agent.archived ? 'grey' : 'green'}`} />
                                </div>
                              </div>
                            )
                          })}

                          {/* Quick Add Agent under this leader */}
                          <button
                            className="gov-add-leaf-btn"
                            onClick={() => {
                              const draft = newAgentDraft()
                              draft.responsible = group.leaderName
                              draft.department = group.department
                              draft.responsibleRole = group.role
                              navigate({ kind: 'new-agent', draft })
                            }}
                            title={L(`Adicionar novo agente sob os cuidados de ${group.leaderName}`, `Add new agent under ${group.leaderName}`)}
                          >
                            <Icon name="plus" size={12} />
                            <span>{L('Atribuir bot', 'Assign bot')}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* "Por grupo" (By Department) View with Drag and Drop */
          <div className="gov-departments-grid">
            {departmentGroups.map((group, idx) => {
              const dept = getDeptMeta(group.department)
              const leaderList = Array.from(group.leaders)
              const isTargetDept = dragOverDept === group.department

              return (
                <div
                  key={idx}
                  className={`gov-dept-card ${isTargetDept ? 'is-drag-target' : ''}`}
                  style={{ borderColor: isTargetDept ? dept.color : undefined }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverDept(group.department)
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverDept(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDropOnDept(group.department)
                  }}
                >
                  <div className="gov-dept-card__header">
                    <div className="gov-dept-badge" style={{ backgroundColor: dept.bgColor, color: dept.color }}>
                      <span className="gov-dept-icon-dot" style={{ backgroundColor: dept.color }} />
                      <span className="gov-dept-name">{dept.name}</span>
                    </div>
                    <span className="gov-dept-count">
                      {group.agents.length} {group.agents.length === 1 ? L('agente', 'agent') : L('agentes', 'agents')}
                    </span>
                  </div>

                  {leaderList.length > 0 && (
                    <div className="gov-dept-leaders">
                      <span className="gov-dept-leaders__label">{L('Responsáveis:', 'Leaders:')}</span>
                      <div className="gov-dept-leaders__tags">
                        {leaderList.map((lead, lIdx) => (
                          <span key={lIdx} className="gov-leader-tag">
                            {lead}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="gov-dept-agents-list">
                    {group.agents.map((agent) => (
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
                          setDragOverDept(null)
                        }}
                        className={`gov-dept-agent-row ${draggedAgentId === agent.id ? 'is-dragging' : ''}`}
                        onClick={() => setEditingAgent(agent)}
                        title={L('Arraste para outro setor ou clique para editar', 'Drag to another area or click to edit')}
                      >
                        <span className="gov-drag-grip">⋮⋮</span>
                        <AgentAvatar agent={agent} size={28} />
                        <div className="gov-dept-agent-info">
                          <span className="gov-dept-agent-name">{agent.name}</span>
                          <span className="gov-dept-agent-role">{agent.role || L('Geral', 'General')}</span>
                        </div>
                        <span className="gov-dept-agent-resp">
                          {agent.responsible || L('Sem responsável', 'No owner')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn--sm gov-dept-add-btn"
                    onClick={() => {
                      const draft = newAgentDraft()
                      draft.department = group.department
                      navigate({ kind: 'new-agent', draft })
                    }}
                  >
                    <Icon name="plus" size={13} />
                    <span>{L('Novo agente neste setor', 'New agent in this area')}</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reactive Drop Toast Notification */}
      {toastMessage && (
        <div className="gov-toast">
          <Icon name="spark" size={15} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hierarchy Edit Modal */}
      {editingAgent && (
        <EditHierarchyModal
          agent={editingAgent}
          allAgents={agents}
          onClose={() => setEditingAgent(null)}
        />
      )}

      {/* Recommended Autonomous Team Template Modal */}
      {templateModalOpen && (
        <TeamTemplatesModal
          agents={agents}
          onClose={() => setTemplateModalOpen(false)}
        />
      )}
    </div>
  )
}

function EditHierarchyModal({
  agent,
  allAgents,
  onClose
}: {
  agent: Agent
  allAgents: Agent[]
  onClose: () => void
}): ReactNode {
  const [isChief, setIsChief] = useState(agent.isChiefOfStaff ?? false)
  const [responsible, setResponsible] = useState(agent.responsible ?? '')
  const [responsibleRole, setResponsibleRole] = useState(agent.responsibleRole ?? agent.department ?? '')
  const [department, setDepartment] = useState(agent.department ?? 'Engenharia')
  const [role, setRole] = useState(agent.role ?? '')

  // Quick suggestions for responsible leaders
  const existingLeaders = useMemo(() => {
    const set = new Set<string>(['Você (Fundador)', 'Amara', 'Sofía', 'Lukas', 'Priya', 'Kenji', 'Daniel', 'Yusuf', 'Chloé', 'Mateus'])
    for (const a of allAgents) {
      if (a.responsible) set.add(a.responsible)
    }
    return Array.from(set)
  }, [allAgents])

  const handleSave = (): void => {
    // If setting as chief, unmark any previous chief
    if (isChief && !agent.isChiefOfStaff) {
      for (const other of allAgents) {
        if (other.id !== agent.id && other.isChiefOfStaff) {
          patchAgent(other.id, { isChiefOfStaff: false })
        }
      }
    }

    patchAgent(agent.id, {
      isChiefOfStaff: isChief,
      responsible: responsible.trim() || undefined,
      responsibleRole: responsibleRole.trim() || undefined,
      department: department.trim() || undefined,
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
          {/* Braço Direito Switch */}
          <div className="gov-field-card">
            <div className="gov-field-card__info">
              <span className="gov-field-card__title">⭐ {L('Braço Direito (Chief of Staff)', 'Chief of Staff')}</span>
              <span className="gov-field-card__desc">
                {L(
                  'Fica no topo da árvore organizacional. Coordena tarefas e distribui demandas para os outros bots.',
                  'Stands at the root of the org tree. Coordinates tasks and delegates work across bots.'
                )}
              </span>
            </div>
            <label className="gov-switch">
              <input
                type="checkbox"
                checked={isChief}
                onChange={(e) => setIsChief(e.target.checked)}
              />
              <span className="gov-slider" />
            </label>
          </div>

          {/* Department Selection */}
          <div className="gov-form-group">
            <label className="gov-label">{L('Departamento / Setor', 'Department / Area')}</label>
            <div className="gov-dept-buttons">
              {DEPARTMENTS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`gov-dept-btn ${department.toLowerCase() === d.name.toLowerCase() ? 'is-selected' : ''}`}
                  style={{
                    borderColor: department.toLowerCase() === d.name.toLowerCase() ? d.color : undefined,
                    color: department.toLowerCase() === d.name.toLowerCase() ? d.color : undefined
                  }}
                  onClick={() => {
                    setDepartment(d.name)
                    if (!responsibleRole) setResponsibleRole(d.name)
                  }}
                >
                  <span className="gov-dept-icon-dot" style={{ backgroundColor: d.color }} />
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Responsible Person / Leader */}
          <div className="gov-form-group">
            <label className="gov-label">
              {L('Pessoa Responsável (Quem cuida dele)', 'Responsible Person (Who manages them)')}
            </label>
            <input
              className="gov-input"
              value={responsible}
              placeholder={L('Ex.: Amara, Lukas, Você (Fundador)…', 'E.g. Amara, Lukas, Founder…')}
              onChange={(e) => setResponsible(e.target.value)}
              list="leader-suggestions"
            />
            <datalist id="leader-suggestions">
              {existingLeaders.map((lead) => (
                <option key={lead} value={lead} />
              ))}
            </datalist>
            <div className="gov-quick-pills">
              {existingLeaders.slice(0, 6).map((lead) => (
                <button
                  key={lead}
                  type="button"
                  className="gov-mini-pill"
                  onClick={() => setResponsible(lead)}
                >
                  {lead}
                </button>
              ))}
            </div>
          </div>

          {/* Leader Role */}
          <div className="gov-form-group">
            <label className="gov-label">
              {L('Papel do Responsável', 'Leader Role')}
            </label>
            <input
              className="gov-input"
              value={responsibleRole}
              placeholder={L('Ex.: Dono, Engenharia, Produto, Vendas, Suporte…', 'E.g. Owner, Engineering, Product, Sales…')}
              onChange={(e) => setResponsibleRole(e.target.value)}
            />
          </div>

          {/* Specific Function / Title of the Bot */}
          <div className="gov-form-group">
            <label className="gov-label">
              {L('Função Específica no Time', 'Specific Role in Team')}
            </label>
            <input
              className="gov-input"
              value={role}
              placeholder={L('Ex.: Dev, Revisor de código, PM, Triagem de bugs, Atendimento, Vendas…', 'E.g. Dev, Code reviewer, PM, Bug triage, Sales…')}
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
            <button className="btn btn--sm" onClick={onClose}>
              {L('Cancelar', 'Cancel')}
            </button>
            <button className="btn btn--sm btn--primary" onClick={handleSave}>
              {L('Salvar Hierarquia', 'Save Hierarchy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamTemplatesModal({
  agents,
  onClose
}: {
  agents: Agent[]
  onClose: () => void
}): ReactNode {
  const [selectedPreset, setSelectedPreset] = useState<'saas' | 'solopreneur' | 'agency'>('saas')

  const applyPreset = (): void => {
    if (selectedPreset === 'saas') {
      const fante = agents.find((a) => a.kind === 'tuca' || a.handle === 'fante') ?? agents[0]
      if (fante) {
        patchAgent(fante.id, { isChiefOfStaff: true, role: 'Braço Direito', department: 'Executivo' })
      }

      const remaining = agents.filter((a) => a.id !== fante?.id)
      const presetsMapping = [
        { name: 'Theo', role: 'PM', dept: 'Produto', leader: 'Sofía', leadRole: 'Produto' },
        { name: 'Lia', role: 'Dev', dept: 'Engenharia', leader: 'Lukas', leadRole: 'Engenharia' },
        { name: 'Ada', role: 'Dev', dept: 'Engenharia', leader: 'Lukas', leadRole: 'Engenharia' },
        { name: 'Nina', role: 'Pesquisa', dept: 'Produto', leader: 'Priya', leadRole: 'Produto' },
        { name: 'Milo', role: 'Financeiro', dept: 'Financeiro', leader: 'Amara', leadRole: 'Dono' },
        { name: 'Kai', role: 'Revisor de código', dept: 'Engenharia', leader: 'Lukas', leadRole: 'Engenharia' },
        { name: 'Noor', role: 'Conteúdo', dept: 'Produto', leader: 'Priya', leadRole: 'Produto' },
        { name: 'Atlas', role: 'Ops', dept: 'Admin', leader: 'Kenji', leadRole: 'Admin' },
        { name: 'Rio', role: 'Triagem de bugs', dept: 'Engenharia', leader: 'Daniel', leadRole: 'Engenharia' },
        { name: 'Sven', role: 'Dados', dept: 'Engenharia', leader: 'Yusuf', leadRole: 'Engenharia' },
        { name: 'Iara', role: 'Atendimento', dept: 'Suporte', leader: 'Chloé', leadRole: 'Suporte' },
        { name: 'Zara', role: 'Vendas', dept: 'Vendas', leader: 'Mateus', leadRole: 'Vendas' }
      ]

      remaining.forEach((ag, index) => {
        const match = presetsMapping.find((m) => m.name.toLowerCase() === ag.name.toLowerCase()) || presetsMapping[index % presetsMapping.length]!
        patchAgent(ag.id, {
          responsible: match.leader,
          responsibleRole: match.leadRole,
          department: match.dept,
          role: match.role
        })
      })
    } else if (selectedPreset === 'solopreneur') {
      const fante = agents.find((a) => a.kind === 'tuca' || a.handle === 'fante') ?? agents[0]
      if (fante) {
        patchAgent(fante.id, { isChiefOfStaff: true, role: 'Braço Direito', department: 'Executivo' })
      }
      const remaining = agents.filter((a) => a.id !== fante?.id)
      const soloMapping = [
        { role: 'Dev & Automações', dept: 'Engenharia', leader: 'Você (Fundador)', leadRole: 'Tech' },
        { role: 'Atendimento & Sucesso', dept: 'Suporte', leader: 'Você (Fundador)', leadRole: 'Operações' },
        { role: 'Vendas & SDR', dept: 'Vendas', leader: 'Você (Fundador)', leadRole: 'Comercial' },
        { role: 'Financeiro & Métricas', dept: 'Financeiro', leader: 'Você (Fundador)', leadRole: 'Dono' },
        { role: 'Produto & Conteúdo', dept: 'Produto', leader: 'Você (Fundador)', leadRole: 'Produto' }
      ]
      remaining.forEach((ag, index) => {
        const item = soloMapping[index % soloMapping.length]!
        patchAgent(ag.id, {
          responsible: item.leader,
          responsibleRole: item.leadRole,
          department: item.dept,
          role: item.role
        })
      })
    } else {
      const fante = agents.find((a) => a.kind === 'tuca' || a.handle === 'fante') ?? agents[0]
      if (fante) {
        patchAgent(fante.id, { isChiefOfStaff: true, role: 'Braço Direito', department: 'Executivo' })
      }
      const remaining = agents.filter((a) => a.id !== fante?.id)
      const agencyMapping = [
        { role: 'Criação de Conteúdo & Copy', dept: 'Produto', leader: 'Líder Criativo', leadRole: 'Conteúdo' },
        { role: 'Prospecção & Fechamento', dept: 'Vendas', leader: 'Líder Comercial', leadRole: 'Vendas' },
        { role: 'Suporte & Onboarding', dept: 'Suporte', leader: 'Líder de Atendimento', leadRole: 'Suporte' },
        { role: 'Gestão Financeira', dept: 'Financeiro', leader: 'Diretoria', leadRole: 'Dono' }
      ]
      remaining.forEach((ag, index) => {
        const item = agencyMapping[index % agencyMapping.length]!
        patchAgent(ag.id, {
          responsible: item.leader,
          responsibleRole: item.leadRole,
          department: item.dept,
          role: item.role
        })
      })
    }

    onClose()
  }

  return (
    <div className="gov-modal-backdrop" onClick={onClose}>
      <div className="gov-modal gov-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="gov-modal__header">
          <div>
            <h2 className="gov-modal__title">{L('Estruturar Equipe Recomendada', 'Structure Recommended Squad')}</h2>
            <p className="gov-modal__subtitle">
              {L(
                'Templates prontos de governança para quem nunca geriu uma equipe. Garanta que seu negócio continue rodando com donos e funções claras.',
                'Ready-made governance templates for non-managers. Ensure your company keeps running with clear owners and routines.'
              )}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="gov-modal__body">
          <div className="gov-template-cards">
            {/* Template 1: SaaS & Software */}
            <div
              className={`gov-template-card ${selectedPreset === 'saas' ? 'is-selected' : ''}`}
              onClick={() => setSelectedPreset('saas')}
            >
              <div className="gov-template-card__badge">
                <span>{L('MODELO DO POST DO X', 'X POST MODEL')}</span>
              </div>
              <h3 className="gov-template-card__title">🚀 {L('Software & SaaS Completo', 'Software & SaaS Squad')}</h3>
              <p className="gov-template-card__desc">
                {L(
                  'A hierarquia exata do post: Braço Direito no topo, Engenharia (Dev, Revisor, Triagem, Dados), Produto (PM, Pesquisa, Conteúdo), Suporte, Vendas e Financeiro.',
                  'The exact hierarchy from the post: Chief of Staff on top, Engineering (Dev, Code review, Bug triage, Data), Product (PM, Research, Content), Support, Sales, and Finance.'
                )}
              </p>
              <div className="gov-template-card__tags">
                <span className="gov-tag-item">Dev</span>
                <span className="gov-tag-item">Code Review</span>
                <span className="gov-tag-item">Bug Triage</span>
                <span className="gov-tag-item">PM</span>
                <span className="gov-tag-item">Atendimento</span>
                <span className="gov-tag-item">Vendas</span>
              </div>
            </div>

            {/* Template 2: Solopreneur */}
            <div
              className={`gov-template-card ${selectedPreset === 'solopreneur' ? 'is-selected' : ''}`}
              onClick={() => setSelectedPreset('solopreneur')}
            >
              <div className="gov-template-card__badge">
                <span>{L('SOLOPRENEUR', 'SOLOPRENEUR')}</span>
              </div>
              <h3 className="gov-template-card__title">💼 {L('Empresa de 1 Pessoa Autônoma', 'Autonomous 1-Person Business')}</h3>
              <p className="gov-template-card__desc">
                {L(
                  'Você no comando com 1 Braço Direito geral e bots cuidando do Atendimento, Vendas, Código e Financeiro enquanto você dorme ou se ausenta.',
                  'You at the helm with 1 Chief of Staff and bots taking care of Support, Sales, Code, and Finance while you sleep or go offline.'
                )}
              </p>
              <div className="gov-template-card__tags">
                <span className="gov-tag-item">Braço Direito</span>
                <span className="gov-tag-item">Vendas</span>
                <span className="gov-tag-item">Atendimento</span>
                <span className="gov-tag-item">Automações</span>
              </div>
            </div>

            {/* Template 3: Agency & Services */}
            <div
              className={`gov-template-card ${selectedPreset === 'agency' ? 'is-selected' : ''}`}
              onClick={() => setSelectedPreset('agency')}
            >
              <div className="gov-template-card__badge">
                <span>{L('AGÊNCIA & VENDAS', 'AGENCY & SALES')}</span>
              </div>
              <h3 className="gov-template-card__title">🎯 {L('Agência & Prestação de Serviços', 'Agency & Services')}</h3>
              <p className="gov-template-card__desc">
                {L(
                  'Focado em aquisição de clientes, produção de conteúdo e retenção: SDR, Criador de Conteúdo, Sucesso do Cliente e Cobrança.',
                  'Focused on customer acquisition, content production and retention: SDR, Content Creator, Customer Success, and Billing.'
                )}
              </p>
              <div className="gov-template-card__tags">
                <span className="gov-tag-item">Copy & Conteúdo</span>
                <span className="gov-tag-item">SDR</span>
                <span className="gov-tag-item">Onboarding</span>
              </div>
            </div>
          </div>
        </div>

        <div className="gov-modal__footer">
          <button className="btn btn--sm" onClick={onClose}>
            {L('Cancelar', 'Cancel')}
          </button>
          <button className="btn btn--sm btn--primary" onClick={applyPreset}>
            {L('Aplicar Estrutura ao Time', 'Apply Squad Structure')}
          </button>
        </div>
      </div>
    </div>
  )
}
