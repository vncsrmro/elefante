import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { L } from '../../../shared/lang'
import { call } from '../rpc'
import { clearActiveEditorFile, openFolderPath, setRightPanelOpen, useStore, type State } from '../store'
import { Icon } from './ui'
import { CodeHighlight } from './CodeHighlight'
import type { ProjectFileItem, ProjectFileInfo } from '../../../shared/types'

interface OpenTab {
  path: string
  name: string
  relPath: string
  language: string
  content: string
  initialContent: string
  isDirty: boolean
  isBinary: boolean
}

export function ProjectExplorer({ currentProject }: { currentProject?: string }): ReactNode {
  const [folderPath, setFolderPath] = useState<string>(currentProject || 'D:\\IA LOCAL')
  const [rootName, setRootName] = useState<string>('IA LOCAL')
  const [files, setFiles] = useState<ProjectFileItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'files' | 'editor'>('files')
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1)
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false)
  const [editMode, setEditMode] = useState<boolean>(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  // Update folderPath if conversation project changes and has value
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
      const res = await call('listProjectFiles', { folderPath: path })
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

  // Toggle folder expand/collapse
  const toggleFolder = (dirPath: string): void => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }

  // Open file in editor tab directly
  const openFile = async (item: ProjectFileItem): Promise<void> => {
    const existingIndex = openTabs.findIndex((t) => t.path === item.path)
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex)
      setActiveTab('editor')
      setEditMode(true)
      return
    }

    try {
      const info: ProjectFileInfo = await call('readProjectFile', { filePath: item.path })
      const newTab: OpenTab = {
        path: info.path,
        name: info.name,
        relPath: item.relPath || info.relPath,
        language: info.language,
        content: info.content,
        initialContent: info.content,
        isDirty: false,
        isBinary: info.isBinary
      }
      setOpenTabs((prev) => {
        const next = [...prev, newTab]
        setActiveFileIndex(next.length - 1)
        return next
      })
      setActiveTab('editor')
      setEditMode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // Auto-open requested file in editor from global store (e.g. from chat markdown link or IPC)
  const activeEditorFile = useStore((s) => s.activeEditorFile)
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
  const closeTab = (index: number, e?: React.MouseEvent): void => {
    e?.stopPropagation()
    const nextTabs = openTabs.filter((_, i) => i !== index)
    setOpenTabs(nextTabs)
    if (activeFileIndex >= nextTabs.length) {
      const newIdx = nextTabs.length - 1
      setActiveFileIndex(newIdx)
      if (newIdx < 0) setActiveTab('files')
    } else if (activeFileIndex === index) {
      setActiveFileIndex(Math.max(0, index - 1))
    }
  }

  // Save current active file
  const saveActiveFile = async (): Promise<void> => {
    if (activeFileIndex < 0 || !openTabs[activeFileIndex]) return
    const current = openTabs[activeFileIndex]!
    try {
      await call('writeProjectFile', { filePath: current.path, content: current.content })
      setOpenTabs((prev) =>
        prev.map((tab, idx) => (idx === activeFileIndex ? { ...tab, initialContent: tab.content, isDirty: false } : tab))
      )
      setSaveFeedback(true)
      setTimeout(() => setSaveFeedback(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  // Handle Tab key indentation inside code editor
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const val = textarea.value
      const nextVal = val.substring(0, start) + '  ' + val.substring(end)
      setOpenTabs((prev) =>
        prev.map((t, i) =>
          i === activeFileIndex ? { ...t, content: nextVal, isDirty: nextVal !== t.initialContent } : t
        )
      )
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

  // Handle keyboard shortcuts (Ctrl+S to save, Ctrl+W to close active tab, Esc to leave edit mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isMod = e.ctrlKey || e.metaKey
      if (isMod && e.key.toLowerCase() === 's') {
        if (activeTab === 'editor' && activeFileIndex >= 0) {
          e.preventDefault()
          void saveActiveFile()
        }
      } else if (isMod && e.key.toLowerCase() === 'w') {
        if (openTabs.length > 0 && activeFileIndex >= 0) {
          e.preventDefault()
          e.stopPropagation()
          closeTab(activeFileIndex)
        }
      } else if (e.key === 'Escape') {
        if (editMode) {
          e.preventDefault()
          setEditMode(false)
        }
      }
    }

    const handleNativeCloseTab = (): void => {
      if (openTabs.length > 0 && activeFileIndex >= 0) {
        closeTab(activeFileIndex)
      } else if (openTabs.length === 0) {
        setRightPanelOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('elefante:close-tab', handleNativeCloseTab)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('elefante:close-tab', handleNativeCloseTab)
    }
  }, [activeTab, activeFileIndex, openTabs, editMode])

  // Filter items by search
  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files
    const query = search.toLowerCase()

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
  }, [files, search])

  const activeTabItem = activeFileIndex >= 0 ? openTabs[activeFileIndex] : null

  return (
    <aside className="project-panel">
      {/* Top Header */}
      <div className="project-panel__header">
        <div className="project-panel__title-box">
          <Icon name="folder" size={15} />
          <div className="project-panel__title-text" title={folderPath}>
            <strong>{rootName}</strong>
            <span className="small muted">{folderPath.split(/[/\\]/).slice(-2).join('/')}</span>
          </div>
        </div>
        <div className="project-panel__header-actions">
          <button
            className="icon-btn icon-btn--sm"
            title={L('Recarregar arquivos', 'Reload files')}
            onClick={() => void loadFiles(folderPath)}
          >
            <Icon name="refresh" size={13} />
          </button>
          <button
            className="icon-btn icon-btn--sm"
            title={L('Abrir pasta no Explorer / VS Code', 'Open folder in Explorer / VS Code')}
            onClick={() => openFolderPath(folderPath)}
          >
            <Icon name="external" size={13} />
          </button>
          <button
            className="icon-btn icon-btn--sm"
            title={L('Fechar painel (Ctrl+B)', 'Close panel')}
            onClick={() => setRightPanelOpen(false)}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Arquivos | Editor */}
      <div className="project-panel__tabs-nav">
        <button
          className={`project-panel__tab-btn ${activeTab === 'files' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <Icon name="folder" size={13} />
          <span>{L('Arquivos', 'Files')}</span>
        </button>
        <button
          className={`project-panel__tab-btn ${activeTab === 'editor' ? 'is-active' : ''}`}
          onClick={() => {
            if (openTabs.length > 0) setActiveTab('editor')
          }}
          disabled={openTabs.length === 0}
        >
          <Icon name="fileCode" size={13} />
          <span>{L('Editor de Código', 'Code Editor')} {openTabs.length > 0 && `(${openTabs.length})`}</span>
        </button>
      </div>

      {/* View 1: File Explorer Tree */}
      {activeTab === 'files' && (
        <div className="project-panel__files-view">
          <div className="project-panel__search-box">
            <Icon name="search" size={12} />
            <input
              type="text"
              placeholder={L('Encontrar arquivos…', 'Search files…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="icon-btn icon-btn--xs" onClick={() => setSearch('')}>
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
                openPaths={new Set(openTabs.map((t) => t.path))}
              />
            </div>
          )}
        </div>
      )}

      {/* View 2: Code Editor & Open Tabs */}
      {activeTab === 'editor' && activeTabItem && (
        <div className="project-panel__editor-view">
          {/* Top Tabs list */}
          <div className="editor-tabs-bar">
            {openTabs.map((tab, idx) => (
              <button
                key={tab.path}
                className={`editor-tab-item ${idx === activeFileIndex ? 'is-active' : ''} ${tab.isDirty ? 'is-dirty' : ''}`}
                onClick={() => setActiveFileIndex(idx)}
                title={tab.relPath}
              >
                <span className="editor-tab-item__ext">{getFileExtLabel(tab.name)}</span>
                <span className="editor-tab-item__name">{tab.name}</span>
                {tab.isDirty && <span className="editor-tab-item__dot" title={L('Alterações não salvas', 'Unsaved')} />}
                <span
                  className="editor-tab-item__close"
                  onClick={(e) => closeTab(idx, e)}
                  title={L('Fechar aba', 'Close tab')}
                >
                  <Icon name="x" size={10} />
                </span>
              </button>
            ))}
          </div>

          {/* Active File Action Bar */}
          <div className="editor-actions-bar">
            <div className="editor-actions-bar__path" title={activeTabItem.path}>
              <code>{activeTabItem.relPath}</code>
              <span className="tag tag--sm">{activeTabItem.language}</span>
            </div>
            <div className="editor-actions-bar__buttons">
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
                <span>{L('Syntax Preview', 'Syntax Preview')}</span>
              </button>
              <button
                className="btn btn--sm btn--ghost"
                title={L('Copiar código', 'Copy code')}
                onClick={() => {
                  navigator.clipboard.writeText(activeTabItem.content)
                  setCopyFeedback(true)
                  setTimeout(() => setCopyFeedback(false), 1800)
                }}
              >
                <Icon name={copyFeedback ? 'check' : 'copy'} size={12} />
                <span>{copyFeedback ? L('Copiado!', 'Copied!') : L('Copiar', 'Copy')}</span>
              </button>
              <button
                className={`btn btn--sm ${activeTabItem.isDirty ? 'btn--primary' : 'btn--ghost'}`}
                title={L('Salvar arquivo (Ctrl+S)', 'Save file (Ctrl+S)')}
                onClick={() => void saveActiveFile()}
                disabled={!activeTabItem.isDirty}
              >
                <Icon name="save" size={12} />
                <span>{saveFeedback ? L('Salvo!', 'Saved!') : L('Salvar', 'Save')}</span>
              </button>
              <button
                className="btn btn--sm btn--ghost"
                title={L('Abrir no VS Code / editor padrão', 'Open in VS Code')}
                onClick={() => openFolderPath(activeTabItem.path)}
              >
                <Icon name="external" size={12} />
                <span>VS Code</span>
              </button>
            </div>
          </div>

          {/* Terminal Window Header */}
          <div className="terminal-header">
            <div className="terminal-dots">
              <span
                className="terminal-dot terminal-dot--red"
                onClick={() => closeTab(activeFileIndex)}
                title={L('Fechar aba (Ctrl+W)', 'Close tab (Ctrl+W)')}
              />
              <span
                className="terminal-dot terminal-dot--yellow"
                onClick={() => setEditMode(!editMode)}
                title={L('Alternar modo (Editor / Syntax Preview)', 'Toggle mode (Editor / Syntax Preview)')}
              />
              <span
                className="terminal-dot terminal-dot--green"
                onClick={() => void saveActiveFile()}
                title={L('Salvar arquivo (Ctrl+S)', 'Save file (Ctrl+S)')}
              />
            </div>
            <div className="terminal-title">
              <Icon name="terminal" size={11} />
              <span>{activeTabItem.name}</span>
              {activeTabItem.isDirty && (
                <span className="terminal-dirty-tag">● {L('não salvo', 'unsaved')}</span>
              )}
            </div>
            <span className="terminal-badge">
              {editMode ? L('EDITOR ATIVO', 'ACTIVE EDITOR') : L('SYNTAX PREVIEW', 'SYNTAX PREVIEW')}
            </span>
          </div>

          {/* Code Content View */}
          <div className="editor-body">
            {activeTabItem.isBinary ? (
              <div className="editor-binary-preview">
                {activeTabItem.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                  <div className="editor-image-frame">
                    <img src={`file://${activeTabItem.path.replace(/\\/g, '/')}`} alt={activeTabItem.name} />
                  </div>
                ) : (
                  <div className="editor-binary-note">
                    <Icon name="file" size={32} />
                    <p>{L('Arquivo binário.', 'Binary file.')}</p>
                    <button className="btn btn--sm" onClick={() => openFolderPath(activeTabItem.path)}>
                      {L('Abrir com aplicativo padrão', 'Open with default app')}
                    </button>
                  </div>
                )}
              </div>
            ) : !editMode ? (
              <div className="terminal-view-wrapper">
                <CodeHighlight
                  code={activeTabItem.content}
                  language={activeTabItem.language}
                  onDoubleClick={() => setEditMode(true)}
                />
                <div className="terminal-hint-bar">
                  <span>{L('Syntax Highlighting Preview. Clique em Editor ou dê duplo clique para editar.', 'Syntax Highlighting Preview. Double click to edit.')}</span>
                  <span>{activeTabItem.content.split('\n').length} {L('linhas', 'lines')}</span>
                </div>
              </div>
            ) : (
              <div className="code-editor-container code-editor-container--terminal">
                <div ref={gutterRef} className="code-editor-gutter">
                  {activeTabItem.content.split('\n').map((_, i) => (
                    <span key={i} className="gutter-num">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  className="code-editor-textarea code-editor-textarea--terminal"
                  value={activeTabItem.content}
                  onScroll={handleScroll}
                  onKeyDown={handleTextareaKeyDown}
                  onChange={(e) => {
                    const newContent = e.target.value
                    setOpenTabs((prev) =>
                      prev.map((t, i) =>
                        i === activeFileIndex
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

          {/* Terminal Editor Bottom Status Bar */}
          <div className="editor-status-bar">
            <div className="editor-status-bar__left">
              <span>UTF-8</span>
              <span>{activeTabItem.language.toUpperCase()}</span>
              <span>{activeTabItem.content.split('\n').length} {L('linhas', 'lines')}</span>
              <span>{activeTabItem.content.length} {L('caracteres', 'chars')}</span>
            </div>
            <div className="editor-status-bar__right">
              <span>Ctrl+S: {L('Salvar', 'Save')} · Ctrl+W: {L('Fechar', 'Close')} · Esc: {L('Visualizar', 'View')}</span>
            </div>
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
