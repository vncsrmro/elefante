import { DatabaseSync } from 'node:sqlite'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const dbPath = 'D:\\IA LOCAL\\Elefante\\data\\elefante.db'
const db = new DatabaseSync(dbPath)
const now = Date.now()
const home = homedir()

// 1. Get all squad agents
const agents = db.prepare(`SELECT id, name, handle FROM agents WHERE kind IS NULL OR kind != 'tuca'`).all()
const agentIds = agents.map((a) => a.id)
console.log('Squad agents:', agents.map((a) => `${a.name} (@${a.handle})`).join(', '))

// 2. Seed MCP Connectors (Supabase, Hostinger, Cloudflare, Orca Agents)
const connectorsToSeed = [
  {
    id: 'mcp-supabase-romeiro',
    name: 'Supabase (romeiro.dev)',
    kind: 'remote',
    url: 'https://mcp.supabase.com/mcp?project_ref=jyhumlvmmmxrrzwwhffg&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching',
    command: null,
    args: '[]',
    env_keys: '[]',
    auth: 'oauth'
  },
  {
    id: 'mcp-hostinger-vps',
    name: 'Hostinger (VPS, DNS & Domínios)',
    kind: 'stdio',
    url: null,
    command: 'npx',
    args: JSON.stringify(['-y', '@hostinger/mcp']),
    env_keys: '[]',
    auth: 'none'
  },
  {
    id: 'mcp-cloudflare',
    name: 'Cloudflare (Workers, DNS, R2, D1)',
    kind: 'remote',
    url: 'https://mcp.cloudflare.com/mcp',
    command: null,
    args: '[]',
    env_keys: '[]',
    auth: 'oauth'
  },
  {
    id: 'mcp-orca-elo',
    name: 'Orca / Elo Multi-Agent',
    kind: 'stdio',
    url: null,
    command: 'C:\\Users\\vncs\\AppData\\Roaming\\uv\\python\\cpython-3.14.7-windows-x86_64-none\\python.exe',
    args: JSON.stringify(['C:\\Users\\vncs\\.local\\share\\elo\\native\\20261013-213739-620451\\agy\\elo\\scripts\\entry.py', 'mcp', 'agy']),
    env_keys: '[]',
    auth: 'none'
  }
]

const upsertConnector = db.prepare(`
  INSERT INTO connectors (id, name, kind, url, command, args, env_keys, auth, synced, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    kind = excluded.kind,
    url = excluded.url,
    command = excluded.command,
    args = excluded.args,
    auth = excluded.auth
`)

for (const c of connectorsToSeed) {
  upsertConnector.run(c.id, c.name, c.kind, c.url, c.command, c.args, c.env_keys, c.auth, now)
}
console.log(`Seeded ${connectorsToSeed.length} MCP connectors.`)

// 3. Lend active project folders from E:\romeiro.dev and D:\IA LOCAL to all squad agents
const projectDirs = [
  { name: 'paperx', path: 'E:\\romeiro.dev\\paperx', readOnly: false },
  { name: 'marcen', path: 'E:\\romeiro.dev\\marcen\\marcen', readOnly: false },
  { name: 'cuqui', path: 'E:\\romeiro.dev\\cuqui', readOnly: false },
  { name: 'safebuddy', path: 'E:\\romeiro.dev\\safe buddy\\safebuddy-redesign', readOnly: false },
  { name: 'reels-food', path: 'E:\\romeiro.dev\\Reels Food', readOnly: false },
  { name: 'romeiro', path: 'E:\\romeiro.dev\\romeiro', readOnly: false },
  { name: 'stival', path: 'E:\\romeiro.dev\\stival', readOnly: false },
  { name: 'versehaven', path: 'E:\\romeiro.dev\\versehaven', readOnly: false }
].filter((p) => existsSync(p.path))

// 4. Grant all MCP connectors to the squad agents & enable Local Host Computer ('mac') + Browser + Folders
const defaultGrants = {}
for (const c of connectorsToSeed) {
  defaultGrants[c.id] = { read: 'allow', write: 'ask', create: 'ask' }
}

const updateAgentPowers = db.prepare(`
  UPDATE agents
  SET computer = 1,
      computer_kind = 'mac',
      browser = 1,
      grants = ?,
      folders = ?
  WHERE id = ?
`)

for (const a of agents) {
  updateAgentPowers.run(JSON.stringify(defaultGrants), JSON.stringify(projectDirs), a.id)
}
console.log(`Enabled Local Computer (SSH/Railway/Supabase/CF/Orca), Browser, MCP grants, and ${projectDirs.length} lent folders on all 6 squad agents.`)

