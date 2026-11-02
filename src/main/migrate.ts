// Elefante was first called agent-desk, and two things on the Mac kept that name: the folder
// with everyone's data, and the Keychain key that encrypts what's saved in it (connector
// logins, tokens, the agents' browser sessions). On the first open after the rename both
// come over, so nothing is lost: the key is copied under the new name (the encrypted data
// stays as it is) and the folder is renamed in place.
import { execFileSync } from 'node:child_process'
import { existsSync, readlinkSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

// What happened: nothing to move, moved, or why it has to wait (nothing was touched then).
export type Moved = 'nothing' | 'moved' | 'old-app-open' | 'keychain-denied'

export function moveFromAgentDesk(opts: { appData: string; dataDir: string; name: string; appPath: string; old?: string }): Moved {
  const was = opts.old ?? 'agent-desk' // a test passes another, so it never reads the real Keychain
  const old = join(opts.appData, was)
  if (existsSync(join(opts.dataDir, 'elefante.db')) || !existsSync(join(old, `${was}.db`))) return 'nothing'
  if (stillOpen(old)) return 'old-app-open'
  if (!copyKey(was, opts.name, opts.appPath)) return 'keychain-denied'

  // A folder made before this ran (only Chromium's files, never data): out of the way.
  if (existsSync(opts.dataDir)) renameSync(opts.dataDir, `${opts.dataDir}-antes-${Date.now()}`)
  renameSync(old, opts.dataDir)
  for (const ext of ['.db', '.db-wal', '.db-shm']) {
    const from = join(opts.dataDir, `${was}${ext}`)
    if (existsSync(from)) renameSync(from, join(opts.dataDir, `elefante${ext}`))
  }
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) rmSync(join(opts.dataDir, f), { force: true })
  return 'moved'
}

// The old app holds a lock in its folder: "<host>-<pid>".
function stillOpen(dir: string): boolean {
  try {
    const pid = Number(readlinkSync(join(dir, 'SingletonLock')).split('-').pop())
    if (!pid) return false
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Electron keeps the key as "<app name> Safe Storage" / "<app name> Key". Reading the old one
// asks the person once (macOS: "security wants to use… agent-desk Safe Storage").
function copyKey(from: string, to: string, appPath: string): boolean {
  const security = (args: string[]): string => execFileSync('/usr/bin/security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    security(['find-generic-password', '-s', `${to} Safe Storage`, '-a', `${to} Key`])
    return true // already there
  } catch {
    // not yet
  }
  let password: string
  try {
    password = security(['find-generic-password', '-w', '-s', `${from} Safe Storage`, '-a', `${from} Key`])
  } catch {
    // No old key: nothing was ever encrypted with it. Any other failure (a "Deny"): wait.
    try {
      security(['find-generic-password', '-s', `${from} Safe Storage`, '-a', `${from} Key`])
      return false
    } catch {
      return true
    }
  }
  try {
    security(['add-generic-password', '-s', `${to} Safe Storage`, '-a', `${to} Key`, '-w', password, '-T', appPath])
    return true
  } catch {
    return false
  }
}

// /Applications/Elefante.app/Contents/MacOS/Elefante → /Applications/Elefante.app
export const bundleOf = (execPath: string): string => dirname(dirname(dirname(execPath)))
