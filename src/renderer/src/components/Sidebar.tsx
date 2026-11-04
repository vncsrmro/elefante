import { L } from '../../../shared/lang'
import { useCallback, useState, type ReactNode } from 'react'
import {
  addProjectFolder,
  agentById,
  archiveAgent,
  clearConversationProject,
  deleteConversation,
  isTeam,
  markRead,
  navigate,
  openDialog,
  openDm,
  openFolderPath,
  openTuca,
  pendingApprovals,
  pendingMemories,
  pickConversationProject,
  shortcut,
  updateSettings,
  useStore,
  type Conversation,
  type View
} from '../store'
import { ContextMenu, type MenuItem, type MenuState } from './Dialogs'
import { GettingStarted } from './Onboarding'
import { UpdateNote } from './Update'
import { AgentAvatar, Icon, TucaMark, type IconName } from './ui'

const same = (a: View | null, b: View): boolean => JSON.stringify(a) === JSON.stringify(b)

function NavItem({ view, icon, label, badge }: { view: View; icon: IconName; label: string; badge?: number }): ReactNode {
  const active = useStore((s) => same(s.view, view))
  return (
    <button className={`nav-item ${active ? 'is-active' : ''}`} onClick={() => navigate(view)}>
      <Icon name={icon} size={15} />
      <span className="nav-item__label">{label}</span>
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  )
}

// Visual badge for each project folder, inspired by Orca's clean repo/folder badges.
function ProjectGlyph({ name, hasFolder }: { name: string; hasFolder: boolean }): ReactNode {
  const lower = name.toLowerCase()
  if (lower.includes('elefante')) {
    return <TucaMark size={16} />
  }
  if (hasFolder) {
    const letters = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
    return (
      <span className="proj-badge proj-badge--folder" aria-hidden>
        {letters || <Icon name="folder" size={14} />}
      </span>
    )
  }
  return (
    <span className="proj-badge proj-badge--folder" aria-hidden>
      <Icon name="hash" size={14} />
    </span>
  )
}

