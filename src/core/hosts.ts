// Dynamic host detection for Elefante: local machine + Orca / remote hosts
import { execFile } from 'node:child_process'
import { hostname, platform, userInfo } from 'node:os'
import type { HostDiscoveryResult, HostInfo } from '../shared/types'
import { isWin } from './platform'

export async function detectHosts(): Promise<HostDiscoveryResult> {
  const localMachineName = hostname()
  const localUser = (() => {
    try {
      return userInfo().username
    } catch {
      return 'user'
    }
  })()

  const localHost: HostInfo = {
    id: 'local',
    name: 'Local',
    kind: 'local',
    connected: true,
    machineName: localMachineName,
    platform: platform(),
    selector: '--host local',
    detail: `Este computador (${localUser}@${localMachineName})`
  }

  const hosts: HostInfo[] = [localHost]

  // Try querying Orca hosts (if orca CLI is available)
  try {
    const bin = isWin ? 'orca.exe' : 'orca'
    const output = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        bin,
        ['host', 'list', '--json'],
        { timeout: 3500, windowsHide: true },
        (err, stdout) => {
          if (err) return reject(err)
          resolve(String(stdout || ''))
        }
      )
      child.stdin?.end()
    })

    const parsed = JSON.parse(output) as {
      ok?: boolean
      result?: {
        hosts?: Array<{
          kind?: string
          name?: string
          id?: string
          selector?: string
          machineName?: string
          platform?: string
          connected?: boolean
          connectionStatus?: string
        }>
      }
    }

    if (parsed.ok && Array.isArray(parsed.result?.hosts)) {
      for (const h of parsed.result.hosts) {
        if (!h.name) continue
        if (h.kind === 'local') {
          if (h.machineName) localHost.machineName = h.machineName
          if (h.platform) localHost.platform = h.platform
          continue
        }

        const isSsh = h.kind === 'ssh'
        const isConnected = h.connected === true || h.connectionStatus === 'connected'
        const kind: HostInfo['kind'] = isSsh ? 'ssh' : h.kind === 'environment' ? 'environment' : 'other'

        hosts.push({
          id: h.id || `host-${h.name}`,
          name: h.name,
          kind,
          connected: isConnected,
          machineName: h.machineName,
          platform: h.platform,
          selector: h.selector,
          detail: isSsh
            ? isConnected
              ? 'Conexão SSH ativa'
              : 'SSH configurado (desconectado)'
            : h.kind === 'environment'
              ? 'Ambiente de execução'
              : undefined
        })
      }
    }
  } catch {
    // If Orca is not available, offline, or timed out, localHost is still returned safely
  }

  const connectedCount = hosts.filter((h) => h.connected).length

  return {
    total: hosts.length,
    connected: connectedCount,
    hosts
  }
}
