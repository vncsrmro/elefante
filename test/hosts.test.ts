import { describe, expect, it } from 'vitest'
import { detectHosts } from '../src/core/hosts'

describe('Dynamic Host Discovery', () => {
  it('discovers at least the local machine host with valid metadata', async () => {
    const result = await detectHosts()
    expect(result).toBeDefined()
    expect(result.total).toBeGreaterThanOrEqual(1)
    expect(result.connected).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(result.hosts)).toBe(true)

    const local = result.hosts.find((h) => h.id === 'local' || h.kind === 'local')
    expect(local).toBeDefined()
    expect(local?.connected).toBe(true)
    expect(local?.machineName).toBeTruthy()
  })
})