export function Sidebar(): ReactNode {
  const s = useStore((s) => s)
  const channels = s.conversations.filter((c) => c.kind === 'channel')
  const dms = s.conversations.filter((c) => c.kind === 'dm' && agentById(s, c.name)?.kind !== 'tuca')
  const pending = pendingApprovals(s).length
  const suggestions = pendingMemories(s).length
  const proposals = s.skills.filter((k) => k.state === 'pending').length
  const totalAlerts = pending + suggestions + proposals

  const [menu, setMenu] = useState<MenuState>(null)
  const [showTools, setShowTools] = useState(false)
  const [showAgents, setShowAgents] = useState(true)

  const closeMenu = useCallback(() => setMenu(null), [])
  const open = (e: React.MouseEvent, items: MenuItem[]): void => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  const channelMenu = (c: Conversation): MenuItem[] => [
    ...(c.project
      ? [
          { label: L('Abrir pasta no Explorer', 'Open folder in Explorer'), icon: 'folder' as const, onClick: () => openFolderPath(c.project!) },
          { label: L('Trocar pasta do projeto…', 'Change project folder…'), icon: 'folderPlus' as const, onClick: () => void pickConversationProject(c.id) },
          { label: L('Desvincular pasta', 'Unlink folder'), icon: 'x' as const, onClick: () => void clearConversationProject(c.id) },
          'separator' as const
        ]
      : [
          { label: L('Vincular pasta do computador…', 'Link computer folder…'), icon: 'folderPlus' as const, onClick: () => void pickConversationProject(c.id) },
          'separator' as const
        ]),
    { label: L('Agentes no projeto…', 'Agents in project…'), icon: 'users', onClick: () => openDialog({ kind: 'members', id: c.id }) },
    { label: L('Renomear…', 'Rename…'), icon: 'edit', onClick: () => openDialog({ kind: 'rename', id: c.id }) },
    { label: L('Mudar descrição…', 'Change description…'), icon: 'hash', onClick: () => openDialog({ kind: 'topic', id: c.id }) },
    ...(c.unread ? [{ label: L('Marcar como lido', 'Mark as read'), icon: 'check' as const, onClick: () => markRead(c.id) }] : []),
    'separator',
    {
      label: L('Remover da lista…', 'Remove from list…'),
      icon: 'trash',
      danger: true,
      onClick: () => {
        if (confirm(L(`Remover ${c.name} da lista?\n\nOs arquivos da pasta no seu computador NÃO são apagados — apenas o histórico de conversa no Elefante.`, `Remove ${c.name} from the list?\n\nYour files on disk are NOT deleted — only the chat history in Elefante.`))) void deleteConversation(c.id)
      }
    }
  ]

  const dmMenu = (id: string, agentId: string, agentName: string): MenuItem[] => [
    { label: L(`Ver ${agentName}`, `See ${agentName}`), icon: 'eye', onClick: () => navigate({ kind: 'agent', id: agentId }) },
    { label: L('Marcar como lido', 'Mark as read'), icon: 'check', onClick: () => markRead(id) },
    'separator',
    {
      label: L('Apagar a conversa…', 'Delete the conversation…'),
      icon: 'trash',
      danger: true,
      onClick: () => {
        if (confirm(L(`Apagar a conversa com ${agentName}?`, `Delete the conversation with ${agentName}?`))) void deleteConversation(id)
      }
    }
  ]

  const agentMenu = (agentId: string, agentName: string): MenuItem[] => [
    { label: L('Mandar mensagem', 'Send a message'), icon: 'send', onClick: () => void openDm(agentId) },
    { label: L('Configurar agente', 'Configure agent'), icon: 'edit', onClick: () => navigate({ kind: 'agent', id: agentId }) },
    { label: L('Governança & Hierarquia', 'Governance & Hierarchy'), icon: 'sitemap', onClick: () => navigate({ kind: 'governance', focusAgentId: agentId }) },
    'separator',
    {
      label: L('Arquivar…', 'Archive…'),
      icon: 'trash',
      danger: true,
      onClick: () => {
        if (confirm(L(`Arquivar ${agentName}?`, `Archive ${agentName}?`))) void archiveAgent(agentId, true)
      }
    }
  ]

  const isDark =
    s.settings.theme === 'dark' || (s.settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <aside className="sidebar">
      <div className="sidebar__drag" />

      {/* Orca-style ultra-clean top bar */}
      <div className="orca-header">
        <span className="orca-header__title">{L('Projetos', 'Projects')}</span>
        <div className="orca-header__actions">
          <button
            className={`orca-icon-btn ${pending > 0 ? 'has-alert' : ''}`}
            title={L('Aprovações e notificações', 'Approvals and notifications')}
            onClick={() => navigate({ kind: 'approvals' })}
          >
            <Icon name="bell" size={14} />
            {totalAlerts > 0 && <span className="orca-alert-count">{totalAlerts}</span>}
          </button>
          <button
            className={`orca-icon-btn ${showTools ? 'is-on' : ''}`}
            title={L('Painel de ferramentas (Memória, Rotinas, Skills, Fante)', 'Tools panel (Memory, Routines, Skills, Fante)')}
            onClick={() => setShowTools(!showTools)}
          >
            <Icon name="sliders" size={14} />
          </button>
          <button
            className="orca-icon-btn"
            title={L('Abrir pasta de projeto do computador…', 'Open project folder from computer…')}
            onClick={() => void addProjectFolder()}
          >
            <Icon name="folderPlus" size={15} />
          </button>
          <button
            className="orca-icon-btn"
            title={L(`Novo projeto ou canal (${shortcut(s.platform, 'N')})`, `New project or channel (${shortcut(s.platform, 'N')})`)}
            onClick={() => openDialog({ kind: 'new-channel' })}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
      </div>

      {s.settings.paused && (
        <button className="paused-banner" onClick={() => updateSettings({ paused: false })}>
          <Icon name="pause" size={13} /> {L('Agentes pausados', 'Agents paused')} · <u>{L('retomar', 'resume')}</u>
        </button>
      )}

      {/* Collapsible quick tools drawer when Sliders is clicked */}
      {showTools && (
        <div className="orca-tools-drawer">
          <button className="nav-item" onClick={openTuca}>
            <TucaMark size={16} />
            <span className="nav-item__label">Fante</span>
            <span className="nav-item__meta">{L('criar agente', 'new agent')}</span>
          </button>
          <NavItem view={{ kind: 'approvals' }} icon="shield" label={L('Aprovações', 'Approvals')} badge={pending} />
          <NavItem view={{ kind: 'governance' }} icon="sitemap" label={L('Governança (Hierarquia)', 'Governance (Hierarchy)')} />
          <NavItem view={{ kind: 'memory' }} icon="book" label={L('Memória', 'Memory')} badge={suggestions} />
          <NavItem view={{ kind: 'routines' }} icon="clock" label={L('Rotinas', 'Routines')} />
          <NavItem view={{ kind: 'skills' }} icon="layers" label="Skills" badge={proposals} />
          <NavItem view={{ kind: 'report' }} icon="report" label={L('Boletim', 'Report')} />
          <NavItem view={{ kind: 'usage' }} icon="chart" label={L('Uso e limites', 'Usage & limits')} />
          <NavItem view={{ kind: 'clis' }} icon="terminal" label={L('CLIs & Contas', 'CLIs & Accounts')} />
        </div>
      )}

      <nav className="sidebar__scroll">
        {/* Primary Focus: Project Folders */}
        <div className="orca-projects-list">
          {channels.map((c) => (
            <div key={c.id} onContextMenu={(e) => open(e, channelMenu(c))}>
              <ProjectItem conv={c} />
            </div>
          ))}
        </div>

        {dms.length > 0 && (
          <div className="section">
            <div className="section__head">
              <span>{L('Conversas diretas', 'Direct chats')}</span>
            </div>
            {dms.map((c) => {
              const agent = agentById(s, c.name)
              if (!agent) return null
              return (
                <div key={c.id} onContextMenu={(e) => open(e, dmMenu(c.id, agent.id, agent.name))}>
                  <DmItem id={c.id} name={agent.name} color={agent.color} unread={c.unread} />
                </div>
              )
            })}
          </div>
        )}

        <div className="section">
          <div className="section__head section__head--clickable" onClick={() => setShowAgents(!showAgents)}>
            <span>{L('Time de Agentes', 'Agent Team')}</span>
            <div className="row row--center" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
              <button
                className="icon-btn icon-btn--sm"
                title={L('Governança & Hierarquia ("Quem cuida de quem")', 'Governance & Hierarchy ("Who manages who")')}
                onClick={() => navigate({ kind: 'governance' })}
              >
                <Icon name="sitemap" size={13} />
              </button>
              <button className="icon-btn icon-btn--sm" title={L('Criar novo agente com o Fante', 'Create new agent with Fante')} onClick={openTuca}>
                <Icon name="plus" size={13} />
              </button>
            </div>
          </div>
          {showAgents &&
            s.agents
              .filter(isTeam)
              .map((a) => (
                <div key={a.id} onContextMenu={(e) => open(e, agentMenu(a.id, a.name))}>
                  <AgentItem id={a.id} />
                </div>
              ))}
          {showAgents && s.agents.some((a) => a.archived) && (
            <button className="nav-item nav-item--quiet" onClick={() => openDialog({ kind: 'archived' })}>
              <Icon name="layers" size={14} />
              <span className="nav-item__label">{L('Arquivados', 'Archived')}</span>
              <span className="nav-item__meta">{s.agents.filter((a) => a.archived).length}</span>
            </button>
          )}
        </div>
      </nav>

      {s.settings.onboarding?.done && !s.settings.onboarding.checklistHidden && <GettingStarted />}
      <ContextMenu menu={menu} onClose={closeMenu} />

      {/* Minimalist bottom bar */}
      <div className="sidebar__foot">
        <UpdateNote />
        <div className="orca-foot-row">
          <button
            className={`orca-foot-btn ${same(s.view, { kind: 'providers' }) ? 'is-active' : ''}`}
            onClick={() => navigate({ kind: 'providers' })}
            title={L('Provedores & APIs (OpenRouter, DeepSeek, Ollama, Groq…)', 'Providers & APIs')}
          >
            <Icon name="cpu" size={13} />
            <span>APIs</span>
          </button>
          <button
            className={`orca-foot-btn ${same(s.view, { kind: 'clis' }) ? 'is-active' : ''}`}
            onClick={() => navigate({ kind: 'clis' })}
            title={L('Central de CLIs & Contas Conectadas (Supabase, Cloudflare, Railway, GitHub, Vercel, Firebase…)', 'Cloud CLIs & Connected Accounts Hub')}
          >
            <Icon name="terminal" size={13} />
            <span>CLIs</span>
          </button>
          <button
            className={`orca-icon-btn ${same(s.view, { kind: 'connectors' }) ? 'is-on' : ''}`}
            title={L('Conectores MCP', 'MCP Connectors')}
            onClick={() => navigate({ kind: 'connectors' })}
          >
            <Icon name="plug" size={14} />
          </button>
          <button
            className="orca-icon-btn"
            title={L('Alternar tema claro/escuro', 'Toggle light/dark theme')}
            onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={14} />
          </button>
          <button
            className={`orca-icon-btn ${same(s.view, { kind: 'settings' }) ? 'is-on' : ''}`}
            title={L('Configurações', 'Settings')}
            onClick={() => navigate({ kind: 'settings' })}
          >
            <Icon name="gear" size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function ProjectItem({ conv }: { conv: Conversation }): ReactNode {
  const active = useStore((s) => s.view?.kind === 'conversation' && s.view.id === conv.id)
  const working = useStore((s) => s.messages.some((m) => m.conversationId === conv.id && m.run?.status === 'working'))
  return (
    <button
      className={`nav-item nav-item--project ${active ? 'is-active' : ''} ${conv.unread ? 'is-unread' : ''}`}
      onClick={() => navigate({ kind: 'conversation', id: conv.id })}
      title={conv.project ? `${conv.name}\n📁 ${conv.project}` : conv.name}
    >
      <ProjectGlyph name={conv.name} hasFolder={!!conv.project} />
      <span className="nav-item__label">{conv.name}</span>
      {working && <span className="pulse" title={L('Trabalhando', 'Working')} />}
      {conv.unread ? <span className="badge badge--soft">{conv.unread}</span> : null}
    </button>
  )
}

function DmItem({ id, name, color, unread }: { id: string; name: string; color: Parameters<typeof AgentAvatar>[0]['agent']['color']; unread?: number }): ReactNode {
  const active = useStore((s) => s.view?.kind === 'conversation' && s.view.id === id)
  const working = useStore((s) => s.messages.some((m) => m.conversationId === id && m.run?.status === 'working'))
  return (
    <button className={`nav-item ${active ? 'is-active' : ''} ${unread ? 'is-unread' : ''}`} onClick={() => navigate({ kind: 'conversation', id })}>
      <AgentAvatar agent={{ name, color }} size={17} busy={working} />
      <span className="nav-item__label">{name}</span>
      {working && <span className="pulse" title={L('Trabalhando', 'Working')} />}
      {unread ? <span className="badge badge--soft">{unread}</span> : null}
    </button>
  )
}

function AgentItem({ id }: { id: string }): ReactNode {
  const agent = useStore((s) => agentById(s, id))
  const active = useStore((s) => s.view?.kind === 'agent' && s.view.id === id)
  if (!agent) return null
  const pct = agent.limit > 0 ? agent.used / agent.limit : 1
  return (
    <button className={`nav-item ${active ? 'is-active' : ''}`} onClick={() => navigate({ kind: 'agent', id })}>
      <AgentAvatar agent={agent} size={17} />
      <span className="nav-item__label">{agent.name}</span>
      <span className="nav-item__meta nav-item__role" title={agent.role}>
        {agent.role}
      </span>
      {pct >= 0.8 && <span className={`dot ${pct >= 1 ? 'dot--danger' : 'dot--warn'}`} title={L('Orçamento acima de 80%', 'Budget above 80%')} />}
    </button>
  )
}
