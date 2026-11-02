// Cloud & Dev CLI Hub: detects 24+ infrastructure, cloud, database, DevOps and AI CLIs
// installed on the machine, which account/email/org is currently authenticated, and reads
// project-level files inside the selected project folder to show live project badges!
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CloudCliId, CloudCliInfo, ProjectCliContext } from '../shared/types'
import { findOnPath, isWin } from './platform'

interface CliSpec {
  id: CloudCliId
  name: string
  category: 'cloud' | 'database' | 'code' | 'optimizer'
  description: string
  bins: string[]
  loginCmd: string
  installCmd: string
  docsUrl: string
  versionArgs: string[]
  detectAuth: (bin: string) => Promise<{ loggedIn: boolean; account?: string; detail?: string }>
}

function runCmd(bin: string, args: string[], timeoutMs = 4000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const useShell = isWin && /\.(cmd|bat|ps1)$/i.test(bin)
    let done = false
    const finish = (code: number, stdout: string, stderr: string): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() })
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {}
      finish(124, '', 'timeout')
    }, timeoutMs)

    const child = execFile(
      bin,
      args,
      {
        env: process.env,
        timeout: timeoutMs,
        windowsHide: true,
        shell: useShell
      },
      (err: (Error & { code?: number | string }) | null, stdout: string | Buffer, stderr: string | Buffer) => {
        const code = err && typeof err.code === 'number' ? err.code : err ? 1 : 0
        finish(code, String(stdout ?? ''), String(stderr ?? ''))
      }
    )
    child.stdin?.end()
  })
}

const home = homedir()

