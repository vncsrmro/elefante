import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { call } from '../rpc'
import { clearActiveEditorFile, openFolderPath, setRightPanelOpen, setRightPanelWidth, navigate, useStore } from '../store'
import { Icon } from './ui'
import { CodeHighlight } from './CodeHighlight'
import type { ProjectFileItem, ProjectFileInfo } from '../../../shared/types'

export type PanelTab =
  | {
      id: string
      kind: 'files'
      title: string
    }
  | {
      id: string
      kind: 'file'
      title: string
      path: string
      relPath: string
      language: string
      content: string
      initialContent: string
      isDirty: boolean
      isBinary: boolean
    }
  | {
      id: string
      kind: 'terminal'
      title: string
      shell: 'powershell' | 'cmd' | 'bash'
      history: Array<{ command: string; output: string; exitCode: number; time: string }>
      currentInput: string
      commandHistoryList: string[]
      historyPointer: number
      isRunning: boolean
    }
  | {
      id: string
      kind: 'browser'
      title: string
      url: string
      inputUrl: string
      isMobile?: boolean
    }
  | {
      id: string
      kind: 'markdown'
      title: string
      content: string
      initialContent: string
      isDirty: boolean
      previewMode: boolean
    }

export function ProjectExplorer({ currentProject }: { currentProject?: string }): ReactNode {
  const [folderPath, setFolderPath] = useState<string>(currentProject || '')
  const [rootName, setRootName] = useState<string>('Projeto')
  const [files, setFiles] = useState<ProjectFileItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [fileSearch, setFileSearch] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Orca Tabs state
  const [tabs, setTabs] = useState<PanelTab[]>([
    { id: 'tab-files', kind: 'files', title: 'Arquivos' }
  ])
  const [activeTabId, setActiveTabId] = useState<string>('tab-files')
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const [menuSearch, setMenuSearch] = useState<string>('')
  const [terminalCounter, setTerminalCounter] = useState<number>(1)

  // Editor states for active file tab
  const [editMode, setEditMode] = useState<boolean>(true)
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false)
  const [iframeKey, setIframeKey] = useState<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuInputRef = useRef<HTMLInputElement>(null)
  const terminalBottomRef = useRef<HTMLDivElement>(null)

  // Global store
  const rightPanelWidth = useStore((s) => s.rightPanelWidth)
  const agents = useStore((s) => s.agents)
  const conversations = useStore((s) => s.conversations)
  const models = useStore((s) => s.models)
  const activeEditorFile = useStore((s) => s.activeEditorFile)

  // Resizing state
  const [isResizing, setIsResizing] = useState<boolean>(false)

  // Update folderPath if conversation project changes
  useEffect(() => {
    if (currentProject && currentProject !== folderPath) {
      setFolderPath(currentProject)
    }
  }, [currentProject])

  // Load project file tree
  const loadFiles = async (path: string): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await call('listProjectFiles', { folderPath: path || '.' })
      setFolderPath(res.root)
      setRootName(res.name)
      setFiles(res.files)
      // Auto-expand first level directories
      const initialExpanded = new Set<string>()
      res.files.forEach((f) => {
        if (f.kind === 'directory') initialExpanded.add(f.path)
      })
      setExpandedFolders(initialExpanded)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (folderPath) void loadFiles(folderPath)
  }, [folderPath])

  // Scroll terminal to bottom when new output arrives
  const activeTab = tabs.find((t) => t.id === activeTabId)
  useEffect(() => {
    if (activeTab && activeTab.kind === 'terminal') {
      terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTab])

  // Close Orca menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  // Focus menu input when opened
  useEffect(() => {
    if (isMenuOpen) {
      setTimeout(() => menuInputRef.current?.focus(), 50)
    } else {
      setMenuSearch('')
    }
  }, [isMenuOpen])

  // Toggle folder expand/collapse in file tree
  const toggleFolder = (dirPath: string): void => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }

  // Open file in a tab
  const openFile = async (item: ProjectFileItem): Promise<void> => {
    const existing = tabs.find((t) => t.kind === 'file' && t.path === item.path)
    if (existing) {
      setActiveTabId(existing.id)
      setEditMode(true)
      return
    }

    try {
      const info: ProjectFileInfo = await call('readProjectFile', { filePath: item.path })
      if (info.isFolder) {
        setFolderPath(info.path)
        setActiveTabId('tab-files')
        void loadFiles(info.path)
        return
      }

      const newId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newTab: PanelTab = {
        id: newId,
        kind: 'file',
        title: info.name,
        path: info.path,
        relPath: item.relPath || info.relPath,
        language: info.language,
        content: info.content,
        initialContent: info.content,
        isDirty: false,
        isBinary: info.isBinary
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newId)
      setEditMode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Auto-open requested file in editor from global store
  useEffect(() => {
    if (!activeEditorFile) return
    const path = activeEditorFile
    clearActiveEditorFile()
    void openFile({
      name: path.split(/[/\\]/).pop() || path,
      path: path,
      relPath: path,
      kind: 'file'
    })
  }, [activeEditorFile])

  // Close tab
  const closeTab = (tabId: string, e?: React.MouseEvent): void => {
    e?.stopPropagation()
    const targetIdx = tabs.findIndex((t) => t.id === tabId)
    if (targetIdx < 0) return

    const target = tabs[targetIdx]
    if (!target) return

    // Never close permanent files tab
    if (target.kind === 'files' && tabs.length === 1) return

    const nextTabs = tabs.filter((t) => t.id !== tabId)
    setTabs(nextTabs)

    if (activeTabId === tabId) {
      const newActive = nextTabs[Math.max(0, targetIdx - 1)] || nextTabs[0]
      if (newActive) setActiveTabId(newActive.id)
    }
  }

  // Create new terminal tab
  const addTerminalTab = (shell: 'powershell' | 'cmd' | 'bash' = 'powershell'): void => {
    const num = terminalCounter
    setTerminalCounter((c) => c + 1)
    const shellLabel = shell === 'powershell' ? 'PowerShell' : shell === 'cmd' ? 'Prompt CMD' : 'Git Bash'
    const newId = `term-${Date.now()}`
    const newTab: PanelTab = {
      id: newId,
      kind: 'terminal',
      title: `${shellLabel} ${num}`,
      shell,
      history: [
        {
          command: `# ${shellLabel} iniciado em ${folderPath}`,
          output: `Elefante Terminal [Versão 1.0.0]\nDiretório de trabalho: ${folderPath}\nDigite qualquer comando e pressione Enter.\n`,
          exitCode: 0,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      currentInput: '',
      commandHistoryList: [],
      historyPointer: -1,
      isRunning: false
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)
    setIsMenuOpen(false)
  }

  // Create new browser tab
  const addBrowserTab = (url: string = 'http://localhost:3000', isMobile: boolean = false): void => {
    const newId = `browser-${Date.now()}`
    const newTab: PanelTab = {
      id: newId,
      kind: 'browser',
      title: isMobile ? 'Emulador Móvel' : 'Navegador Web',
      url,
      inputUrl: url,
      isMobile
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)
    setIsMenuOpen(false)
  }

  // Create new markdown tab
  const addMarkdownTab = (): void => {
    const newId = `md-${Date.now()}`
    const starterContent = `# Anotações do Projeto\n\n- Data: ${new Date().toLocaleDateString()}\n- Projeto: ${rootName}\n\n## Tarefas\n- [ ] Planejar arquitetura\n- [ ] Validar testes unitários\n- [ ] Deploy e entrega\n`
    const newTab: PanelTab = {
      id: newId,
      kind: 'markdown',
      title: 'Nota Rápida.md',
      content: starterContent,
      initialContent: starterContent,
      isDirty: false,
      previewMode: false
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)
    setIsMenuOpen(false)
  }

  // Run command in active terminal tab
  const runCommandInTab = async (tabId: string, cmd: string): Promise<void> => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId && t.kind === 'terminal'
            ? { ...t, history: [], currentInput: '', historyPointer: -1 }
            : t
        )
      )
      return
    }

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId && t.kind === 'terminal') {
          const nextList = [...t.commandHistoryList.filter((c) => c !== trimmed), trimmed]
          return {
            ...t,
            isRunning: true,
            commandHistoryList: nextList,
            historyPointer: nextList.length,
            currentInput: ''
          }
        }
        return t
      })
    )

    const tab = tabs.find((t) => t.id === tabId)
    const shell = tab && tab.kind === 'terminal' ? tab.shell : 'powershell'

    try {
      const res = await call('runProjectCommand', {
        folderPath,
        command: trimmed,
        shell
      })

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId && t.kind === 'terminal') {
            return {
              ...t,
              isRunning: false,
              history: [
                ...t.history,
                {
                  command: trimmed,
                  output: res.output,
                  exitCode: res.exitCode,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }
              ]
            }
          }
          return t
        })
      )
    } catch (err) {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id === tabId && t.kind === 'terminal') {
            return {
              ...t,
              isRunning: false,
              history: [
                ...t.history,
                {
                  command: trimmed,
                  output: err instanceof Error ? err.message : String(err),
                  exitCode: 1,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }
              ]
            }
          }
          return t
        })
      )
    }
  }

  // Handle terminal arrow keys for command history
  const handleTerminalKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    tab: Extract<PanelTab, { kind: 'terminal' }>
  ): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void runCommandInTab(tab.id, tab.currentInput)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (tab.commandHistoryList.length === 0) return
      const nextPtr = Math.max(0, (tab.historyPointer >= 0 ? tab.historyPointer : tab.commandHistoryList.length) - 1)
      const cmd = tab.commandHistoryList[nextPtr] || ''
      setTabs((prev) =>
        prev.map((t) => (t.id === tab.id && t.kind === 'terminal' ? { ...t, historyPointer: nextPtr, currentInput: cmd } : t))
      )
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (tab.historyPointer < 0) return
      const nextPtr = tab.historyPointer + 1
      if (nextPtr >= tab.commandHistoryList.length) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tab.id && t.kind === 'terminal' ? { ...t, historyPointer: -1, currentInput: '' } : t))
        )
      } else {
        const cmd = tab.commandHistoryList[nextPtr] || ''
        setTabs((prev) =>
          prev.map((t) => (t.id === tab.id && t.kind === 'terminal' ? { ...t, historyPointer: nextPtr, currentInput: cmd } : t))
        )
      }
    }
  }

  // Save current active file
  const saveActiveFile = async (): Promise<void> => {
    if (!activeTab || activeTab.kind !== 'file') return
    try {
      await call('writeProjectFile', { filePath: activeTab.path, content: activeTab.content })
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTab.id && tab.kind === 'file' ? { ...tab, initialContent: tab.content, isDirty: false } : tab))
      )
      setSaveFeedback(true)
      setTimeout(() => setSaveFeedback(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  // Indentation support in Code Editor
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const val = textarea.value
      const nextVal = val.substring(0, start) + '  ' + val.substring(end)
      if (activeTab && activeTab.kind === 'file') {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id && t.kind === 'file' ? { ...t, content: nextVal, isDirty: nextVal !== t.initialContent } : t
          )
        )
      }
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>): void => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  // Keyboard Shortcuts (Ctrl+T, Ctrl+Shift+B, Ctrl+Shift+M, Ctrl+S, Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isMod = e.ctrlKey || e.metaKey
      if (isMod && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        addTerminalTab('powershell')
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        addBrowserTab()
      } else if (isMod && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        addMarkdownTab()
      } else if (isMod && e.key.toLowerCase() === 's') {
        if (activeTab && activeTab.kind === 'file') {
          e.preventDefault()
          void saveActiveFile()
        }
      } else if (isMod && e.key.toLowerCase() === 'w') {
        if (tabs.length > 1) {
          e.preventDefault()
          closeTab(activeTabId)
        }
      } else if (e.key === 'Escape') {
        if (isMenuOpen) {
          setIsMenuOpen(false)
        } else if (editMode && activeTab && activeTab.kind === 'file') {
          setEditMode(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeTab, activeTabId, tabs, isMenuOpen, editMode])

  // Drag resizer handler
  const handleResizerMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    setIsResizing(true)
    document.body.classList.add('is-resizing-panel')
    const startX = e.clientX
    const startW = rightPanelWidth

    const onMouseMove = (ev: MouseEvent): void => {
      const delta = startX - ev.clientX
      const newW = Math.max(320, Math.min(window.innerWidth - 260, startW + delta))
      setRightPanelWidth(newW)
    }

    const onMouseUp = (): void => {
      setIsResizing(false)
      document.body.classList.remove('is-resizing-panel')
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleResizerDoubleClick = (): void => {
    if (rightPanelWidth < 680) {
      setRightPanelWidth(880)
    } else if (rightPanelWidth < 1000) {
      setRightPanelWidth(Math.min(1280, window.innerWidth - 300))
    } else {
      setRightPanelWidth(560)
    }
  }

  // Quick Agent Launcher in Orca Menu
  const openAgentEngine = (engine: 'antigravity' | 'codex' | 'gemini'): void => {
    const engineModelIds = new Set(models.filter((m) => m.engine === engine).map((m) => m.id))
    const agent = agents.find((a) => engineModelIds.has(a.modelId) || a.name.toLowerCase().includes(engine))
    if (agent) {
      const conv = conversations.find((c) => (c.kind === 'dm' && c.name === agent.id) || c.members.includes(agent.id))
      if (conv) {
        navigate({ kind: 'conversation', id: conv.id })
      } else {
        navigate({ kind: 'agent', id: agent.id })
      }
    } else {
      navigate({ kind: 'tuca' })
    }
    setIsMenuOpen(false)
  }

  // Filter files in Explorer view
  const filteredFiles = useMemo(() => {
    if (!fileSearch.trim()) return files
    const query = fileSearch.toLowerCase()

    function filterTree(list: ProjectFileItem[]): ProjectFileItem[] {
      const result: ProjectFileItem[] = []
      for (const item of list) {
        if (item.kind === 'file') {
          if (item.name.toLowerCase().includes(query)) result.push(item)
        } else if (item.kind === 'directory') {
          const matchingChildren = filterTree(item.children || [])
          if (matchingChildren.length > 0 || item.name.toLowerCase().includes(query)) {
            result.push({
              ...item,
              children: matchingChildren
            })
          }
        }
      }
      return result
    }

    return filterTree(files)
  }, [files, fileSearch])

  // Filter project files inside the Orca + Menu
  const menuFilteredFiles = useMemo(() => {
    if (!menuSearch.trim() || menuSearch.length < 2) return []
    const q = menuSearch.toLowerCase()
    const found: ProjectFileItem[] = []

    function searchRecursive(items: ProjectFileItem[]): void {
      for (const it of items) {
        if (it.kind === 'file' && it.name.toLowerCase().includes(q)) {
          found.push(it)
          if (found.length >= 6) return
        }
        if (it.kind === 'directory' && it.children) {
          searchRecursive(it.children)
          if (found.length >= 6) return
        }
      }
    }
    searchRecursive(files)
    return found
  }, [files, menuSearch])

  return (
    <aside className="project-panel">
      {/* Draggable Resizer on the Left Edge */}
      <div
        className={`project-panel__resizer ${isResizing ? 'is-active' : ''}`}
        onMouseDown={handleResizerMouseDown}
        onDoubleClick={handleResizerDoubleClick}
        title={L(
          'Arraste para redimensionar (Duplo clique para alternar largura)',
          'Drag to resize (Double-click to toggle width)'
        )}
      >
        <div className="project-panel__resizer-handle" />
      </div>

      {/* Orca-Style Top Tabs Bar */}
      <div className="orca-tabs-bar">
        <div className="orca-tabs-list">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const isFile = tab.kind === 'file'
            const isTerminal = tab.kind === 'terminal'
            const isBrowser = tab.kind === 'browser'
            const isMarkdown = tab.kind === 'markdown'
            const isFiles = tab.kind === 'files'

            return (
              <div
                key={tab.id}
                className={`orca-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
                title={tab.kind === 'file' ? tab.path : tab.title}
              >
                <span className="orca-tab__icon">
                  {isFiles && <Icon name="folder" size={12} />}
                  {isFile && <span className="orca-tab__ext">{getFileExtLabel(tab.title)}</span>}
                  {isTerminal && <Icon name="terminal" size={12} />}
                  {isBrowser && <Icon name="globe" size={12} />}
                  {isMarkdown && <Icon name="file" size={12} />}
                </span>
                <span className="orca-tab__title">{tab.title}</span>
                {isFile && tab.isDirty && <span className="orca-tab__dirty-dot" title="Não salvo" />}
                {isMarkdown && tab.isDirty && <span className="orca-tab__dirty-dot" title="Não salvo" />}
                {(!isFiles || tabs.length > 1) && (
                  <button
                    className="orca-tab__close"
                    onClick={(e) => closeTab(tab.id, e)}
                    title={L('Fechar aba (Ctrl+W)', 'Close tab')}
                  >
                    <Icon name="x" size={9} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Plus '+' Button for Orca Dropdown Menu */}
        <div className="orca-tabs-actions">
          <button
            className={`orca-btn-add ${isMenuOpen ? 'is-active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title={L('Nova aba (Ctrl+T)', 'New tab')}
          >
            <Icon name="plus" size={13} />
          </button>
          <button
            className="orca-btn-action"
            title={L('Abrir pasta no Explorer / VS Code', 'Open folder')}
            onClick={() => openFolderPath(folderPath)}
          >
            <Icon name="external" size={12} />
          </button>
          <button
            className="orca-btn-action"
            title={L('Fechar painel (Ctrl+B)', 'Close panel')}
            onClick={() => setRightPanelOpen(false)}
          >
            <Icon name="x" size={12} />
          </button>
        </div>

        {/* Orca Floating Menu (matching user reference screenshot) */}
        {isMenuOpen && (
          <div ref={menuRef} className="orca-menu-popover">
            <div className="orca-menu-search">
              <Icon name="search" size={12} />
              <input
                ref={menuInputRef}
                type="text"
                placeholder={L(
                  'Buscar abas abertas, histórico, arquivos, URLs...',
                  'Search open tabs, history, files, URLs...'
                )}
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (menuSearch.startsWith('http://') || menuSearch.startsWith('https://') || menuSearch.includes('localhost')) {
                      addBrowserTab(menuSearch.startsWith('http') ? menuSearch : `http://${menuSearch}`)
                    } else if (menuFilteredFiles.length > 0 && menuFilteredFiles[0]) {
                      void openFile(menuFilteredFiles[0])
                      setIsMenuOpen(false)
                    } else {
                      addTerminalTab('powershell')
                    }
                  }
                }}
              />
            </div>

            <div className="orca-menu-content">
              {/* Filtered Files Results if query matches project files */}
              {menuFilteredFiles.length > 0 && (
                <div className="orca-menu-section">
                  <div className="orca-menu-section-title">{L('Arquivos do Projeto', 'Project Files')}</div>
                  {menuFilteredFiles.map((f) => (
                    <div
                      key={f.path}
                      className="orca-menu-item"
                      onClick={() => {
                        void openFile(f)
                        setIsMenuOpen(false)
                      }}
                    >
                      <span className="orca-menu-item__icon">
                        <Icon name="fileCode" size={14} />
                      </span>
                      <span className="orca-menu-item__label">{f.name}</span>
                      <span className="orca-menu-item__shortcut small muted">{f.relPath}</span>
                    </div>
                  ))}
                  <div className="orca-menu-divider" />
                </div>
              )}

              {/* Main Actions */}
              {(!menuSearch || 'powershell terminal'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addTerminalTab('powershell')}>
                  <span className="orca-menu-item__icon orca-menu-item__icon--ps">
                    <Icon name="terminal" size={13} />
                  </span>
                  <span className="orca-menu-item__label">Novo Terminal: PowerShell</span>
                  <span className="orca-menu-item__shortcut">Ctrl+T</span>
                </div>
              )}

              {(!menuSearch || 'cmd prompt terminal'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addTerminalTab('cmd')}>
                  <span className="orca-menu-item__icon orca-menu-item__icon--cmd">
                    <Icon name="terminal" size={13} />
                  </span>
                  <span className="orca-menu-item__label">Novo Terminal: Prompt CMD</span>
                </div>
              )}

              {(!menuSearch || 'git bash terminal'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addTerminalTab('bash')}>
                  <span className="orca-menu-item__icon orca-menu-item__icon--bash">
                    <Icon name="zap" size={13} />
                  </span>
                  <span className="orca-menu-item__label">Novo Terminal: Git Bash</span>
                </div>
              )}

              {(!menuSearch || 'navegador browser web url'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addBrowserTab()}>
                  <span className="orca-menu-item__icon">
                    <Icon name="globe" size={14} />
                  </span>
                  <span className="orca-menu-item__label">Nova Aba do Navegador</span>
                  <span className="orca-menu-item__shortcut">Ctrl+⇧+B</span>
                </div>
              )}

              {(!menuSearch || 'markdown nota texto'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addMarkdownTab()}>
                  <span className="orca-menu-item__icon">
                    <Icon name="file" size={14} />
                  </span>
                  <span className="orca-menu-item__label">Novo Markdown</span>
                  <span className="orca-menu-item__shortcut">Ctrl+⇧+M</span>
                </div>
              )}

              {(!menuSearch || 'emulador movel mobile celular'.includes(menuSearch.toLowerCase())) && (
                <div className="orca-menu-item" onClick={() => addBrowserTab('http://localhost:3000', true)}>
                  <span className="orca-menu-item__icon">
                    <Icon name="phone" size={14} />
                  </span>
                  <span className="orca-menu-item__label">Novo Emulador Móvel</span>
                  <span className="orca-menu-item__shortcut muted">Unassigned</span>
                </div>
              )}

              <div className="orca-menu-divider" />

              {/* Agents Quick Access */}
              <div className="orca-menu-item" onClick={() => openAgentEngine('antigravity')}>
                <span className="orca-menu-item__icon orca-menu-item__icon--antigravity">
                  <Icon name="spark" size={13} />
                </span>
                <span className="orca-menu-item__label">Antigravity</span>
                <span className="orca-menu-item__chevron">›</span>
              </div>

              <div className="orca-menu-item" onClick={() => openAgentEngine('codex')}>
                <span className="orca-menu-item__icon orca-menu-item__icon--codex">
                  <Icon name="cpu" size={13} />
                </span>
                <span className="orca-menu-item__label">Codex</span>
                <span className="orca-menu-item__chevron">›</span>
              </div>

              <div className="orca-menu-item" onClick={() => openAgentEngine('gemini')}>
                <span className="orca-menu-item__icon orca-menu-item__icon--gemini">
                  <Icon name="bolt" size={13} />
                </span>
                <span className="orca-menu-item__label">Gemini</span>
                <span className="orca-menu-item__chevron">›</span>
              </div>

              <div className="orca-menu-divider" />

              <div
                className="orca-menu-item"
                onClick={() => {
                  navigate({ kind: 'settings' })
                  setIsMenuOpen(false)
                }}
              >
                <span className="orca-menu-item__icon">
                  <Icon name="gear" size={13} />
                </span>
                <span className="orca-menu-item__label">Configurações do agente...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab View 1: Project Files Tree */}
      {activeTab && activeTab.kind === 'files' && (
        <div className="project-panel__files-view">
          {/* Subheader with folder title & reload */}
          <div className="project-panel__folder-bar">
            <div className="project-panel__folder-info">
              <Icon name="folder" size={14} />
              <strong title={folderPath}>{rootName}</strong>
              <span className="small muted">{folderPath.split(/[/\\]/).slice(-2).join('/')}</span>
            </div>
            <button
              className="icon-btn icon-btn--xs"
              title={L('Recarregar arquivos', 'Reload files')}
              onClick={() => void loadFiles(folderPath)}
            >
              <Icon name="refresh" size={12} />
            </button>
          </div>

          <div className="project-panel__search-box">
            <Icon name="search" size={12} />
            <input
              type="text"
              placeholder={L('Encontrar arquivos no projeto…', 'Search files…')}
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
            />
            {fileSearch && (
              <button className="icon-btn icon-btn--xs" onClick={() => setFileSearch('')}>
                <Icon name="x" size={10} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="project-panel__loading">
              <span className="spinner" /> {L('Carregando arquivos…', 'Loading files…')}
            </div>
          ) : error ? (
            <div className="project-panel__error">
              <span>{error}</span>
              <button className="btn btn--sm" onClick={() => void loadFiles(folderPath)}>
                {L('Tentar novamente', 'Try again')}
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="project-panel__empty">
              <span className="muted small">{L('Nenhum arquivo encontrado.', 'No files found.')}</span>
            </div>
          ) : (
            <div className="project-panel__tree">
              <FileTreeList
                items={filteredFiles}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onOpenFile={(item) => void openFile(item)}
                openPaths={new Set(tabs.filter((t): t is Extract<PanelTab, { kind: 'file' }> => t.kind === 'file').map((t) => t.path))}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab View 2: Code / Image File Editor */}
      {activeTab && activeTab.kind === 'file' && (
        <div className="project-panel__editor-view">
          {/* Active File Action Bar */}
          <div className="editor-actions-bar">
            <div className="editor-actions-bar__path" title={activeTab.path}>
              <code>{activeTab.relPath}</code>
              <span className="tag tag--sm">{activeTab.language}</span>
            </div>
            <div className="editor-actions-bar__buttons">
              {!activeTab.isBinary && (
                <>
                  <button
                    className={`btn btn--sm ${editMode ? 'btn--primary' : 'btn--ghost'}`}
                    title={L('Editor Direto com indentação e salvamento', 'Direct Editor mode')}
                    onClick={() => setEditMode(true)}
                  >
                    <Icon name="compose" size={12} />
                    <span>{L('Editor', 'Editor')}</span>
                  </button>
                  <button
                    className={`btn btn--sm ${!editMode ? 'btn--primary' : 'btn--ghost'}`}
                    title={L('Alternar modo de visualização com Syntax Highlighting', 'Toggle syntax preview mode')}
                    onClick={() => setEditMode(false)}
                  >
                    <Icon name="fileCode" size={12} />
                    <span>Syntax Preview</span>
                  </button>
                  <button
                    className="btn btn--sm btn--ghost"
                    title={L('Copiar código', 'Copy code')}
                    onClick={() => {
                      navigator.clipboard.writeText(activeTab.content)
                      setCopyFeedback(true)
                      setTimeout(() => setCopyFeedback(false), 1800)
                    }}
                  >
                    <Icon name={copyFeedback ? 'check' : 'copy'} size={12} />
                    <span>{copyFeedback ? L('Copiado!', 'Copied!') : L('Copiar', 'Copy')}</span>
                  </button>
                  <button
                    className={`btn btn--sm ${activeTab.isDirty ? 'btn--primary' : 'btn--ghost'}`}
                    title={L('Salvar arquivo (Ctrl+S)', 'Save file (Ctrl+S)')}
                    onClick={() => void saveActiveFile()}
                    disabled={!activeTab.isDirty}
                  >
                    <Icon name="save" size={12} />
                    <span>{saveFeedback ? L('Salvo!', 'Saved!') : L('Salvar', 'Save')}</span>
                  </button>
                </>
              )}
              <button
                className="btn btn--sm btn--ghost"
                title={L('Abrir no VS Code / editor padrão', 'Open in VS Code')}
                onClick={() => openFolderPath(activeTab.path)}
              >
                <Icon name="external" size={12} />
                <span>VS Code</span>
              </button>
            </div>
          </div>

          {/* Terminal-Styled Window Bar */}
          <div className="terminal-header">
            <div className="terminal-dots">
              <span
                className="terminal-dot terminal-dot--red"
                onClick={() => closeTab(activeTab.id)}
                title={L('Fechar aba (Ctrl+W)', 'Close tab')}
              />
              <span
                className="terminal-dot terminal-dot--yellow"
                onClick={() => setEditMode(!editMode)}
                title={L('Alternar modo', 'Toggle mode')}
              />
              <span
                className="terminal-dot terminal-dot--green"
                onClick={() => void saveActiveFile()}
                title={L('Salvar arquivo (Ctrl+S)', 'Save file')}
              />
            </div>
            <div className="terminal-title">
              <Icon name="fileCode" size={11} />
              <span>{activeTab.title}</span>
              {activeTab.isDirty && <span className="terminal-dirty-tag">● {L('não salvo', 'unsaved')}</span>}
            </div>
            <span className="terminal-badge">
              {activeTab.isBinary ? 'MÍDIA / BINÁRIO' : editMode ? 'EDITOR ATIVO' : 'SYNTAX PREVIEW'}
            </span>
          </div>

          {/* Content Body */}
          <div className="editor-body">
            {activeTab.isBinary ? (
              <div className="editor-binary-preview">
                {activeTab.title.match(/\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i) ? (
                  <div className="editor-image-frame">
                    <img
                      src={
                        activeTab.content && activeTab.content.startsWith('data:')
                          ? activeTab.content
                          : `file:///${activeTab.path.replace(/\\/g, '/')}`
                      }
                      alt={activeTab.title}
                    />
                    <div className="editor-image-meta">
                      <span>{activeTab.title}</span>
                      <button className="btn btn--xs" onClick={() => openFolderPath(activeTab.path)}>
                        <Icon name="external" size={11} />
                        <span>{L('Abrir no sistema', 'Open in system')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="editor-binary-note">
                    <Icon name="file" size={32} />
                    <p>{L('Arquivo binário.', 'Binary file.')}</p>
                    <button className="btn btn--sm" onClick={() => openFolderPath(activeTab.path)}>
                      {L('Abrir com aplicativo padrão', 'Open with default app')}
                    </button>
                  </div>
                )}
              </div>
            ) : !editMode ? (
              <div className="terminal-view-wrapper">
                <CodeHighlight code={activeTab.content} language={activeTab.language} onDoubleClick={() => setEditMode(true)} />
                <div className="terminal-hint-bar">
                  <span>{L('Duplo clique para editar diretamente.', 'Double click to edit.')}</span>
                  <span>{activeTab.content.split('\n').length} {L('linhas', 'lines')}</span>
                </div>
              </div>
            ) : (
              <div className="code-editor-container code-editor-container--terminal">
                <div ref={gutterRef} className="code-editor-gutter">
                  {activeTab.content.split('\n').map((_, i) => (
                    <span key={i} className="gutter-num">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  className="code-editor-textarea code-editor-textarea--terminal"
                  value={activeTab.content}
                  onScroll={handleScroll}
                  onKeyDown={handleTextareaKeyDown}
                  onChange={(e) => {
                    const newContent = e.target.value
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTab.id && t.kind === 'file'
                          ? { ...t, content: newContent, isDirty: newContent !== t.initialContent }
                          : t
                      )
                    )
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          {/* Bottom Status Bar */}
          {!activeTab.isBinary && (
            <div className="editor-status-bar">
              <div className="editor-status-bar__left">
                <span>UTF-8</span>
                <span>{activeTab.language.toUpperCase()}</span>
                <span>{activeTab.content.split('\n').length} {L('linhas', 'lines')}</span>
                <span>{activeTab.content.length} {L('caracteres', 'chars')}</span>
              </div>
              <div className="editor-status-bar__right">
                <span>Ctrl+S: Salvar · Ctrl+W: Fechar · Esc: Visualizar</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab View 3: Integrated Interactive Terminal */}
      {activeTab && activeTab.kind === 'terminal' && (
        <div className="terminal-tab-view">
          {/* Terminal Tab Bar / Header */}
          <div className="terminal-tab-header">
            <div className="terminal-tab-header__left">
              <span className={`terminal-tab-status-dot ${activeTab.isRunning ? 'is-running' : 'is-ready'}`} />
              <strong>{activeTab.title}</strong>
              <span className="terminal-tab-cwd muted" title={folderPath}>
                {folderPath}
              </span>
            </div>
            <div className="terminal-tab-header__actions">
              <button
                className="btn btn--xs btn--ghost"
                title={L('Limpar tela (cls)', 'Clear screen')}
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id && t.kind === 'terminal' ? { ...t, history: [] } : t))
                  )
                }
              >
                Limpar
              </button>
              <button
                className="btn btn--xs btn--ghost"
                title={L('Executar comando no VS Code / Terminal Externo', 'External')}
                onClick={() => openFolderPath(folderPath)}
              >
                <Icon name="external" size={11} />
                <span>Externo</span>
              </button>
            </div>
          </div>

          {/* Terminal Console Stream Body */}
          <div className="terminal-console-body">
            {activeTab.history.map((h, i) => (
              <div key={i} className="terminal-log-entry">
                <div className="terminal-log-cmd">
                  <span className="terminal-log-prompt">
                    {activeTab.shell === 'powershell' ? 'PS' : activeTab.shell === 'cmd' ? 'CMD' : 'BASH'}&gt;
                  </span>
                  <span className="terminal-log-cmd-text">{h.command}</span>
                  <span className={`terminal-log-exit ${h.exitCode === 0 ? 'is-ok' : 'is-err'}`}>
                    {h.exitCode === 0 ? '✓' : `err ${h.exitCode}`}
                  </span>
                  <span className="terminal-log-time">{h.time}</span>
                </div>
                {h.output && <pre className="terminal-log-output">{h.output}</pre>}
              </div>
            ))}
            {activeTab.isRunning && (
              <div className="terminal-log-entry is-running">
                <span className="spinner spinner--sm" /> {L('Executando comando…', 'Running command…')}
              </div>
            )}
            <div ref={terminalBottomRef} />
          </div>

          {/* Terminal Input Bar */}
          <div className="terminal-input-bar">
            <span className="terminal-input-prompt">
              {activeTab.shell === 'powershell' ? 'PS' : activeTab.shell === 'cmd' ? 'CMD' : 'BASH'}&gt;
            </span>
            <input
              type="text"
              className="terminal-input-field"
              placeholder={L('Digite um comando (ex: npm run dev, git status, dir)...', 'Type a command...')}
              value={activeTab.currentInput}
              disabled={activeTab.isRunning}
              onChange={(e) => {
                const val = e.target.value
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTab.id && t.kind === 'terminal' ? { ...t, currentInput: val } : t))
                )
              }}
              onKeyDown={(e) => handleTerminalKeyDown(e, activeTab)}
              autoFocus
            />
            <button
              className="btn btn--xs btn--primary"
              disabled={activeTab.isRunning || !activeTab.currentInput.trim()}
              onClick={() => void runCommandInTab(activeTab.id, activeTab.currentInput)}
            >
              <Icon name="play" size={11} />
            </button>
          </div>

          {/* Quick Terminal Chips */}
          <div className="terminal-quick-chips">
            <span className="small muted">Atalhos:</span>
            {['npm run dev', 'git status', 'dir', 'npm test', 'cls'].map((chip) => (
              <button
                key={chip}
                className="chip-btn"
                onClick={() => void runCommandInTab(activeTab.id, chip)}
                disabled={activeTab.isRunning}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab View 4: Integrated Web Browser / Mobile Emulator */}
      {activeTab && activeTab.kind === 'browser' && (
        <div className={`browser-tab-view ${activeTab.isMobile ? 'is-mobile-view' : ''}`}>
          {/* Browser Navigation Bar */}
          <div className="browser-nav-bar">
            <div className="browser-nav-actions">
              <button
                className="icon-btn icon-btn--xs"
                title={L('Recarregar página', 'Reload')}
                onClick={() => setIframeKey((k) => k + 1)}
              >
                <Icon name="refresh" size={12} />
              </button>
            </div>

            <div className="browser-address-bar">
              <Icon name="globe" size={12} />
              <input
                type="text"
                value={activeTab.inputUrl}
                placeholder="http://localhost:3000"
                onChange={(e) => {
                  const val = e.target.value
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id && t.kind === 'browser' ? { ...t, inputUrl: val } : t))
                  )
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    let formatted = activeTab.inputUrl.trim()
                    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
                      formatted = `http://${formatted}`
                    }
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTab.id && t.kind === 'browser'
                          ? { ...t, url: formatted, inputUrl: formatted }
                          : t
                      )
                    )
                    setIframeKey((k) => k + 1)
                  }
                }}
              />
            </div>

            <div className="browser-external-actions">
              <button
                className="btn btn--xs btn--ghost"
                title={L('Abrir no navegador padrão do sistema', 'Open in system browser')}
                onClick={() => void call('openExternal', { url: activeTab.url })}
              >
                <Icon name="external" size={12} />
                <span>Navegador</span>
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="browser-presets-bar">
            <span className="small muted">Locais:</span>
            {['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:4000'].map(
              (preset) => (
                <button
                  key={preset}
                  className={`chip-btn ${activeTab.url === preset ? 'is-active' : ''}`}
                  onClick={() => {
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTab.id && t.kind === 'browser'
                          ? { ...t, url: preset, inputUrl: preset }
                          : t
                      )
                    )
                    setIframeKey((k) => k + 1)
                  }}
                >
                  {preset.replace('http://', '')}
                </button>
              )
            )}
          </div>

          {/* Frame Container */}
          <div className="browser-frame-container">
            {activeTab.isMobile ? (
              <div className="mobile-emulator-chassis">
                <div className="mobile-emulator-island" />
                <iframe
                  key={iframeKey}
                  src={activeTab.url}
                  className="mobile-emulator-iframe"
                  title="Mobile Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            ) : (
              <iframe
                key={iframeKey}
                src={activeTab.url}
                className="browser-desktop-iframe"
                title="Browser Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>
        </div>
      )}

      {/* Tab View 5: Markdown Scratchpad */}
      {activeTab && activeTab.kind === 'markdown' && (
        <div className="markdown-tab-view">
          <div className="markdown-tab-header">
            <div className="markdown-tab-title">
              <Icon name="file" size={13} />
              <span>{activeTab.title}</span>
              {activeTab.isDirty && <span className="terminal-dirty-tag">● {L('não salvo', 'unsaved')}</span>}
            </div>
            <div className="markdown-tab-actions">
              <button
                className={`btn btn--xs ${!activeTab.previewMode ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id && t.kind === 'markdown' ? { ...t, previewMode: false } : t))
                  )
                }
              >
                Editar
              </button>
              <button
                className={`btn btn--xs ${activeTab.previewMode ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() =>
                  setTabs((prev) =>
                    prev.map((t) => (t.id === activeTab.id && t.kind === 'markdown' ? { ...t, previewMode: true } : t))
                  )
                }
              >
                Visualizar
              </button>
              <button
                className="btn btn--xs btn--ghost"
                onClick={() => {
                  navigator.clipboard.writeText(activeTab.content)
                  alert('Conteúdo copiado!')
                }}
              >
                <Icon name="copy" size={11} />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <div className="markdown-tab-body">
            {activeTab.previewMode ? (
              <div className="markdown-preview-pane">
                <CodeHighlight code={activeTab.content} language="markdown" />
              </div>
            ) : (
              <textarea
                className="markdown-textarea"
                value={activeTab.content}
                onChange={(e) => {
                  const val = e.target.value
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTab.id && t.kind === 'markdown'
                        ? { ...t, content: val, isDirty: val !== t.initialContent }
                        : t
                    )
                  )
                }}
                placeholder="# Escreva em Markdown..."
                spellCheck={false}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

function FileTreeList({
  items,
  expandedFolders,
  onToggleFolder,
  onOpenFile,
  openPaths,
  level = 0
}: {
  items: ProjectFileItem[]
  expandedFolders: Set<string>
  onToggleFolder: (path: string) => void
  onOpenFile: (item: ProjectFileItem) => void
  openPaths: Set<string>
  level?: number
}): ReactNode {
  return (
    <ul className="file-tree-list" style={{ paddingLeft: level === 0 ? 0 : 12 }}>
      {items.map((item) => {
        const isDir = item.kind === 'directory'
        const isExpanded = isDir && expandedFolders.has(item.path)
        const isOpen = !isDir && openPaths.has(item.path)

        return (
          <li key={item.path} className="file-tree-item">
            {isDir ? (
              <div className="file-tree-row file-tree-row--dir" onClick={() => onToggleFolder(item.path)}>
                <span className={`file-tree-arrow ${isExpanded ? 'is-expanded' : ''}`}>
                  <Icon name="chevron" size={10} />
                </span>
                <span className="file-tree-icon file-tree-icon--folder">
                  <Icon name="folder" size={13} />
                </span>
                <span className="file-tree-name">{item.name}</span>
              </div>
            ) : (
              <div
                className={`file-tree-row file-tree-row--file ${isOpen ? 'is-open' : ''}`}
                onClick={() => onOpenFile(item)}
              >
                <span className="file-tree-icon file-tree-icon--file">
                  <span className="file-ext-tag">{getFileExtLabel(item.name)}</span>
                </span>
                <span className="file-tree-name">{item.name}</span>
                {item.size !== undefined && (
                  <span className="file-tree-size small muted">{formatSize(item.size)}</span>
                )}
              </div>
            )}

            {isDir && isExpanded && item.children && item.children.length > 0 && (
              <FileTreeList
                items={item.children}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                openPaths={openPaths}
                level={level + 1}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function getFileExtLabel(name: string): string {
  const parts = name.split('.')
  if (parts.length <= 1) return 'txt'
  const ext = parts.pop()!.toLowerCase()
  if (ext.length > 4) return ext.slice(0, 3)
  return ext
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}
