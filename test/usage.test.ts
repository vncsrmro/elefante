import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Db } from '../src/core/db'
import { usage } from '../src/core/usage'

describe('Uso e limites', () => {
  it("sums this month by day, by who and by model, and compares with the same stretch of last month", () => {
    const db = new Db(join(mkdtempSync(join(tmpdir(), 'ad-usage-')), 'test.db'))
    const at = (month: number, day: number, hour = 10): number => new Date(2026, month, day, hour).getTime()
    const add = (agentId: string, model: string, tokens: number, when: number, messageId = String(when) + agentId, ms = 1000, apiCostUsd?: number): void =>
      db.addReceipt({ agentId, model, engine: 'claude', inputTokens: tokens, cacheReadTokens: 0, outputTokens: 0, ms, apiCostUsd, messageId, at: when })
    add('lia', 'opus', 1000, at(9, 1), 'm1', 2000, 0.5)
    add('lia', 'opus', 500, at(9, 3), 'm2', 4000, 0.25)
    add('dora', 'sonnet', 300, at(9, 3), 'm3', 3000)
    add('router', 'haiku', 50, at(9, 3))
    add('lia', 'opus', 999, at(9, 28)) // after now: not counted
    add('lia', 'opus', 700, at(8, 2)) // last month, inside the stretch
    add('lia', 'opus', 9000, at(8, 20)) // last month, after it

    const u = usage(db, new Date(2026, 9, 3, 18))
    expect(u.daysInMonth).toBe(31)
    expect(u.days).toHaveLength(3)
    expect(u.days[0]).toEqual({ lia: 1000 })
    expect(u.days[2]).toEqual({ lia: 500, dora: 300, router: 50 })
    expect(u.replies).toBe(3) // the router's turn isn't a reply
    expect(u.avgMs).toBe(3000)
    expect(u.apiUsd).toBe(0.75)
    expect(u.who.map((w) => [w.id, w.tokens, w.replies])).toEqual([
      ['lia', 1500, 2],
      ['dora', 300, 1],
      ['router', 50, 0]
    ])
    expect(u.models.map((m) => [m.model, m.tokens])).toEqual([
      ['opus', 1500],
      ['sonnet', 300],
      ['haiku', 50]
    ])
    expect(u.lastMonth).toBe(700)
    expect(usage(new Db(join(mkdtempSync(join(tmpdir(), 'ad-usage-')), 'test.db')), new Date(2026, 9, 3)).lastMonth).toBeUndefined()
  })
})