const SPECS: CliSpec[] = [
  {
    id: 'gh',
    name: 'GitHub CLI',
    category: 'code',
    description: 'Repositórios, Pull Requests, GitHub Actions e Releases.',
    bins: ['gh'],
    loginCmd: 'gh auth login',
    installCmd: isWin ? 'winget install --id GitHub.cli' : 'brew install gh',
    docsUrl: 'https://cli.github.com',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['auth', 'status'])
      const out = `${r.stdout}\n${r.stderr}`
      const m = out.match(/Logged in to [^\s]+ account ([^\s(]+)/i) || out.match(/account\s+([a-zA-Z0-9_-]+)/i)
      if (r.code === 0 || m) {
        return { loggedIn: true, account: m?.[1] ?? 'GitHub Conectado', detail: 'Token OAuth ativo no GitHub CLI' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode gh auth login)' }
    }
  },
  {
    id: 'supabase',
    name: 'Supabase CLI',
    category: 'database',
    description: 'Postgres, Edge Functions, Auth, Storage e Migrations.',
    bins: ['supabase'],
    loginCmd: 'supabase login',
    installCmd: 'npm install -g supabase',
    docsUrl: 'https://supabase.com/docs/guides/cli',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const tokenEnv = process.env['SUPABASE_ACCESS_TOKEN']
      const tokenPaths = [
        join(home, '.supabase', 'access-token'),
        join(process.env['APPDATA'] ?? '', 'supabase', 'access-token'),
        join(process.env['LOCALAPPDATA'] ?? '', 'supabase', 'access-token')
      ]
      const hasTokenFile = tokenPaths.some((p) => p && existsSync(p))
      const r = await runCmd(bin, ['projects', 'list'], 3500)
      if (r.code === 0 && !/not logged in|access token/i.test(r.stderr)) {
        const lines = r.stdout.split('\n').filter((l) => l.includes('|'))
        const count = Math.max(0, lines.length - 1)
        return {
          loggedIn: true,
          account: count > 0 ? `${count} projetos vinculados` : 'Conta autenticada',
          detail: 'Supabase Access Token ativo'
        }
      }
      if (tokenEnv || hasTokenFile) {
        return { loggedIn: true, account: 'Token salvo localmente', detail: '~/.supabase/access-token' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode supabase login)' }
    }
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare (cf / Wrangler)',
    category: 'cloud',
    description: 'Workers, Pages, D1, R2, KV, DNS e Zero Trust.',
    bins: ['cf', 'wrangler'],
    loginCmd: 'wrangler login',
    installCmd: 'npm install -g wrangler',
    docsUrl: 'https://developers.cloudflare.com/workers/wrangler/',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['whoami'], 4000)
      const out = `${r.stdout}\n${r.stderr}`
      const email = out.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (email || /You are logged in/i.test(out)) {
        return { loggedIn: true, account: email ?? 'Cloudflare OAuth Ativo', detail: 'Workers, R2, D1 & DNS prontos' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode wrangler login)' }
    }
  },
  {
    id: 'railway',
    name: 'Railway CLI',
    category: 'cloud',
    description: 'Deploy instantâneo de containers, bancos, Redis e filas.',
    bins: ['railway'],
    loginCmd: 'railway login',
    installCmd: 'npm install -g @railway/cli',
    docsUrl: 'https://docs.railway.com/guides/cli',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const cfgPath = join(home, '.railway', 'config.json')
      if (existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
          if (cfg?.user?.token || cfg?.tokens) {
            const r = await runCmd(bin, ['whoami'], 3000)
            const who = r.stdout.split('\n')[0]?.trim()
            return { loggedIn: true, account: who || cfg?.user?.email || 'Railway Conectado', detail: '~/.railway/config.json' }
          }
        } catch {}
      }
      return { loggedIn: false, detail: 'Desconectado (rode railway login)' }
    }
  },
  {
    id: 'vercel',
    name: 'Vercel CLI',
    category: 'cloud',
    description: 'Deploy de Next.js, Edge Middleware, Domínios e Previews.',
    bins: ['vercel'],
    loginCmd: 'vercel login',
    installCmd: 'npm install -g vercel',
    docsUrl: 'https://vercel.com/docs/cli',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['whoami'], 3500)
      const out = `${r.stdout}\n${r.stderr}`
      if (r.code === 0 && r.stdout && !/Error|not logged in/i.test(out)) {
        const lines = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
        return { loggedIn: true, account: lines[lines.length - 1], detail: 'Vercel CLI autenticado' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode vercel login)' }
    }
  },
  {
    id: 'firebase',
    name: 'Firebase CLI',
    category: 'cloud',
    description: 'Firestore, Cloud Functions, Hosting, Auth e App Hosting.',
    bins: ['firebase'],
    loginCmd: 'firebase login',
    installCmd: 'npm install -g firebase-tools',
    docsUrl: 'https://firebase.google.com/docs/cli',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const cfgPath = join(home, '.config', 'configstore', 'firebase-tools.json')
      if (existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
          const email = cfg?.user?.email || cfg?.tokens?.user?.email
          if (email || cfg?.tokens?.refresh_token) {
            return { loggedIn: true, account: email ?? 'Google Account Conectada', detail: 'firebase-tools OAuth ativo' }
          }
        } catch {}
      }
      const r = await runCmd(bin, ['login:list'], 3500)
      const email = r.stdout.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (email) return { loggedIn: true, account: email, detail: 'Sessão Google ativa' }
      return { loggedIn: false, detail: 'Desconectado (rode firebase login)' }
    }
  },
  {
    id: 'aws',
    name: 'AWS CLI',
    category: 'cloud',
    description: 'S3, EC2, Lambda, RDS, CloudFront, ECS e IAM.',
    bins: ['aws'],
    loginCmd: 'aws configure sso',
    installCmd: isWin ? 'winget install Amazon.AWSCLI' : 'brew install awscli',
    docsUrl: 'https://aws.amazon.com/cli/',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const credPath = join(home, '.aws', 'credentials')
      const cfgPath = join(home, '.aws', 'config')
      if (existsSync(credPath) || existsSync(cfgPath)) {
        return { loggedIn: true, account: process.env['AWS_PROFILE'] ?? 'default profile', detail: '~/.aws/credentials configurado' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode aws configure)' }
    }
  },
  {
    id: 'gcloud',
    name: 'Google Cloud (gcloud)',
    category: 'cloud',
    description: 'Cloud Run, GKE, BigQuery, Vertex AI e Cloud SQL.',
    bins: ['gcloud'],
    loginCmd: 'gcloud auth login',
    installCmd: isWin ? 'winget install Google.CloudSDK' : 'brew install --cask google-cloud-sdk',
    docsUrl: 'https://cloud.google.com/sdk/gcloud',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['config', 'get-value', 'account'], 3500)
      const email = r.stdout.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (email) return { loggedIn: true, account: email, detail: 'Google Cloud SDK ativo' }
      return { loggedIn: false, detail: 'Desconectado (rode gcloud auth login)' }
    }
  },
  {
    id: 'az',
    name: 'Azure CLI (az)',
    category: 'cloud',
    description: 'Azure App Service, AKS, Functions, OpenAI e CosmosDB.',
    bins: ['az'],
    loginCmd: 'az login',
    installCmd: isWin ? 'winget install Microsoft.AzureCLI' : 'brew install azure-cli',
    docsUrl: 'https://learn.microsoft.com/cli/azure/',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const azProfile = join(home, '.azure', 'azureProfile.json')
      if (existsSync(azProfile)) {
        try {
          const txt = readFileSync(azProfile, 'utf8').replace(/^\uFEFF/, '')
          const parsed = JSON.parse(txt)
          const sub = parsed?.subscriptions?.[0]
          if (sub) return { loggedIn: true, account: sub?.user?.name || sub?.name, detail: `Subscription: ${sub?.name}` }
        } catch {}
      }
      return { loggedIn: false, detail: 'Desconectado (rode az login)' }
    }
  },
  {
    id: 'netlify',
    name: 'Netlify CLI',
    category: 'cloud',
    description: 'Deploy de sites Jamstack, Serverless Functions e Edge.',
    bins: ['netlify'],
    loginCmd: 'netlify login',
    installCmd: 'npm install -g netlify-cli',
    docsUrl: 'https://docs.netlify.com/cli/get-started/',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const cfgPath = join(home, '.netlify', 'config.json')
      if (existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
          const userId = cfg?.userId
          const user = userId && cfg?.users?.[userId]
          if (user?.email || user?.name) {
            return { loggedIn: true, account: user.email || user.name, detail: 'Netlify OAuth ativo' }
          }
        } catch {}
      }
      return { loggedIn: false, detail: 'Desconectado (rode netlify login)' }
    }
  },
  {
    id: 'fly',
    name: 'Fly.io (flyctl)',
    category: 'cloud',
    description: 'MicroVMs globais, Fly Postgres e containers distribuídos.',
    bins: ['flyctl', 'fly'],
    loginCmd: 'fly auth login',
    installCmd: isWin ? 'powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"' : 'brew install flyctl',
    docsUrl: 'https://fly.io/docs/flyctl/',
    versionArgs: ['version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['auth', 'whoami'], 3000)
      if (r.code === 0 && r.stdout && !/Error|not logged in/i.test(r.stdout + r.stderr)) {
        return { loggedIn: true, account: r.stdout.split('\n')[0]?.trim(), detail: 'Fly.io autenticado' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode fly auth login)' }
    }
  },
  {
    id: 'neon',
    name: 'Neon Serverless Postgres',
    category: 'database',
    description: 'Branching instantâneo de Postgres serverless e autoscaling.',
    bins: ['neonctl', 'neon'],
    loginCmd: 'neonctl auth',
    installCmd: 'npm install -g neonctl',
    docsUrl: 'https://neon.tech/docs/reference/neon-cli',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const creds = join(home, '.config', 'neonctl', 'credentials.json')
      if (existsSync(creds)) return { loggedIn: true, account: 'Neon OAuth Ativo', detail: 'Postgres branching pronto' }
      return { loggedIn: false, detail: 'Desconectado (rode neonctl auth)' }
    }
  },
  {
    id: 'turso',
    name: 'Turso (libSQL Edge DB)',
    category: 'database',
    description: 'SQLite distribuído na borda com réplicas globais.',
    bins: ['turso'],
    loginCmd: 'turso auth login',
    installCmd: 'brew install tursodatabase/tap/turso',
    docsUrl: 'https://docs.turso.tech/cli/introduction',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['auth', 'whoami'], 3000)
      if (r.code === 0 && r.stdout && !/not logged in/i.test(r.stdout)) {
        return { loggedIn: true, account: r.stdout.split('\n')[0]?.trim(), detail: 'Turso CLI autenticado' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode turso auth login)' }
    }
  },
  {
    id: 'planetscale',
    name: 'PlanetScale (pscale)',
    category: 'database',
    description: 'MySQL/Vitess horizontal com branching de schema sem downtime.',
    bins: ['pscale'],
    loginCmd: 'pscale auth login',
    installCmd: isWin ? 'scoop install pscale' : 'brew install planetscale/tap/pscale',
    docsUrl: 'https://planetscale.com/docs/concepts/planetscale-environment-setup',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const tok = join(home, '.config', 'planetscale', 'access-token')
      if (existsSync(tok)) return { loggedIn: true, account: 'PlanetScale Conectado', detail: 'Access token ativo' }
      return { loggedIn: false, detail: 'Desconectado (rode pscale auth login)' }
    }
  },
  {
    id: 'stripe',
    name: 'Stripe CLI',
    category: 'cloud',
    description: 'Webhooks em tempo real, Billing, Checkout e testes locais.',
    bins: ['stripe'],
    loginCmd: 'stripe login',
    installCmd: isWin ? 'scoop install stripe' : 'brew install stripe/stripe-cli/stripe',
    docsUrl: 'https://docs.stripe.com/stripe-cli',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const cfgPath = join(home, '.config', 'stripe', 'config.toml')
      if (existsSync(cfgPath)) {
        const txt = readFileSync(cfgPath, 'utf8')
        const acct = txt.match(/account_id\s*=\s*['"]([^'"]+)['"]/)?.[1] || txt.match(/display_name\s*=\s*['"]([^'"]+)['"]/)?.[1]
        if (acct || /test_mode_api_key|live_mode_api_key/.test(txt)) {
          return { loggedIn: true, account: acct ?? 'Stripe Account', detail: 'Webhooks & API prontos' }
        }
      }
      return { loggedIn: false, detail: 'Desconectado (rode stripe login)' }
    }
  },
  {
    id: 'docker',
    name: 'Docker Engine',
    category: 'cloud',
    description: 'Containers locais, Docker Compose e imagens de produção.',
    bins: ['docker'],
    loginCmd: 'docker login',
    installCmd: isWin ? 'winget install Docker.DockerDesktop' : 'brew install --cask docker',
    docsUrl: 'https://docs.docker.com/engine/reference/commandline/cli/',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const cfgPath = join(home, '.docker', 'config.json')
      if (existsSync(cfgPath)) {
        try {
          const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
          const registries = Object.keys(cfg?.auths ?? {})
          if (registries.length > 0) {
            return { loggedIn: true, account: registries[0], detail: 'Docker Hub / Registry autenticado' }
          }
        } catch {}
      }
      return { loggedIn: true, account: 'Daemon Local', detail: 'Pronto para containers locais' }
    }
  },
  {
    id: 'kubectl',
    name: 'Kubernetes (kubectl)',
    category: 'cloud',
    description: 'Orquestração de clusters K8s, Pods, Deployments e Helm.',
    bins: ['kubectl'],
    loginCmd: 'kubectl config get-contexts',
    installCmd: isWin ? 'winget install Kubernetes.kubectl' : 'brew install kubectl',
    docsUrl: 'https://kubernetes.io/docs/reference/kubectl/',
    versionArgs: ['version', '--client'],
    detectAuth: async (bin) => {
      const kubeconfig = join(home, '.kube', 'config')
      if (existsSync(kubeconfig)) {
        const r = await runCmd(bin, ['config', 'current-context'], 2500)
        return { loggedIn: true, account: r.stdout || 'kubeconfig ativo', detail: '~/.kube/config configurado' }
      }
      return { loggedIn: false, detail: 'Sem contexto em ~/.kube/config' }
    }
  },
  {
    id: 'terraform',
    name: 'Terraform IaC',
    category: 'cloud',
    description: 'Infraestrutura como código multi-cloud e Terraform Cloud.',
    bins: ['terraform'],
    loginCmd: 'terraform login',
    installCmd: isWin ? 'winget install Hashicorp.Terraform' : 'brew install terraform',
    docsUrl: 'https://developer.hashicorp.com/terraform/cli',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const tfrc = join(home, '.terraform.d', 'credentials.tfrc.json')
      if (existsSync(tfrc)) return { loggedIn: true, account: 'Terraform Cloud', detail: 'Token HCP ativo' }
      return { loggedIn: true, account: 'IaC Local Pronto', detail: 'Pronto para terraform plan/apply' }
    }
  },
  {
    id: 'ngrok',
    name: 'ngrok Tunnels',
    category: 'cloud',
    description: 'Túneis HTTPS públicos instantâneos para webhooks e localhost.',
    bins: ['ngrok'],
    loginCmd: 'ngrok config check',
    installCmd: isWin ? 'winget install Ngrok.Ngrok' : 'brew install ngrok/ngrok/ngrok',
    docsUrl: 'https://ngrok.com/docs',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const p1 = join(process.env['LOCALAPPDATA'] ?? '', 'ngrok', 'ngrok.yml')
      const p2 = join(home, '.config', 'ngrok', 'ngrok.yml')
      if ((p1 && existsSync(p1)) || existsSync(p2)) {
        return { loggedIn: true, account: 'Authtoken Configurado', detail: 'Pronto para túneis HTTPS' }
      }
      return { loggedIn: false, detail: 'Configure com ngrok config add-authtoken' }
    }
  },
  {
    id: 'tailscale',
    name: 'Tailscale Mesh VPN',
    category: 'cloud',
    description: 'Rede privada WireGuard entre servidores, VPS e agentes locais.',
    bins: ['tailscale'],
    loginCmd: 'tailscale login',
    installCmd: isWin ? 'winget install tailscale.tailscale' : 'brew install --cask tailscale',
    docsUrl: 'https://tailscale.com/kb/1080/cli',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['status', '--json'], 2500)
      if (r.code === 0 && r.stdout) {
        try {
          const st = JSON.parse(r.stdout)
          if (st?.BackendState === 'Running') {
            return { loggedIn: true, account: st?.Self?.HostName || 'Tailnet Ativa', detail: st?.MagicDNSSuffix || 'Conectado à Tailnet' }
          }
        } catch {}
      }
      return { loggedIn: false, detail: 'Desconectado (rode tailscale up)' }
    }
  },
  {
    id: 'npm',
    name: 'npm Registry',
    category: 'code',
    description: 'Publicação de pacotes e bibliotecas TypeScript/JavaScript no npm.',
    bins: ['npm'],
    loginCmd: 'npm login',
    installCmd: 'winget install OpenJS.NodeJS.LTS',
    docsUrl: 'https://docs.npmjs.com/cli/',
    versionArgs: ['--version'],
    detectAuth: async () => {
      const npmrc = join(home, '.npmrc')
      if (existsSync(npmrc) && /_authToken/i.test(readFileSync(npmrc, 'utf8'))) {
        return { loggedIn: true, account: 'Token ~/.npmrc ativo', detail: 'Pronto para npm publish' }
      }
      return { loggedIn: false, detail: 'Sem _authToken em ~/.npmrc (rode npm login)' }
    }
  },
  {
    id: 'ollama',
    name: 'Ollama Local GPU',
    category: 'optimizer',
    description: 'Execução 100% local de LLMs (Llama, Qwen, DeepSeek, Gemma) na GPU.',
    bins: ['ollama'],
    loginCmd: 'ollama list',
    installCmd: isWin ? 'winget install Ollama.Ollama' : 'brew install ollama',
    docsUrl: 'https://ollama.com',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['list'], 2500)
      if (r.code === 0) {
        const models = Math.max(0, r.stdout.split('\n').filter(Boolean).length - 1)
        return { loggedIn: true, account: `${models} modelos locais`, detail: 'Servidor GPU Local ativo' }
      }
      return { loggedIn: false, detail: 'Servidor Ollama parado' }
    }
  },
  {
    id: 'hf',
    name: 'Hugging Face CLI',
    category: 'optimizer',
    description: 'Download de pesos, datasets, Spaces e modelos open-weight.',
    bins: ['huggingface-cli', 'hf'],
    loginCmd: 'huggingface-cli login',
    installCmd: 'pip install -U "huggingface_hub[cli]"',
    docsUrl: 'https://huggingface.co/docs/huggingface_hub/guides/cli',
    versionArgs: ['--help'],
    detectAuth: async () => {
      const tok = join(home, '.cache', 'huggingface', 'token')
      if (existsSync(tok) || process.env['HF_TOKEN']) {
        return { loggedIn: true, account: 'HF Token Ativo', detail: '~/.cache/huggingface/token' }
      }
      return { loggedIn: false, detail: 'Desconectado (rode huggingface-cli login)' }
    }
  },
  {
    id: 'rtk',
    name: 'RTK (Rust Token Killer)',
    category: 'optimizer',
    description: 'Proxy nativo de alta performance que reduz 60% a 90% dos tokens de shell.',
    bins: ['rtk'],
    loginCmd: 'rtk gain',
    installCmd: 'cargo install --git https://github.com/rtk-ai/rtk',
    docsUrl: 'https://github.com/rtk-ai/rtk',
    versionArgs: ['--version'],
    detectAuth: async (bin) => {
      const r = await runCmd(bin, ['gain'], 3000)
      const saved = r.stdout.match(/([0-9.,]+\s*[KMB]?\s*tokens|[0-9.]+%)/i)?.[1]
      return {
        loggedIn: true,
        account: saved ? `Ativo (${saved})` : 'Proxy Ativo no Elefante',
        detail: 'Integrado nativamente ao shell dos agentes'
      }
    }
  }
]

