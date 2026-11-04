import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, basename, extname, relative } from 'node:path'
import type { ProjectFileItem, ProjectFileInfo } from '../shared/types'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'out',
  'coverage',
  '.gemini',
  '.antigravity',
  '.vscode',
  '.idea'
])

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db'
])

function detectLanguage(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ts':
    case '.tsx':
      return 'typescript'
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript'
    case '.json':
      return 'json'
    case '.html':
    case '.htm':
      return 'html'
    case '.css':
    case '.scss':
    case '.sass':
    case '.less':
      return 'css'
    case '.md':
    case '.markdown':
      return 'markdown'
    case '.py':
      return 'python'
    case '.rs':
      return 'rust'
    case '.sh':
    case '.bash':
    case '.ps1':
    case '.bat':
    case '.cmd':
      return 'shell'
    case '.sql':
      return 'sql'
    case '.yaml':
    case '.yml':
      return 'yaml'
    case '.xml':
    case '.svg':
      return 'xml'
    default:
      return 'text'
  }
}

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.mp4', '.mov', '.webm', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.flac',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.bin', '.so', '.dylib',
  '.pdf', '.wasm', '.db', '.sqlite'
])

export function listProjectFiles(folderPath: string, maxDepth = 4): { root: string; name: string; files: ProjectFileItem[] } {
  const normRoot = resolve(folderPath)
  if (!existsSync(normRoot) || !statSync(normRoot).isDirectory()) {
    return { root: normRoot, name: basename(normRoot), files: [] }
  }

  function walk(currentDir: string, depth: number): ProjectFileItem[] {
    if (depth > maxDepth) return []
    try {
      const dirents = readdirSync(currentDir, { withFileTypes: true })
      const items: ProjectFileItem[] = []

      for (const d of dirents) {
        if (d.name.startsWith('.') && d.name !== '.env' && d.name !== '.env.example' && d.name !== '.gitignore') {
          continue
        }
        if (d.isDirectory() && IGNORED_DIRS.has(d.name)) continue
        if (d.isFile() && IGNORED_FILES.has(d.name)) continue

        const fullPath = join(currentDir, d.name)
        const relPath = relative(normRoot, fullPath).replace(/\\/g, '/')

        if (d.isDirectory()) {
          const children = walk(fullPath, depth + 1)
          items.push({
            name: d.name,
            path: fullPath,
            relPath,
            kind: 'directory',
            children
          })
        } else if (d.isFile()) {
          try {
            const st = statSync(fullPath)
            const ext = extname(d.name)
            items.push({
              name: d.name,
              path: fullPath,
              relPath,
              kind: 'file',
              size: st.size,
              ext
            })
          } catch {
            // ignore unreadable file
          }
        }
      }

      // Sort directories first, then alphabetical
      return items.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })
    } catch {
      return []
    }
  }

  const files = walk(normRoot, 1)
  return { root: normRoot, name: basename(normRoot), files }
}

export function readProjectFile(filePath: string): ProjectFileInfo {
  const normPath = resolve(filePath)
  if (!existsSync(normPath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`)
  }

  const st = statSync(normPath)
  const ext = extname(normPath).toLowerCase()
  const name = basename(normPath)

  if (st.isDirectory()) {
    return {
      path: normPath,
      relPath: name,
      name,
      content: '',
      size: 0,
      isBinary: false,
      isFolder: true,
      language: 'folder'
    }
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i.test(ext)
  if (isImage) {
    try {
      if (ext === '.svg') {
        const svgText = readFileSync(normPath, 'utf-8')
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`
        return {
          path: normPath,
          relPath: name,
          name,
          content: dataUrl,
          size: st.size,
          isBinary: true,
          language: 'image'
        }
      }
      const mime = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.ico' ? 'image/x-icon' : ext === '.bmp' ? 'image/bmp' : 'image/jpeg'
      const b64 = readFileSync(normPath).toString('base64')
      const dataUrl = `data:${mime};base64,${b64}`
      return {
        path: normPath,
        relPath: name,
        name,
        content: dataUrl,
        size: st.size,
        isBinary: true,
        language: 'image'
      }
    } catch {
      // fallback
    }
  }

  const isBinary = BINARY_EXTS.has(ext)

  if (isBinary) {
    return {
      path: normPath,
      relPath: name,
      name,
      content: '',
      size: st.size,
      isBinary: true,
      language: detectLanguage(ext)
    }
  }

  // Max 2MB text read
  if (st.size > 2 * 1024 * 1024) {
    const raw = readFileSync(normPath, 'utf-8').slice(0, 100_000)
    return {
      path: normPath,
      relPath: name,
      name,
      content: raw + '\n\n... [Arquivo grande truncado para performance]',
      size: st.size,
      isBinary: false,
      language: detectLanguage(ext)
    }
  }

  const content = readFileSync(normPath, 'utf-8')
  return {
    path: normPath,
    relPath: name,
    name,
    content,
    size: st.size,
    isBinary: false,
    language: detectLanguage(ext)
  }
}

export function writeProjectFile(filePath: string, content: string): { ok: boolean } {
  const normPath = resolve(filePath)
  writeFileSync(normPath, content, 'utf-8')
  return { ok: true }
}
