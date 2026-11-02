import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleOf, moveFromAgentDesk } from '../src/main/migrate'

// Names no Keychain has: the key lookups find nothing, so nothing is asked or written.
const names = { name: 'elefante-test-no-such-app', old: 'agent-desk-test-no-such-app', appPath: '/Applications/Elefante.app' }

function oldInstall(): { appData: string; dataDir: string } {
  const appData = mkdtempSync(join(tmpdir(), 'elefante-migrate-'))
  const old = join(appData, names.old)
  mkdirSync(join(old, 'computers', 'a1', 'work'), { recursive: true })
  writeFileSync(join(old, `${names.old}.db`), 'db')
  writeFileSync(join(old, `${names.old}.db-wal`), 'wal')
  writeFileSync(join(old, 'computers', 'a1', 'work', 'notes.md'), 'kept')
  return { appData, dataDir: join(appData, 'Elefante') }
}

describe('moving the data from agent-desk', () => {
  it('renames the folder and the database, with everything in it', () => {
    const { appData, dataDir } = oldInstall()
    expect(moveFromAgentDesk({ appData, dataDir, ...names })).toBe('moved')
    expect(readFileSync(join(dataDir, 'elefante.db'), 'utf8')).toBe('db')
    expect(readFileSync(join(dataDir, 'elefante.db-wal'), 'utf8')).toBe('wal')
    expect(readFileSync(join(dataDir, 'computers', 'a1', 'work', 'notes.md'), 'utf8')).toBe('kept')
    expect(existsSync(join(appData, names.old))).toBe(false)
  })

  it('does nothing once moved, or on a new install', () => {
    const { appData, dataDir } = oldInstall()
    moveFromAgentDesk({ appData, dataDir, ...names })
    expect(moveFromAgentDesk({ appData, dataDir, ...names })).toBe('nothing')
    const fresh = mkdtempSync(join(tmpdir(), 'elefante-migrate-'))
    expect(moveFromAgentDesk({ appData: fresh, dataDir: join(fresh, 'Elefante'), ...names })).toBe('nothing')
  })

  it('waits, touching nothing, while the old app is open', () => {
    const { appData, dataDir } = oldInstall()
    try {
      symlinkSync(`host-${process.pid}`, join(appData, names.old, 'SingletonLock'))
    } catch {
      return // Windows without SeCreateSymbolicLinkPrivilege
    }
    expect(moveFromAgentDesk({ appData, dataDir, ...names })).toBe('old-app-open')
    expect(existsSync(join(appData, names.old, `${names.old}.db`))).toBe(true)
    expect(existsSync(dataDir)).toBe(false)
  })

  it('moves aside a folder Chromium made before, never mixing it in', () => {
    const { appData, dataDir } = oldInstall()
    mkdirSync(dataDir)
    writeFileSync(join(dataDir, 'Local State'), '{}')
    expect(moveFromAgentDesk({ appData, dataDir, ...names })).toBe('moved')
    expect(existsSync(join(dataDir, 'Local State'))).toBe(false)
    expect(readFileSync(join(dataDir, 'elefante.db'), 'utf8')).toBe('db')
  })

  it('finds the app bundle from its executable', () => {
    expect(bundleOf('/Applications/Elefante.app/Contents/MacOS/Elefante')).toBe('/Applications/Elefante.app')
  })
})
