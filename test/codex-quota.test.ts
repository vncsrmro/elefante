import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
vi.mock('../src/core/engines/codex', () => ({ codexEnv: () => ({}) }))
vi.mock('../src/core/platform', () => ({ spawnable: (file: string, args: string[]) => ({file,args,verbatim:false}) }))
import { spawn } from 'node:child_process'
import { readCodexQuota } from '../src/core/codex-quota'
let child: any
beforeEach(() => {
 child = Object.assign(new EventEmitter(), {stdout: new EventEmitter(), stderr: {resume: vi.fn()}, stdin: Object.assign(new EventEmitter(), {write: vi.fn()}), kill: vi.fn()})
 vi.mocked(spawn).mockReturnValue(child)
})
describe('account quota protocol', () => {
 it('initializes then reads both quota windows without converting percentages to token budgets', async () => {
  const result = readCodexQuota('codex', 'home')
  child.stdout.emit('data', Buffer.from('{"id":1,"result":{}}\n'))
  expect(child.stdin.write.mock.calls[2][0]).toContain('account/rateLimits/read')
  const q = {primary:{usedPercent:23,resetsAt:1800000000,windowDurationMins:300},secondary:{usedPercent:61,resetsAt:1800500000,windowDurationMins:10080}}
  const response = JSON.stringify({id:2,result:{rateLimits:q}})+'\n'
  child.stdout.emit('data', Buffer.from(response.slice(0,20)))
  child.stdout.emit('data', Buffer.from(response.slice(20)))
  expect(await result).toMatchObject(q)
  expect(child.kill).toHaveBeenCalledOnce()
 })
 it('returns unavailable instead of inventing a quota on provider errors', async () => {
  const result = readCodexQuota('codex', 'home')
  child.stdout.emit('data', Buffer.from('{"id":2,"error":{"message":"not available"}}\n'))
  expect(await result).toBeNull()
 })
 it('handles a closed input pipe', async () => {
  const result = readCodexQuota('codex', 'home')
  child.stdin.emit('error', new Error('EPIPE'))
  expect(await result).toBeNull()
 })
})
