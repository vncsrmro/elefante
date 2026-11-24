import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  const bridge = turn.mcpUrl
    ? [
        '## Ponte Direta de Ferramentas do Elefante (Navegador, Tarefas, Apps)',
        `Se as ferramentas do Elefante (como \`navegador_abrir\`, \`navegador_clicar\`, \`navegador_digitar\`, \`navegador_ler\`, \`navegador_ver\`, \`navegador_esperar\`, \`navegador_enviar_arquivo\`, \`gerenciar_tarefas\`, \`ask_user\`) não aparecerem diretamente na sua lista de tools MCP desta sessão do Antigravity, elas ESTÃO 100% ATIVAS E LIBERADAS através do Gateway HTTP local deste turno em: \`${turn.mcpUrl}/call\`.`,
        'Para chamar qualquer ferramenta do Elefante (inclusive abrir e controlar o navegador Brave/Chrome do Elefante na tela do usuário), basta executar via `run_command` com `node -e`:',
        '```',
        `node -e "fetch('${turn.mcpUrl}/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'navegador_abrir',arguments:{url:'https://flow.google.com',navegador:'brave',abrir_janela:true}})}).then(r=>r.json()).then(d=>console.log(d.content?.map(c=>c.text).join('\\n')||JSON.stringify(d)))"`,
        '```',
        'NUNCA diga que as ferramentas `navegador_*` estão ausentes ou bloqueadas: use sempre essa ponte HTTP local em `' + `${turn.mcpUrl}/call` + '` para executar `navegador_abrir`, `navegador_ler`, `navegador_clicar`, `navegador_digitar`, `navegador_esperar`, etc. normalmente!'
      ].join('\n')
    : ''
  const sys = [turn.system, bridge].filter(Boolean).join('\n\n')
  return sys ? `${sys}\n\n---\n\n${turn.prompt}` : turn.prompt
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
    'gemini-4-neon-xhigh',
    'gemini-4-neon-high',
    'gemini-4-neon-medium',
    'gemini-4-neon-low',
    'gemini-4-carbon-high',
    'gemini-4-carbon-medium',
    'gemini-4-carbon-low',
    'gemini-4-argon-high',
    'gemini-4-argon-medium',
    'gemini-4-argon-low',
    'gemini-4-hydrogen-xhigh',
    'gemini-4-hydrogen-high',
    'gemini-4-hydrogen-medium',
    'gemini-4-hydrogen-low',
    'gemini-3.8-flash-low',
    'gemini-3.8-flash-medium',
    'gemini-3.8-flash-high',
    'claude-opus-5-5-high',
    'claude-opus-5-5-medium',
    'claude-opus-5-5-low',
    'claude-sonnet-5-5-high',
    'claude-sonnet-5-5-medium',
    'claude-sonnet-5-5-low',
    'claude-opus-4-6-high',
    'claude-sonnet-4-6-high',
    'gpt-oss-120b-medium'
  ]
}

export const antigravityAppDir = (dataDir: string): string => join(dataDir, 'antigravity-home')

function registerMcpGateway(mcpUrl?: string): () => void {
  if (!mcpUrl) return () => {}
  const cfgDir = join(homedir(), '.gemini', 'config')
  const configPath = join(cfgDir, 'mcp_config.json')
  try {
    mkdirSync(cfgDir, { recursive: true })
    let cfg: { mcpServers?: Record<string, { disabled?: boolean; serverUrl?: string }> } = {}
    if (existsSync(configPath)) {
      cfg = JSON.parse(readFileSync(configPath, 'utf8')) as { mcpServers?: Record<string, { disabled?: boolean; serverUrl?: string }> }
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
          const c = JSON.parse(readFileSync(configPath, 'utf8')) as { mcpServers?: Record<string, { disabled?: boolean; serverUrl?: string }> }
          if (c.mcpServers?.['elefante']?.serverUrl === mcpUrl) {
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

export function antigravityEngine(
  bin: () => string | undefined,
  shellEnv: () => Promise<NodeJS.ProcessEnv> = async () => ({})
): Engine {
  return {
    id: 'antigravity',
    async *run(turn) {
      const path = bin()
      if (!path) {
        yield { type: 'error', message: L('O Antigravity CLI (agy) não está instalado. Veja em Configurações.', "Antigravity CLI (agy) isn't installed. See Settings.") }
        return
      }
      const cleanupMcp = registerMcpGateway(turn.mcpUrl)
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        ...(await shellEnv())
      }
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
