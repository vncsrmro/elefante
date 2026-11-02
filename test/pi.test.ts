import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { piArgs, piExtension, piParser } from '../src/core/engines/pi'

// Lines recorded from `pi -p --mode json` (0.84), trimmed.
const lines = [
  '{"type":"session","version":3,"id":"x","cwd":"/tmp"}',
  '{"type":"message_start","message":{"role":"assistant","content":[]}}',
  '{"type":"message_end","message":{"role":"assistant","content":[],"usage":{"input":200,"output":20,"cacheRead":0,"cacheWrite":0},"stopReason":"toolUse"}}',
  '{"type":"tool_execution_start","toolCallId":"c1","toolName":"web_fetch","args":{"url":"https://example.com"}}',
  '{"type":"message_start","message":{"role":"assistant","content":[]}}',
  '{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"O título é "}}',
  '{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Example Domain."}}',
  '{"type":"message_end","message":{"role":"assistant","content":[],"usage":{"input":150,"output":15,"cacheRead":100,"cacheWrite":0},"stopReason":"stop"}}',
  '{"type":"agent_end","messages":[]}'
]

describe('pi', () => {
  it('turns its events into the engine events', () => {
    const p = piParser()
    const events = lines.flatMap((l) => p.line(l))
    expect(events).toContainEqual({ type: 'web', action: 'fetch', detail: 'https://example.com' })
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta).join('')).toBe('O título é Example Domain.')
    expect(p.end(0, '')).toEqual([{ type: 'done', text: 'O título é Example Domain.', usage: { inputTokens: 450, cacheReadTokens: 100, outputTokens: 35 } }])
  })

  it('reports a model error', () => {
    const p = piParser()
    p.line('{"type":"message_end","message":{"role":"assistant","content":[],"usage":{},"stopReason":"error","errorMessage":"No API key for provider: anthropic"}}')
    expect(p.end(0, '')).toEqual([{ type: 'error', message: 'No API key for provider: anthropic' }])
  })

  it("runs it with only the app's extension and none of the user's setup", () => {
    const args = piArgs({ model: 'openai-codex/gpt-5.6-luna', effort: 'high', system: 'Você é a Iris.' }, '/x/elefante-tools.mjs')
    for (const flag of ['--no-session', '--no-extensions', '--no-builtin-tools', '--no-skills', '--no-context-files', '--no-approve']) expect(args).toContain(flag)
    expect(args.slice(args.indexOf('-e'), args.indexOf('-e') + 2)).toEqual(['-e', '/x/elefante-tools.mjs'])
    expect(args.slice(args.indexOf('--thinking'), args.indexOf('--thinking') + 2)).toEqual(['--thinking', 'high'])
  })

  it('writes an extension Pi can load', async () => {
    const path = piExtension(mkdtempSync(join(tmpdir(), 'pi-')))
    const mod = (await import(path)) as { default: unknown }
    expect(typeof mod.default).toBe('function')
  })
})
