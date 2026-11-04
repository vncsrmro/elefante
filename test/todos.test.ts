import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CoreEvent } from '../src/shared/rpc'
import type { Agent, EngineId, Message, Settings } from '../src/shared/types'
import { Db } from '../src/core/db'
import { fakeEngine } from '../src/core/engines/fake'
import type { Engine } from '../src/core/engines/types'
import { Gateway } from '../src/core/gateway'
import { Runner } from '../src/core/runs'

const ready = { installed: true, loggedIn: true }

function agent(id: string, handle: string, extra: Partial<Agent> = {}): Agent {
  return {
    id,
    name: handle,
    handle,
    role: '',
    color: 'sky',
    instructions: '',
    modelId: 'sonnet',
    effort: 'low',
    limit: 1_000_000,
    used: 0,
    grants: {},
    memory: 'auto',
    computer: false,
    archived: false,
    ...extra
  }
}

let db: Db
let events: CoreEvent[]
let settings: Settings
let gateway: Gateway

function runner(plan: (tools: string[]) => { tool: string; args: Record<string, unknown> } | null): Runner {
  let called = false
  const claude: Engine = {
    id: 'claude',
    async *run(turn) {
      let reply = 'ok'
      if (turn.mcpUrl) {
        const client = new Client({ name: 'scripted', version: '0' })
        await client.connect(new StreamableHTTPClientTransport(new URL(turn.mcpUrl)))
        const tools = (await client.listTools()).tools.map((t) => t.name)
        const p = plan(tools)
        if (p && !called) {
          called = true
          await client.callTool({ name: p.tool, arguments: p.args })
          reply = `chamei ${p.tool}`
        }
        await client.close()
      }
      yield { type: 'text', delta: reply }
      yield { type: 'done', text: reply, usage: { inputTokens: 10, cacheReadTokens: 0, outputTokens: 2 } }
    }
  }
  const engines: Record<EngineId, Engine> = {
    claude,
    codex: fakeEngine('codex'),
    opencode: fakeEngine('opencode'),
    pi: fakeEngine('pi'),
    gemini: fakeEngine('gemini'),
    antigravity: fakeEngine('antigravity'),
    api: fakeEngine('api')
  }
  return new Runner({
    db,
    engines,
    settings: async () => settings,
    emit: (e) => events.push(e),
    workDir: mkdtempSync(join(tmpdir(), 'ad-work-')),
    gateway
  })
}

const agentMessages = (): Message[] => db.messages().filter((m) => m.author.kind === 'agent')

beforeEach(async () => {
  db = new Db(join(mkdtempSync(join(tmpdir(), 'ad-db-')), 'test.db'))
  events = []
  settings = {
    workspaceName: 'Vitor',
    context: '',
    routerModel: 'haiku',
    memoryModel: 'haiku',
    memoryLearning: 'auto',
    engines: { claude: ready, codex: ready, opencode: ready, pi: ready, gemini: ready, antigravity: ready, api: ready },
    defaultLimit: 1_000_000,
    approvalTtlHours: 24,
    theme: 'system',
    language: 'pt'
  }
  gateway = new Gateway()
  await gateway.start()
  db.saveAgent(agent('a1', 'theo'))
  db.createConversation({ id: 'd1', kind: 'dm', name: 'a1', members: ['a1'] })
})

afterEach(async () => {
  await gateway.stop()
})

describe('gerenciar_tarefas (To-Do List)', () => {
  it('updates the to-do list in run state and persists completed steps', async () => {
    const r = runner((tools) => {
      expect(tools).toContain('gerenciar_tarefas')
      return {
        tool: 'gerenciar_tarefas',
        args: {
          tarefas: [
            { id: '1', titulo: 'Ler documentação', status: 'done' },
            { id: '2', titulo: 'Criar componente To-Do', status: 'in_progress' },
            { id: '3', titulo: 'Validar testes', status: 'pending' }
          ]
        }
      }
    })

    await r.send('d1', 'crie o plano de tarefas')
    await r.idle()

    const msgs = agentMessages()
    expect(msgs).toHaveLength(1)
    const run = msgs[0]?.run
    expect(run?.todos).toBeDefined()
    expect(run?.todos).toHaveLength(3)
    expect(run?.todos?.[0]).toEqual({ id: '1', title: 'Ler documentação', status: 'done' })
    expect(run?.todos?.[1]).toEqual({ id: '2', title: 'Criar componente To-Do', status: 'in_progress' })
    expect(run?.todos?.[2]).toEqual({ id: '3', title: 'Validar testes', status: 'pending' })

    const steps = run?.steps ?? []
    expect(steps.some((s) => s.label.includes('To-Do'))).toBe(true)
  })

  it('stepFor returns active labels while running and completed labels when done', async () => {
    const { stepFor } = await import('../src/core/computer')
    const running = stepFor('bash', { command: 'npm run build' }, true, true)
    expect(running.label).toContain('Executando')
    expect(running.detail).toBe('npm run build')

    const done = stepFor('bash', { command: 'npm run build' }, true, false)
    expect(done.label).toContain('Executou')

    const svcRunning = stepFor('start_service', { name: 'api', port: 3000 }, true, true)
    expect(svcRunning.label).toContain('Iniciando serviço')

    const svcDone = stepFor('start_service', { name: 'api', port: 3000 }, true, false)
    expect(svcDone.label).toContain('Subiu serviço')
  })
})
