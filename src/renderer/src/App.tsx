import { useEffect, type ReactNode } from 'react'
import { L } from '../../shared/lang'
import { getState, navigate, navigateBack, navigateForward, openDialog, openFileInEditor, setNav, toggleRightPanel, useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ConversationView } from './components/Conversation'
import { AgentPage, ApprovalsPage, ConnectorsPage, SettingsPage } from './components/Pages'
import { ProvidersPage } from './components/Providers'
import { CloudClisPage } from './components/CloudClis'
import { UsagePage } from './components/Usage'
import { MemoryPage } from './components/Memory'
import { RoutinesPage } from './components/Routines'
import { SkillsPage } from './components/Skills'
import { ReportPage } from './components/Report'
import { GovernancePage } from './components/Governance'
import { Onboarding } from './components/Onboarding'
import { Dialogs } from './components/Dialogs'
import { Icon } from './components/ui'
import { ProjectExplorer } from './components/ProjectExplorer'
import { StatusBar } from './components/StatusBar'
import { KanbanBoard } from './components/KanbanBoard'
import { OneInboxDrawer } from './components/OneInbox'

export function App(): ReactNode {
  const view = useStore((s) => s.view)
  const theme = useStore((s) => s.settings.theme)
  const language = useStore((s) => s.settings.language)
  const intro = useStore((s) => s.ready && s.settings.onboarding?.done === false)
  const mac = useStore((s) => s.platform === 'mac')
  const navOpen = useStore((s) => s.navOpen)
  const rightPanelOpen = useStore((s) => s.rightPanelOpen)
  const rightPanelWidth = useStore((s) => s.rightPanelWidth)
  const fallbackProject = useStore((s) => s.conversations.find((c) => !!c.project)?.project)
  const activeConv = useStore((s) => (view?.kind === 'conversation' ? s.conversations.find((c) => c.id === view.id) : undefined))

  useEffect(() => {
    if (rightPanelWidth) {
      document.documentElement.style.setProperty('--right-panel-width', `${rightPanelWidth}px`)
    }
  }, [rightPanelWidth])

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'pt-BR'
  }, [language])

  useEffect(() => {
    document.documentElement.dataset['os'] = mac ? 'mac' : 'other'
  }, [mac])

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset['theme']
    else document.documentElement.dataset['theme'] = theme
  }, [theme])

  // Listen for native app commands from menu / shortcuts (e.g. close-tab, browser-backward, browser-forward)
  useEffect(() => {
    window.elefante?.onAppCommand?.((cmd) => {
      if (cmd === 'close-tab') {
        window.dispatchEvent(new CustomEvent('elefante:close-tab'))
      } else if (cmd === 'browser-backward') {
        navigateBack()
      } else if (cmd === 'browser-forward') {
        navigateForward()
      }
    })
    window.elefante?.onOpenFileInEditor?.((filePath) => {
      openFileInEditor(filePath)
    })
  }, [])

  // Mouse side buttons: button 3 = Back, button 4 = Forward
  useEffect(() => {
    const handleMouseAux = (e: MouseEvent): void => {
      if (e.button === 3) {
        e.preventDefault()
        e.stopPropagation()
        navigateBack()
      } else if (e.button === 4) {
        e.preventDefault()
        e.stopPropagation()
        navigateForward()
      }
    }
    window.addEventListener('mouseup', handleMouseAux)
    window.addEventListener('auxclick', handleMouseAux)
    return () => {
      window.removeEventListener('mouseup', handleMouseAux)
      window.removeEventListener('auxclick', handleMouseAux)
    }
  }, [])

  // ⌘K go anywhere · ⌘N new channel · ⌘1–9 channels · ⌘B / ⌘\ toggle editor · Alt+Left / Alt+Right navigation
  useEffect(() => {
    const keys = (e: KeyboardEvent): void => {
      // Alt + ArrowLeft / ArrowRight for Back and Forward navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          navigateBack()
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          navigateForward()
          return
        }
      }

      const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey
      if (!mod || intro) return
      const s = getState()
      const channels = s.conversations.filter((c) => c.kind === 'channel')
      if (e.key === 'k') openDialog(s.dialog?.kind === 'search' ? null : { kind: 'search' })
      else if (e.key === 'n' && !e.shiftKey) openDialog({ kind: 'new-channel' })
      else if (e.key === 'b' || e.key === '\\') toggleRightPanel()
      else if (e.key === ',') navigate({ kind: 'settings' })
      else if (/^[1-9]$/.test(e.key) && channels[Number(e.key) - 1]) navigate({ kind: 'conversation', id: channels[Number(e.key) - 1]!.id })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [intro, mac])

  if (!view) return <div className="boot" />
  // Dialogs too: connecting a tool from the introduction may open one (on a server).
  if (intro)
    return (
      <>
        <Onboarding />
        <Dialogs />
      </>
    )
  if (view.kind === 'tuca')
    return (
      <>
        <Onboarding build from={view.from} />
        <Dialogs />
      </>
    )

  return (
    <div className={`app ${navOpen ? 'is-nav-open' : ''} ${rightPanelOpen ? 'has-right-panel' : ''}`}>
      {/* On a phone the sidebar is a drawer: this opens it, the shade closes it. */}
      <button className="mobile-nav" aria-label={L('Abrir o menu', 'Open the menu')} onClick={() => setNav(true)}>
        <Icon name="menu" size={18} />
      </button>
      <div className="nav-shade" onClick={() => setNav(false)} />
      <Sidebar />
      <main className="main">
        {view.kind === 'conversation' && <ConversationView key={view.id} id={view.id} />}
        {view.kind === 'agent' && <AgentPage key={view.id} id={view.id} />}
        {view.kind === 'new-agent' && <AgentPage key={view.fromMessage ?? 'new'} draft={view.draft} fromMessage={view.fromMessage} />}
        {view.kind === 'approvals' && <ApprovalsPage />}
        {view.kind === 'usage' && <UsagePage />}
        {view.kind === 'connectors' && <ConnectorsPage />}
        {view.kind === 'memory' && <MemoryPage />}
        {view.kind === 'routines' && <RoutinesPage />}
        {view.kind === 'skills' && <SkillsPage />}
        {view.kind === 'report' && <ReportPage />}
        {view.kind === 'governance' && <GovernancePage />}
        {view.kind === 'providers' && <ProvidersPage />}
        {view.kind === 'clis' && <CloudClisPage />}
        {view.kind === 'settings' && <SettingsPage />}
        {view.kind === 'board' && <KanbanBoard conversationId={view.conversationId} />}
      </main>
      {rightPanelOpen && <ProjectExplorer currentProject={activeConv?.project || fallbackProject} />}
      <StatusBar />
      <OneInboxDrawer />
      <Dialogs />
    </div>
  )
}