function cleanVersion(raw: string): string | undefined {
  const first = raw.split('\n')[0]?.trim()
  if (!first) return undefined
  const m = first.match(/v?\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?/)
  return m ? m[0] : undefined
}

export async function detectCloudClis(): Promise<CloudCliInfo[]> {
  return Promise.all(
    SPECS.map(async (spec): Promise<CloudCliInfo> => {
      let binPath: string | null = null
      let matchedBin = spec.bins[0]!
      for (const candidate of spec.bins) {
        const found = findOnPath(candidate)
        if (found) {
          binPath = found
          matchedBin = candidate
          break
        }
      }

      if (!binPath) {
        return {
          id: spec.id,
          name: spec.name,
          category: spec.category,
          description: spec.description,
          bin: matchedBin,
          installed: false,
          loggedIn: false,
          loginCmd: spec.loginCmd,
          installCmd: spec.installCmd,
          docsUrl: spec.docsUrl,
          detail: 'Não instalado nesta máquina'
        }
      }

      const [verRes, auth] = await Promise.all([
        runCmd(binPath, spec.versionArgs, 2500),
        spec.detectAuth(binPath).catch((): { loggedIn: boolean; account?: string; detail?: string } => ({
          loggedIn: false,
          detail: 'Não foi possível verificar sessão'
        }))
      ])

      return {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        bin: matchedBin,
        installed: true,
        version: cleanVersion(verRes.stdout || verRes.stderr),
        loggedIn: auth.loggedIn,
        account: auth.account,
        detail: auth.detail,
        loginCmd: spec.loginCmd,
        installCmd: spec.installCmd,
        docsUrl: spec.docsUrl
      }
    })
  )
}

