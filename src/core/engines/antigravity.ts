import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { lastLines, num, parseJson, runCli, type Parser } from './cli'
import type { Engine, EngineEvent, Turn, Usage } from './types'
import { L } from '../../shared/lang'

export function antigravityParser(): Parser {
  let text = ''
  let usage: Usage | undefined
  let failed = false
  let error = ''
  let doneEmitted = false

  return {
    line(line: string) {
      const ev = parseJson(line)
      if (!ev) return []
      const out: EngineEvent[] = []
      const eventName = ev['event']

      if (eventName === 'step_update') {
        const step = ev['step_update'] as Record<string, unknown> | undefined
        if (step) {
          const stepType = step['step_type']
          if (stepType === 'agent_response') {
            const delta = step['text_delta']
            if (typeof delta === 'string' && delta) {
              text += delta
              out.push({ type: 'text', delta })
            }
          }
          const u = step['usage'] as Record<string, unknown> | undefined
          if (u) {
            usage = {
              inputTokens: num(u['input_tokens']),
              cacheReadTokens: num(u['cache_read_tokens']),
              outputTokens: num(u['output_tokens'])
            }
            out.push({
              type: 'progress',
              tokens: usage.inputTokens + usage.outputTokens,
              cacheRead: usage.cacheReadTokens
            })
          }
        }
      } else if (eventName === 'result') {
        const res = ev['result'] as Record<string, unknown> | undefined
        if (res) {
          if (res['status'] !== 'SUCCESS') {
            failed = true
            error = String(res['error'] ?? res['response'] ?? L('O Antigravity terminou com erro.', 'Antigravity ended with an error.'))
          } else {
            const u = res['usage'] as Record<string, unknown> | undefined
            if (u) {
              usage = {
                inputTokens: num(u['input_tokens']),
                cacheReadTokens: num(u['cache_read_tokens']),
                outputTokens: num(u['output_tokens'])
              }
            }
            if (typeof res['response'] === 'string' && !text) {
              text = res['response']
              out.push({ type: 'text', delta: text })
            }
            doneEmitted = true
            out.push({
              type: 'done',
              text,
              usage: usage ?? { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 }
            })
          }
        }
      }
      return out
    },
    end(code: number | null, stderr: string) {
      if (failed) return [{ type: 'error', message: error }]
      if (doneEmitted) return []
      if (text) {
        return [{
          type: 'done',
          text,
          usage: usage ?? { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0 }
        }]
      }
      const detail = lastLines(stderr)
      return [{
        type: 'error',
        message: L(`O Antigravity saiu sem resposta (código ${code ?? '?'}).`, `Antigravity exited without a reply (code ${code ?? '?'}).`) + (detail ? `\n${detail}` : '')
      }]
    }
  }
}

export function antigravityInput(turn: Turn): string {
  return turn.system ? `${turn.system}\n\n---\n\n${turn.prompt}` : turn.prompt
}

export function antigravityArgs(turn: Turn): string[] {
  const model = turn.model.includes(':')
    ? turn.model.split(':')[1]!
    : turn.model.includes('/')
      ? turn.model.slice(turn.model.indexOf('/') + 1)
      : turn.model || 'gemini-4-argon-high'

  const hasEffortSuffix = /-(low|medium|high|xhigh|max)$/i.test(model)
  const effort = ['low', 'medium', 'high', 'xhigh', 'max'].includes(turn.effort) ? turn.effort : 'high'
  const effortArgs = hasEffortSuffix ? [] : ['--effort', effort]

  return [
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    ...effortArgs,
    '--model', model
  ]
}

export function antigravityModels(): string[] {
  return [
    'gemini-4-argon-high',
    'gemini-4-argon-medium',
    'gemini-4-argon-low',
    'gemini-3.8-flash-low',
    'gemini-3.8-flash-medium',
    'gemini-3.8-flash-high',
    'claude-opus-5-5-high',
    'claude-sonnet-5-5-high',
    'gpt-oss-120b-medium'
  ]
}

function registerMcpGateway(mcpUrl?: string): () => void {
  if (!mcpUrl) return () => {}
  const configPath = join(homedir(), '.gemini', 'config', 'mcp_config.json')
  try {
    let cfg: { mcpServers?: Record<string, unknown> } = {}
    if (existsSync(configPath)) {
      cfg = JSON.parse(readFileSync(configPath, 'utf8')) as { mcpServers?: Record<string, unknown> }
    }
    cfg.mcpServers = cfg.mcpServers ?? {}
    cfg.mcpServers['elefante'] = {
      disabled: false,
      serverUrl: mcpUrl
    }
    writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8')
    return () => {
      try {
        if (existsSync(configPath)) {
          const c = JSON.parse(readFileSync(configPath, 'utf8')) as { mcpServers?: Record<string, unknown> }
          if (c.mcpServers?.['elefante']) {
            delete c.mcpServers['elefante']
            writeFileSync(configPath, JSON.stringify(c, null, 2), 'utf8')
          }
        }
      } catch {}
    }
  } catch (e) {
    console.error('[antigravity] failed to register gateway MCP in mcp_config.json', e)
    return () => {}
  }
}

export function antigravityEngine(bin: () => string | undefined, shellEnv: () => Promise<NodeJS.ProcessEnv> = async () => ({})): Engine {
  return {
    id: 'antigravity',
    async *run(turn) {
      const path = bin()
      if (!path) {
        yield { type: 'error', message: L('O Antigravity (agy) não está instalado. Veja em Configurações.', "Antigravity (agy) isn't installed. See Settings.") }
        return
      }
      const cleanupMcp = registerMcpGateway(turn.mcpUrl)
      const env = { ...process.env, ...(await shellEnv()) }
      try {
        yield* runCli({
          bin: path,
          args: antigravityArgs(turn),
          stdin: antigravityInput(turn),
          cwd: turn.cwd,
          signal: turn.signal,
          parser: antigravityParser(),
          env
        })
      } finally {
        cleanupMcp()
      }
    }
  }
}
