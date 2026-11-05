import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { L } from '../../../shared/lang'
import { openFileInEditor, openFolderPath, revealPath } from '../store'
import { Icon } from './ui'

export interface ParsedFileTarget {
  rawUrl: string
  filePath: string
  fileUrl: string
  fileName: string
  line?: number
  endLine?: number
}

interface FileLinkPopoverProps {
  target: ParsedFileTarget
  anchorRect: DOMRect
  onClose: () => void
}

export function FileLinkPopover({ target, anchorRect, onClose }: FileLinkPopoverProps): ReactNode {
  const [copied, setCopied] = useState<boolean>(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Copy helper
  const handleCopy = (e?: React.MouseEvent): void => {
    e?.stopPropagation()
    void navigator.clipboard.writeText(target.filePath)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Close on outside click or escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Enter') {
        // Default action: open in editor
        e.preventDefault()
        openFileInEditor(target.filePath, target.line)
        onClose()
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, target])

  // Calculate coordinates relative to viewport
  const width = 360
  const estimatedHeight = 220
  let top = anchorRect.bottom + 6
  let left = anchorRect.left

  if (left + width > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - width - 12)
  }
  if (left < 12) left = 12

  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, anchorRect.top - estimatedHeight - 6)
  }

  return createPortal(
    <div
      ref={popoverRef}
      className="file-link-popover"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999
      }}
      role="dialog"
      aria-label={L('Opções do arquivo', 'File options')}
    >
      {/* Header with path & actions */}
      <div className="file-link-popover__header">
        <span className="file-link-popover__path" title={target.fileUrl || target.filePath}>
          {target.fileUrl || target.filePath}
        </span>
        <div className="file-link-popover__header-actions">
          <button
            type="button"
            className="file-link-popover__icon-btn"
            onClick={handleCopy}
            title={copied ? L('Copiado!', 'Copied!') : L('Copiar caminho', 'Copy path')}
          >
            <Icon name={copied ? 'check' : 'copy'} size={13} />
          </button>
          <button
            type="button"
            className="file-link-popover__icon-btn"
            onClick={onClose}
            title={L('Fechar', 'Close')}
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      </div>

      {/* Menu Options */}
      <div className="file-link-popover__menu">
        <button
          type="button"
          className="file-link-popover__item"
          onClick={() => {
            openFileInEditor(target.filePath, target.line)
            onClose()
          }}
        >
          <span className="file-link-popover__item-label">
            {L('Abrir arquivo', 'Open file')}
          </span>
          <kbd className="file-link-popover__badge">Ctrl + Click</kbd>
        </button>

        <button
          type="button"
          className="file-link-popover__item"
          onClick={() => {
            openFolderPath(target.filePath)
            onClose()
          }}
        >
          <span className="file-link-popover__item-label">
            {L('Abrir com o aplicativo padrão', 'Open with default application')}
          </span>
          <kbd className="file-link-popover__badge">⇧ + Ctrl + Click</kbd>
        </button>

        <button
          type="button"
          className="file-link-popover__item"
          onClick={() => {
            openFileInEditor(target.filePath, target.line)
            onClose()
          }}
        >
          <span className="file-link-popover__item-label">
            {L('Abrir neste grupo', 'Open in this group')}
          </span>
        </button>

        <button
          type="button"
          className="file-link-popover__item"
          onClick={() => {
            revealPath(target.filePath)
            onClose()
          }}
        >
          <span className="file-link-popover__item-label file-link-popover__item-label--with-icon">
            <Icon name="external" size={13} />
            <span>{L('Mostrar no Explorador de Arquivos', 'Show in File Explorer')}</span>
          </span>
        </button>

        <button
          type="button"
          className="file-link-popover__item"
          onClick={handleCopy}
        >
          <span className="file-link-popover__item-label file-link-popover__item-label--with-icon">
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            <span>{copied ? L('Caminho copiado!', 'Path copied!') : L('Copiar caminho', 'Copy path')}</span>
          </span>
        </button>
      </div>
    </div>,
    document.body
  )
}