export function inspectProjectCliContext(folderPath: string): ProjectCliContext {
  const badges: ProjectCliContext['badges'] = []
  if (!folderPath || !existsSync(folderPath)) {
    return { folderPath, badges }
  }

  // 1. Git repository & remote
  const gitConfig = join(folderPath, '.git', 'config')
  if (existsSync(gitConfig)) {
    try {
      const txt = readFileSync(gitConfig, 'utf8')
      const url = txt.match(/url\s*=\s*([^\r\n]+)/)?.[1]?.trim()
      const slug = url?.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '')
      badges.push({
        cliId: 'gh',
        label: 'GitHub',
        detail: slug || url || 'Repositório Git local'
      })
    } catch {}
  }

  // 2. Supabase (supabase/config.toml)
  const supaConfig = join(folderPath, 'supabase', 'config.toml')
  if (existsSync(supaConfig)) {
    try {
      const txt = readFileSync(supaConfig, 'utf8')
      const pid = txt.match(/project_id\s*=\s*["']([^"']+)["']/)?.[1]
      badges.push({
        cliId: 'supabase',
        label: 'Supabase',
        detail: pid ? `project_id: ${pid}` : 'supabase/config.toml'
      })
    } catch {}
  }

  // 3. Cloudflare Workers / Pages (wrangler.toml / wrangler.json / wrangler.jsonc)
  for (const wf of ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc']) {
    const wp = join(folderPath, wf)
    if (existsSync(wp)) {
      try {
        const txt = readFileSync(wp, 'utf8')
        const name = txt.match(/name\s*=\s*["']([^"']+)["']/)?.[1] || txt.match(/"name"\s*:\s*"([^"]+)"/)?.[1]
        badges.push({
          cliId: 'cloudflare',
          label: 'Cloudflare',
          detail: name ? `Worker: ${name}` : wf
        })
      } catch {}
      break
    }
  }

  // 4. Firebase (.firebaserc / firebase.json)
  const fbRc = join(folderPath, '.firebaserc')
  if (existsSync(fbRc) || existsSync(join(folderPath, 'firebase.json'))) {
    let proj = 'firebase.json'
    if (existsSync(fbRc)) {
      try {
        const parsed = JSON.parse(readFileSync(fbRc, 'utf8'))
        proj = parsed?.projects?.default || Object.values(parsed?.projects ?? {})[0] || proj
      } catch {}
    }
    badges.push({
      cliId: 'firebase',
      label: 'Firebase',
      detail: String(proj)
    })
  }

  // 5. Vercel (.vercel/project.json / vercel.json)
  const vercelProj = join(folderPath, '.vercel', 'project.json')
  if (existsSync(vercelProj) || existsSync(join(folderPath, 'vercel.json'))) {
    let detail = 'vercel.json'
    if (existsSync(vercelProj)) {
      try {
        const parsed = JSON.parse(readFileSync(vercelProj, 'utf8'))
        detail = parsed?.projectName || parsed?.projectId || detail
      } catch {}
    }
    badges.push({
      cliId: 'vercel',
      label: 'Vercel',
      detail: String(detail)
    })
  }

  // 6. Netlify (netlify.toml)
  if (existsSync(join(folderPath, 'netlify.toml'))) {
    badges.push({
      cliId: 'netlify',
      label: 'Netlify',
      detail: 'netlify.toml'
    })
  }

  // 7. Railway (railway.json / railway.toml)
  if (existsSync(join(folderPath, 'railway.json')) || existsSync(join(folderPath, 'railway.toml'))) {
    badges.push({
      cliId: 'railway',
      label: 'Railway',
      detail: 'Configuração Railway detectada'
    })
  }

  // 8. Fly.io (fly.toml)
  const flyToml = join(folderPath, 'fly.toml')
  if (existsSync(flyToml)) {
    try {
      const txt = readFileSync(flyToml, 'utf8')
      const app = txt.match(/app\s*=\s*['"]([^'"]+)['"]/)?.[1]
      badges.push({
        cliId: 'fly',
        label: 'Fly.io',
        detail: app ? `app: ${app}` : 'fly.toml'
      })
    } catch {}
  }

  // 9. Docker (Dockerfile / docker-compose.yml)
  if (
    existsSync(join(folderPath, 'Dockerfile')) ||
    existsSync(join(folderPath, 'docker-compose.yml')) ||
    existsSync(join(folderPath, 'docker-compose.yaml'))
  ) {
    badges.push({
      cliId: 'docker',
      label: 'Docker',
      detail: 'Container configurado na pasta'
    })
  }

  return { folderPath, badges }
}
