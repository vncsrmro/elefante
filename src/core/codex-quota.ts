import { spawn } from 'node:child_process'
import { codexEnv } from './engines/codex'
import { spawnable } from './platform'

export interface CodexQuota {
  primary?: { usedPercent: number; resetsAt: number | null; windowDurationMins: number | null }
  secondary?: { usedPercent: number; resetsAt: number | null; windowDurationMins: number | null }
  at: number
}

export function readCodexQuota(bin: string, home: string): Promise<CodexQuota | null> {
  return new Promise((resolve) => {
    const command = spawnable(bin, ['app-server'])
    let child: ReturnType<typeof spawn>
    try { child = spawn(command.file, command.args, { env: codexEnv(home), windowsHide: true, windowsVerbatimArguments: command.verbatim }) }
    catch { resolve(null); return }
    let buffer = ''
    let settled = false
    const finish = (value: CodexQuota | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 12000)
    child.on('error', () => finish(null))
    child.stdin?.on('error', () => finish(null))
    child.stderr?.resume()
    child.on('exit', () => finish(null))
    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as { id?: number; result?: { rateLimits?: { primary?: CodexQuota['primary']; secondary?: CodexQuota['secondary'] } }; error?: unknown }
          if (msg.id === 1 && msg.result) {
            child.stdin?.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n')
            child.stdin?.write(JSON.stringify({ id: 2, method: 'account/rateLimits/read', params: { excludeResetCreditDetails: true } }) + '\n')
          } else if (msg.id === 2) {
            const q = msg.result?.rateLimits
            finish(q ? { ...(q.primary ? { primary: q.primary } : {}), ...(q.secondary ? { secondary: q.secondary } : {}), at: Date.now() } : null)
          } else if (msg.id === 1 && msg.error) finish(null)
        } catch { /* Ignore non-JSON diagnostic output. */ }
      }
    })
    child.stdin?.write(JSON.stringify({ id: 1, method: 'initialize', params: { clientInfo: { name: 'elefante', version: '1.0.0' }, capabilities: null } }) + '\n')
  })
}
