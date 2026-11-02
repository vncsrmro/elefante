import { useMemo, type ReactNode } from 'react'

interface Token {
  type: 'keyword' | 'string' | 'comment' | 'number' | 'type' | 'cmd' | 'tag' | 'punct' | 'plain'
  text: string
}

const KEYWORDS = new Set([
  'import', 'export', 'from', 'default', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally',
  'throw', 'new', 'class', 'interface', 'type', 'extends', 'implements', 'async',
  'await', 'typeof', 'instanceof', 'void', 'yield', 'null', 'undefined', 'true', 'false',
  'as', 'enum', 'static', 'public', 'private', 'protected', 'readonly'
])

const SHELL_COMMANDS = new Set([
  'echo', 'set', 'call', 'cd', 'dir', 'md', 'del', 'rm', 'mkdir', 'git', 'npm',
  'node', 'rtk', 'yarn', 'pnpm', 'curl', 'docker', 'cat', 'grep', 'exit', 'sh',
  'bash', 'powershell', 'pwsh', 'pause', 'cls', 'rem', 'goto', 'if', 'exist'
])

export function tokenizeCode(code: string, language: string): Token[][] {
  const lines = code.split('\n')
  return lines.map((line) => tokenizeLine(line, language))
}

function tokenizeLine(line: string, language: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  const isShell = language === 'shell' || language === 'bat'

  while (pos < line.length) {
    // 1. Comments
    if (line.slice(pos).startsWith('//') || (isShell && line.slice(pos).toLowerCase().startsWith('rem ')) || (isShell && line.slice(pos).startsWith('::')) || (line.slice(pos).startsWith('#') && language !== 'css')) {
      tokens.push({ type: 'comment', text: line.slice(pos) })
      break
    }

    // 2. Strings: double quotes
    if (line[pos] === '"') {
      let end = pos + 1
      while (end < line.length && line[end] !== '"') {
        if (line[end] === '\\') end++
        end++
      }
      if (end < line.length) end++
      tokens.push({ type: 'string', text: line.slice(pos, end) })
      pos = end
      continue
    }

    // 3. Strings: single quotes
    if (line[pos] === "'") {
      let end = pos + 1
      while (end < line.length && line[end] !== "'") {
        if (line[end] === '\\') end++
        end++
      }
      if (end < line.length) end++
      tokens.push({ type: 'string', text: line.slice(pos, end) })
      pos = end
      continue
    }

    // 4. Strings: template literals
    if (line[pos] === '`') {
      let end = pos + 1
      while (end < line.length && line[end] !== '`') {
        if (line[end] === '\\') end++
        end++
      }
      if (end < line.length) end++
      tokens.push({ type: 'string', text: line.slice(pos, end) })
      pos = end
      continue
    }

    // 5. JSX / HTML tag brackets
    if (line.slice(pos, pos + 2) === '</' || line[pos] === '<' || line.slice(pos, pos + 2) === '/>' || line[pos] === '>') {
      const match = line.slice(pos).match(/^(<\/?[a-zA-Z0-9_.-]+|\/?>)/)
      if (match) {
        tokens.push({ type: 'tag', text: match[0] })
        pos += match[0].length
        continue
      }
    }

    // 6. Numbers
    const numMatch = line.slice(pos).match(/^\b\d+(?:\.\d+)?\b/)
    if (numMatch) {
      tokens.push({ type: 'number', text: numMatch[0] })
      pos += numMatch[0].length
      continue
    }

    // 7. Words (identifiers, keywords, types)
    const wordMatch = line.slice(pos).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/)
    if (wordMatch) {
      const word = wordMatch[0]
      if (isShell && SHELL_COMMANDS.has(word.toLowerCase())) {
        tokens.push({ type: 'cmd', text: word })
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', text: word })
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(word)) {
        tokens.push({ type: 'type', text: word })
      } else {
        tokens.push({ type: 'plain', text: word })
      }
      pos += word.length
      continue
    }

    // 8. Punctuation
    if (/[{}()[\].,:;=+\-*/%&|<>!~^?@]/.test(line[pos]!)) {
      tokens.push({ type: 'punct', text: line[pos]! })
      pos++
      continue
    }

    // 9. Whitespace or other characters
    tokens.push({ type: 'plain', text: line[pos]! })
    pos++
  }

  return tokens
}

export function CodeHighlight({
  code,
  language,
  onDoubleClick
}: {
  code: string
  language: string
  onDoubleClick?: () => void
}): ReactNode {
  const lines = useMemo(() => tokenizeCode(code, language), [code, language])

  return (
    <div className="terminal-code-view" onDoubleClick={onDoubleClick}>
      <div className="terminal-gutter">
        {lines.map((_, i) => (
          <span key={i} className="terminal-gutter__num">
            {i + 1}
          </span>
        ))}
      </div>
      <div className="terminal-code-body">
        {lines.map((lineTokens, i) => (
          <div key={i} className="terminal-line">
            {lineTokens.length === 0 ? (
              <span>&nbsp;</span>
            ) : (
              lineTokens.map((t, j) => (
                <span key={j} className={`tok tok--${t.type}`}>
                  {t.text}
                </span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
