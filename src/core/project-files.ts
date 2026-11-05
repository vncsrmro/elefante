import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs'
import { join, resolve, basename, extname, relative } from 'node:path'
import { exec } from 'node:child_process'
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
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.avif',
  '.mp4', '.mov', '.webm', '.avi', '.mkv',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.bin', '.so', '.dylib',
  '.pdf', '.wasm', '.db', '.sqlite', '.iso'
])

export function getMimeType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    case '.bmp': return 'image/bmp'
    case '.tiff': return 'image/tiff'
    case '.avif': return 'image/avif'
    case '.mp4': return 'video/mp4'
    case '.webm': return 'video/webm'
    case '.mov': return 'video/quicktime'
    case '.mkv': return 'video/x-matroska'
    case '.avi': return 'video/x-msvideo'
    case '.ogg': return 'video/ogg'
    case '.mp3': return 'audio/mpeg'
    case '.wav': return 'audio/wav'
    case '.m4a': return 'audio/mp4'
    case '.aac': return 'audio/aac'
    case '.flac': return 'audio/flac'
    case '.wma': return 'audio/x-ms-wma'
    case '.pdf': return 'application/pdf'
    case '.zip': return 'application/zip'
    case '.tar': return 'application/x-tar'
    case '.gz': return 'application/gzip'
    case '.7z': return 'application/x-7z-compressed'
    case '.rar': return 'application/vnd.rar'
    case '.exe': return 'application/x-msdownload'
    case '.dll': return 'application/x-msdownload'
    case '.db':
    case '.sqlite': return 'application/x-sqlite3'
    case '.wasm': return 'application/wasm'
    default: return 'application/octet-stream'
  }
}

function generateHexDump(buf: Buffer, maxBytes = 256): string {
  const slice = buf.subarray(0, maxBytes)
  const lines: string[] = []
  for (let i = 0; i < slice.length; i += 16) {
    const chunk = slice.subarray(i, i + 16)
    const offset = i.toString(16).padStart(8, '0')
    const hexParts: string[] = []
    let ascii = ''
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        const byte = chunk[j]!
        hexParts.push(byte.toString(16).padStart(2, '0'))
        ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
      } else {
        hexParts.push('  ')
      }
    }
    const hex1 = hexParts.slice(0, 8).join(' ')
    const hex2 = hexParts.slice(8, 16).join(' ')
    lines.push(`${offset}  ${hex1}  ${hex2}  |${ascii}|`)
  }
  return lines.join('\n')
}

export function getFileHexDump(filePath: string, maxBytes = 256): string {
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(maxBytes)
    const bytesRead = readSync(fd, buf, 0, maxBytes, 0)
    closeSync(fd)
    if (bytesRead === 0) return '(Arquivo vazio / 0 bytes)'
    return generateHexDump(buf.subarray(0, bytesRead))
  } catch {
    return '(Visualização hex indisponível)'
  }
}

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

  const isImage = /\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff|avif)$/i.test(ext)
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
          mediaType: 'image',
          mimeType: 'image/svg+xml',
          hexDump: getFileHexDump(normPath, 256),
          language: 'image',
          modifiedAt: st.mtimeMs
        }
      }
      const mime = getMimeType(ext)
      const b64 = readFileSync(normPath).toString('base64')
      const dataUrl = `data:${mime};base64,${b64}`
      return {
        path: normPath,
        relPath: name,
        name,
        content: dataUrl,
        size: st.size,
        isBinary: true,
        mediaType: 'image',
        mimeType: mime,
        hexDump: getFileHexDump(normPath, 256),
        language: 'image',
        modifiedAt: st.mtimeMs
      }
    } catch {
      // fallback
    }
  }

  const isVideo = /\.(mp4|webm|mov|mkv|avi|ogg)$/i.test(ext)
  if (isVideo) {
    const mime = getMimeType(ext)
    let content = ''
    if (st.size <= 80 * 1024 * 1024) {
      try {
        const b64 = readFileSync(normPath).toString('base64')
        content = `data:${mime};base64,${b64}`
      } catch {
        // fallback
      }
    }
    return {
      path: normPath,
      relPath: name,
      name,
      content,
      size: st.size,
      isBinary: true,
      mediaType: 'video',
      mimeType: mime,
      hexDump: getFileHexDump(normPath, 256),
      language: 'video',
      modifiedAt: st.mtimeMs
    }
  }

  const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(ext)
  if (isAudio) {
    const mime = getMimeType(ext)
    let content = ''
    if (st.size <= 80 * 1024 * 1024) {
      try {
        const b64 = readFileSync(normPath).toString('base64')
        content = `data:${mime};base64,${b64}`
      } catch {
        // fallback
      }
    }
    return {
      path: normPath,
      relPath: name,
      name,
      content,
      size: st.size,
      isBinary: true,
      mediaType: 'audio',
      mimeType: mime,
      hexDump: getFileHexDump(normPath, 256),
      language: 'audio',
      modifiedAt: st.mtimeMs
    }
  }

  const isPdf = ext === '.pdf'
  if (isPdf) {
    let content = ''
    if (st.size <= 40 * 1024 * 1024) {
      try {
        const b64 = readFileSync(normPath).toString('base64')
        content = `data:application/pdf;base64,${b64}`
      } catch {
        // fallback
      }
    }
    return {
      path: normPath,
      relPath: name,
      name,
      content,
      size: st.size,
      isBinary: true,
      mediaType: 'pdf',
      mimeType: 'application/pdf',
      hexDump: getFileHexDump(normPath, 256),
      language: 'pdf',
      modifiedAt: st.mtimeMs
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
      mediaType: 'binary',
      mimeType: getMimeType(ext),
      hexDump: getFileHexDump(normPath, 256),
      language: detectLanguage(ext),
      modifiedAt: st.mtimeMs
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
      language: detectLanguage(ext),
      modifiedAt: st.mtimeMs
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
    language: detectLanguage(ext),
    modifiedAt: st.mtimeMs
  }
}

export function writeProjectFile(filePath: string, content: string): { ok: boolean } {
  const normPath = resolve(filePath)
  writeFileSync(normPath, content, 'utf-8')
  return { ok: true }
}

export function runProjectCommand(
  folderPath: string,
  command: string,
  shell: 'powershell' | 'cmd' | 'bash' = 'powershell'
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolvePromise) => {
    const cwd = existsSync(folderPath) ? folderPath : process.cwd()
    let shellExec: string | undefined = undefined
    if (process.platform === 'win32') {
      if (shell === 'cmd') {
        shellExec = process.env['ComSpec'] || 'cmd.exe'
      } else if (shell === 'bash') {
        shellExec = 'bash.exe'
      } else {
        shellExec = 'powershell.exe'
      }
    } else {
      shellExec = shell === 'bash' ? '/bin/bash' : (process.env['SHELL'] || '/bin/sh')
    }

    exec(command, { cwd, shell: shellExec, timeout: 60_000, maxBuffer: 1024 * 1024, env: process.env }, (err, stdout, stderr) => {
      const out = [stdout, stderr].filter(Boolean).join('\n').trim()
      const exitCode = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0)
      resolvePromise({
        output: out || (err ? err.message : '(Comando concluído com sucesso)'),
        exitCode
      })
    })
  })
}