// 5. Discover and Link ALL Local Skills from Antigravity, Firebase, Cloudflare, Orca, etc.
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { body: text }
  const lines = m[1].split(/\r?\n/)
  const field = (key) => {
    const i = lines.findIndex((l) => l.startsWith(`${key}:`))
    if (i < 0) return undefined
    const inline = lines[i].slice(key.length + 1).trim()
    if (inline && !/^[|>][-+]?$/.test(inline)) return inline.replace(/^(["'])(.*)\1$/, '$2')
    const block = []
    for (const l of lines.slice(i + 1)) {
      if (/^\S/.test(l)) break
      block.push(l.trim())
    }
    return block.join(' ').trim() || undefined
  }
  return { name: field('name'), description: field('description'), body: text.slice(m[0].length) }
}

const skillRoots = [
  join(home, '.gemini', 'config', 'skills'),
  join(home, '.gemini', 'config', 'plugins', 'firebase', 'skills'),
  join(home, '.gemini', 'antigravity-cli', 'builtin', 'skills'),
  join(home, '.agents', 'skills')
]

const discoveredSkills = new Map()
for (const root of skillRoots) {
  if (!existsSync(root)) continue
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const dirPath = join(root, entry.name)
    let isDirectory = entry.isDirectory()
    if (!isDirectory && entry.isSymbolicLink()) {
      try {
        isDirectory = statSync(dirPath).isDirectory()
      } catch {}
    }
    if (!isDirectory) continue
    const skillFile = join(dirPath, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    try {
      const raw = readFileSync(skillFile, 'utf8')
      const fm = parseFrontmatter(raw)
      const name = (fm.name || basename(dirPath)).toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
      if (!discoveredSkills.has(name)) {
        discoveredSkills.set(name, {
          name,
          description: fm.description || `Skill ${name}`,
          body: fm.body.trim(),
          source: skillFile
        })
      }
    } catch {}
  }
}

const insertSkill = db.prepare(`
  INSERT INTO skills (id, name, description, body, agents, state, proposed_by, source, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'active', 'user', ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    description = excluded.description,
    body = excluded.body,
    agents = excluded.agents,
    state = 'active',
    source = excluded.source,
    updated_at = excluded.updated_at
`)

for (const [name, s] of discoveredSkills) {
  insertSkill.run(
    `skill-${name}`,
    s.name,
    s.description,
    s.body,
    JSON.stringify(agentIds),
    s.source,
    now,
    now
  )
}

// 6. Add a custom master skill for Infra (Supabase, Railway, Hostinger, SSH, Cloudflare, Orca)
const infraSkillBody = `# Infraestrutura, Deploy & Ferramentas Locais (Vinicius Romeiro)

Todos os agentes do **Elefante** têm acesso direto ao computador host (Windows) via ferramenta \`bash\`, além dos conectores MCP de **Supabase**, **Hostinger**, **Cloudflare** e **Orca**.

## 1. CLIs Instalados e Prontos no Terminal (\`bash\`)
- **Railway CLI**: \`railway\` (\`C:\\Users\\vncs\\AppData\\Roaming\\npm\\railway.cmd\`) — Use \`railway status\`, \`railway logs\`, \`railway up\`, \`railway variables\` para gerenciar deploys e variáveis na Railway.
- **SSH / SCP (OpenSSH)**: \`ssh\` e \`scp\` (\`C:\\WINDOWS\\System32\\OpenSSH\\ssh.exe\`) — Use para acessar VPS na Hostinger ou Oracle Cloud, checar containers Docker remotos, logs do Nginx/Traefik e bancos PostgreSQL.
- **Cloudflare CLI**: \`cf\` (\`C:\\Users\\vncs\\AppData\\Roaming\\npm\\cf.cmd\`) e \`npx wrangler\` — Para deploy de Workers, Pages, DNS, D1, KV e R2.
- **Supabase**: Conector MCP \`Supabase (romeiro.dev)\` (projeto ref \`jyhumlvmmmxrrzwwhffg\`) ou via CLI \`npx supabase\`. Lembre-se: **NÃO usamos Prisma**; usamos \`@supabase/supabase-js\`, \`@supabase/ssr\`, SQL migrations diretas com RLS obrigatório e tipagem gerada + Zod.
- **Firebase**: Skills oficiais de Firestore, Auth, Hosting e App Hosting ativas + \`npx firebase-tools\`.
- **Hostinger**: Conector MCP \`Hostinger (VPS, DNS & Domínios)\` (\`npx -y @hostinger/mcp\`) para gerenciar VPS, domínios e zonas DNS.
- **Orca CLI**: \`orca\` (\`C:\\Users\\vncs\\AppData\\Local\\Programs\\orca\\resources\\bin\\orca.exe\`) para gerenciar worktrees e terminais do Orca.
- **GitHub CLI**: \`gh\` (\`E:\\Tools\\GitHubCLI\\gh.exe\`) e \`git\`.

## 2. Diretórios dos Projetos (Emprestados em \`E:\\romeiro.dev\`)
- \`E:\\romeiro.dev\\paperx\` (PaperX ERP & RAT Móvel)
- \`E:\\romeiro.dev\\marcen\\marcen\` (MARCEN)
- \`E:\\romeiro.dev\\cuqui\` (CUQUI)
- \`E:\\romeiro.dev\\safe buddy\\safebuddy-redesign\` (SafeBuddy)
- \`E:\\romeiro.dev\\Reels Food\` (tapp.food)
- \`E:\\romeiro.dev\\romeiro\` (Portfólio / Hub)
- \`E:\\romeiro.dev\\stival\` (Stival)
- \`E:\\romeiro.dev\\versehaven\` (VerseHaven)
`

insertSkill.run(
  'skill-ecossistema-romeiro-infra',
  'ecossistema-romeiro-supabase-railway-hostinger-ssh',
  'Guia mestre de acesso a Supabase, Railway CLI, Hostinger MCP/VPS, SSH, Cloudflare (cf), Firebase, Orca e pastas em E:\\romeiro.dev.',
  infraSkillBody,
  JSON.stringify(agentIds),
  null,
  now,
  now
)

console.log(`Linked ${discoveredSkills.size + 1} active skills to all 6 squad agents!`)
db.close()
