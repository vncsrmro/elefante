import { useState, useMemo, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import {
  agentById,
  isTeam,
  moveTask,
  navigate,
  removeTask,
  saveTask,
  startTask,
  useStore,
  type Agent,
  type Conversation,
  type Task,
  type TaskInput,
  type TaskStatus
} from '../store'
import { AgentAvatar, Icon, time } from './ui'

interface KanbanBoardProps {
  conversationId?: string
  onClose?: () => void
}

const COLUMNS: { id: TaskStatus; title: string; subtitle: string; icon: string }[] = [
  { id: 'todo', title: L('A Fazer', 'To do'), subtitle: L('Planejadas', 'Planned'), icon: 'circle' },
  { id: 'in_progress', title: L('Em Andamento', 'In progress'), subtitle: L('Agente trabalhando', 'Agent working'), icon: 'pulse' },
  { id: 'review', title: L('Em Revisão', 'In review'), subtitle: L('Aguardando você', 'Waiting on you'), icon: 'shield' },
  { id: 'done', title: L('Concluído', 'Done'), subtitle: L('Finalizadas', 'Completed'), icon: 'check' }
]

export function KanbanBoard({ conversationId, onClose }: KanbanBoardProps): ReactNode {
  const s = useStore((s) => s)
  const [selectedConvId, setSelectedConvId] = useState<string>(conversationId ?? 'all')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)
  const [editingTask, setEditingTask] = useState<TaskInput | null>(null)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)

  const channels = useStore((s) => s.conversations.filter((c) => c.kind === 'channel'))
  const agents = useStore((s) => s.agents.filter(isTeam))

  // Filter tasks based on view, search, project, and agent
  const filteredTasks = useMemo(() => {
    return s.tasks.filter((t) => {
      if (selectedConvId !== 'all' && t.conversationId !== selectedConvId) return false
      if (selectedAgentId !== 'all' && t.agentId !== selectedAgentId) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesTitle = t.title.toLowerCase().includes(query)
        const matchesDesc = t.description?.toLowerCase().includes(query)
        const matchesNum = `#${t.number}`.includes(query)
        if (!matchesTitle && !matchesDesc && !matchesNum) return false
      }
      return true
    })
  }, [s.tasks, selectedConvId, selectedAgentId, search])

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string): void => {
    setDraggedTaskId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, colId: TaskStatus): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colId) setDragOverCol(colId)
  }

  const handleDragLeave = (colId: TaskStatus): void => {
    if (dragOverCol === colId) setDragOverCol(null)
  }

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus): void => {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId
    if (id) {
      moveTask(id, targetStatus)
    }
    setDraggedTaskId(null)
  }

  return (
    <div className="kanban-page">
      {/* Top Header */}
      <header className="kanban-header">
        <div className="kanban-header__info">
          <div className="kanban-header__icon">
            <Icon name="board" size={18} />
          </div>
          <div>
            <h2 className="kanban-header__title">
              {L('Tarefas que se movem sozinhas', 'Tasks that move on their own')}
            </h2>
            <p className="kanban-header__desc">
              {L(
                'O agente inicia, abre a PR e o card muda de coluna sozinho.',
                'The agent starts, opens the PR and the task changes column.'
              )}
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="kanban-header__actions">
          {/* Project select */}
          <select
            className="kanban-select"
            value={selectedConvId}
            onChange={(e) => setSelectedConvId(e.target.value)}
          >
            <option value="all">{L('Todos os projetos', 'All projects')}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>

          {/* Agent select */}
          <select
            className="kanban-select"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
          >
            <option value="all">{L('Todos os agentes', 'All agents')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="kanban-search">
            <Icon name="search" size={13} />
            <input
              type="text"
              placeholder={L('Buscar tarefa (#93, checkout…)', 'Search task (#93, checkout…)')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="kanban-search__clear" onClick={() => setSearch('')}>
                <Icon name="x" size={11} />
              </button>
            )}
          </div>

          {/* New Task Button */}
          <button
            className="btn btn--primary btn--sm"
            onClick={() => {
              const defaultConv = channels[0]?.id ?? ''
              setEditingTask({
                conversationId: selectedConvId !== 'all' ? selectedConvId : defaultConv,
                title: '',
                status: 'todo'
              })
              setIsNewTaskOpen(true)
            }}
          >
            <Icon name="plus" size={13} />
            <span>{L('Nova Tarefa', 'New Task')}</span>
          </button>

          {onClose && (
            <button className="icon-btn" onClick={onClose} title={L('Voltar para o chat', 'Back to chat')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Board Columns */}
      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id)
          const isOver = dragOverCol === col.id

          return (
            <div
              key={col.id}
              className={`kanban-column kanban-column--${col.id} ${isOver ? 'is-drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="kanban-column__header">
                <div className="kanban-column__title-wrap">
                  {col.id === 'todo' && <span className="kanban-col-bullet is-todo" />}
                  {col.id === 'in_progress' && <span className="kanban-col-bullet is-progress" />}
                  {col.id === 'review' && <span className="kanban-col-bullet is-review" />}
                  {col.id === 'done' && <span className="kanban-col-bullet is-done" />}

                  <h3 className="kanban-column__title">{col.title}</h3>
                </div>
                <span className="kanban-column__count">{colTasks.length}</span>
              </div>

              {/* Task Cards List */}
              <div className="kanban-column__cards">
                {colTasks.length === 0 ? (
                  <div className="kanban-column__empty">
                    <span>{L('Nenhuma tarefa aqui', 'No tasks here')}</span>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onEdit={() => {
                        setEditingTask(task)
                        setIsNewTaskOpen(true)
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task Creation / Edit Modal */}
      {isNewTaskOpen && editingTask && (
        <TaskModal
          task={editingTask}
          channels={channels}
          agents={agents}
          onClose={() => {
            setIsNewTaskOpen(false)
            setEditingTask(null)
          }}
          onSave={async (taskData) => {
            await saveTask(taskData)
            setIsNewTaskOpen(false)
            setEditingTask(null)
          }}
          onDelete={
            editingTask.id
              ? () => {
                  removeTask(editingTask.id!)
                  setIsNewTaskOpen(false)
                  setEditingTask(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function TaskCard({
  task,
  onDragStart,
  onEdit
}: {
  task: Task
  onDragStart: (e: React.DragEvent) => void
  onEdit: () => void
}): ReactNode {
  const agent = useStore((s) => (task.agentId ? agentById(s, task.agentId) : undefined))
  const conv = useStore((s) => s.conversations.find((c) => c.id === task.conversationId))
  const [starting, setStarting] = useState(false)

  const isWorking = task.status === 'in_progress' || task.pendingStart
  const isReview = task.status === 'review' || !!task.waiting

  const handleStart = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    setStarting(true)
    try {
      await startTask(task.id)
    } finally {
      setStarting(false)
    }
  }

  const handleOpenConversation = (e: React.MouseEvent): void => {
    e.stopPropagation()
    navigate({ kind: 'conversation', id: task.conversationId, message: task.messageId })
  }

  return (
    <div
      className={`kanban-card ${isWorking ? 'is-working' : ''} ${isReview ? 'is-review' : ''}`}
      draggable
      onDragStart={onDragStart}
      onClick={onEdit}
    >
      {/* Card Header: Badge & Status */}
      <div className="kanban-card__top">
        <div className="kanban-card__badge-row">
          {/* Agent Avatar Icon with Ticket #ID */}
          <div className="kanban-card__id-badge">
            {agent ? (
              <span className={`kanban-card__agent-dot c-${agent.color}`}>
                <AgentAvatar agent={agent} size={15} />
              </span>
            ) : (
              <span className="kanban-card__agent-dot fallback" />
            )}
            <span className="kanban-card__num">#{task.number}</span>
          </div>

          {/* Pulse or Matrix Dots Indicator */}
          {isWorking && (
            <span className="kanban-card__working-pill">
              <span className="kanban-card__pulse-dot" />
              <span>{L('iniciado', 'started')}</span>
            </span>
          )}

          {isReview && (
            <span className="kanban-card__review-pill">
              <Icon name="shield" size={10} />
              <span>{task.waiting === 'approval' ? L('aprovação', 'approval') : L('esperando', 'waiting')}</span>
            </span>
          )}

          {task.status === 'done' && (
            <span className="kanban-card__done-pill">
              <Icon name="check" size={10} />
            </span>
          )}
        </div>

        {conv && (
          <span className="kanban-card__channel-tag" title={conv.name}>
            #{conv.name}
          </span>
        )}
      </div>

      {/* Card Title */}
      <h4 className="kanban-card__title">{task.title}</h4>

      {/* Optional Description Snippet */}
      {task.description && (
        <p className="kanban-card__desc">{task.description}</p>
      )}

      {/* Card Footer: Quick Actions & Time */}
      <div className="kanban-card__foot">
        <div className="kanban-card__agent-info">
          {agent ? (
            <span className="kanban-card__agent-name">{agent.name}</span>
          ) : (
            <span className="kanban-card__unassigned">{L('Sem agente', 'Unassigned')}</span>
          )}
        </div>

        <div className="kanban-card__actions" onClick={(e) => e.stopPropagation()}>
          {task.status === 'todo' && (
            <button
              className="kanban-card__btn-start"
              onClick={handleStart}
              disabled={starting}
              title={L('Iniciar execução com o agente agora', 'Start execution with agent now')}
            >
              <Icon name="play" size={10} />
              <span>{starting ? '…' : L('Iniciar', 'Start')}</span>
            </button>
          )}

          {task.messageId && (
            <button
              className="kanban-card__btn-view"
              onClick={handleOpenConversation}
              title={L('Ver no chat', 'View in chat')}
            >
              <Icon name="send" size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskModal({
  task,
  channels,
  agents,
  onClose,
  onSave,
  onDelete
}: {
  task: TaskInput
  channels: Conversation[]
  agents: Agent[]
  onClose: () => void
  onSave: (task: TaskInput) => Promise<void>
  onDelete?: () => void
}): ReactNode {
  const [title, setTitle] = useState(task.title || '')
  const [description, setDescription] = useState(task.description || '')
  const [conversationId, setConversationId] = useState(task.conversationId || channels[0]?.id || '')
  const [agentId, setAgentId] = useState(task.agentId || '')
  const [status, setStatus] = useState<TaskStatus>(task.status || 'todo')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim() || !conversationId) return
    setSubmitting(true)
    try {
      await onSave({
        ...task,
        title: title.trim(),
        description: description.trim() || undefined,
        conversationId,
        agentId: agentId || undefined,
        status
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card kanban-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-card__header">
          <h3 className="modal-card__title">
            {task.id ? L('Editar Tarefa', 'Edit Task') : L('Nova Tarefa', 'New Task')}
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-form">
          <label className="field">
            <span className="field__label">{L('Título da tarefa', 'Task title')}</span>
            <input
              type="text"
              className="input"
              required
              autoFocus
              value={title}
              placeholder={L('Ex: Migrar checkout para novo gateway', 'e.g. Migrate checkout to new gateway')}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">{L('Descrição (opcional)', 'Description (optional)')}</span>
            <textarea
              className="input"
              rows={3}
              value={description}
              placeholder={L('Detalhes do que deve ser feito pelo agente…', 'Details for the agent to execute…')}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="form-row">
            <label className="field">
              <span className="field__label">{L('Projeto / Canal', 'Project / Channel')}</span>
              <select
                className="input select"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{L('Agente responsável', 'Assigned agent')}</span>
              <select
                className="input select"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">{L('Automático (Router escolhe)', 'Automatic (Router picks)')}</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field__label">{L('Coluna / Estado', 'Column / Status')}</span>
            <select
              className="input select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </label>

          <footer className="modal-card__footer">
            {onDelete && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={onDelete}
              >
                <Icon name="trash" size={13} />
                <span>{L('Excluir', 'Delete')}</span>
              </button>
            )}

            <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
                {L('Cancelar', 'Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={submitting || !title.trim()}
              >
                <span>{submitting ? '…' : L('Salvar Tarefa', 'Save Task')}</span>
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}
