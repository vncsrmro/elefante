// Native Hermes-style Direct API Engine for Elefante.
// Connects directly to OpenRouter, DeepSeek, Ollama (Local GPU), Groq, OpenAI, Anthropic,
// or any OpenAI-compatible endpoint (/v1/chat/completions) with full SSE streaming,
// multimodal images, and full MCP Gateway tool-calling (Browser, Computer, SSH, Memory, MCPs).
import { readFileSync } from 'node:fs'
import { request } from 'node:http'
import { L } from '../../shared/lang'
import type { ApiProviderConfig, ApiProviderId, EngineStatus } from '../../shared/types'
import type { Engine, EngineEvent, Turn, Usage } from './types'

export interface ProviderPreset {
  id: ApiProviderId
  name: string
  badge: string
  description: string
  defaultBaseUrl: string
  needsKey: boolean
  keyPlaceholder: string
  docsUrl: string
  defaultModels: { id: string; label: string; hint: string }[]
}

export const API_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: '300+ Modelos · Recomendado',
    description: 'Acesse DeepSeek R1/V3, Claude 3.7 Sonnet, Gemini 2.5 Pro, GPT-4.1, Qwen e Llama 3.3 com uma única chave.',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    keyPlaceholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
    defaultModels: [
      { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3 (OpenRouter)', hint: 'Rápido, barato e excelente em código' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (OpenRouter)', hint: 'Raciocínio profundo e arquitetura' },
      { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet (OpenRouter)', hint: 'UI/UX, código full-stack e agentes' },
      { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro (OpenRouter)', hint: 'Contexto gigante de 1M tokens' },
      { id: 'openai/gpt-4.1', label: 'GPT-4.1 (OpenRouter)', hint: 'Alta precisão em instruções e tools' },
      { id: 'qwen/qwen-2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', hint: 'Especialista em código custo-benefício' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API Oficial',
    badge: 'Ultra Barato',
    description: 'Conecte direto na API oficial da DeepSeek (V3 e R1 Reasoner) com cache automático de contexto.',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    needsKey: true,
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    defaultModels: [
      { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat)', hint: 'Uso geral, código e ferramentas MCP' },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1 (deepseek-reasoner)', hint: 'Raciocínio avançado passo a passo' }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama (IA Local / GPU)',
    badge: '100% Grátis & Offline',
    description: 'Rode modelos abertos (Qwen 2.5 Coder, DeepSeek R1, Llama 3.3) direto na sua GPU sem custo por token.',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    needsKey: false,
    keyPlaceholder: 'Opcional (não precisa de chave)',
    docsUrl: 'https://ollama.com',
    defaultModels: [
      { id: 'qwen2.5-coder:14b', label: 'Qwen 2.5 Coder 14B (Local)', hint: 'Ideal para GPUs de 12GB VRAM' },
      { id: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B (Local)', hint: 'Leve e ultra rápido localmente' },
      { id: 'deepseek-r1:14b', label: 'DeepSeek R1 14B (Local)', hint: 'Raciocínio local privado' },
      { id: 'llama3.2:latest', label: 'Llama 3.2 (Local)', hint: 'Rápido para rotinas e resumos' }
    ]
  },
  {
    id: 'groq',
    name: 'Groq Cloud (LPU)',
    badge: 'Velocidade Extrema',
    description: 'Inferência instantânea (>500 tokens/s) para Llama 3.3 70B, DeepSeek R1 Distill e Qwen QwQ.',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    defaultModels: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (Groq)', hint: 'Velocidade extrema com ótimo tool use' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B (Groq)', hint: 'Raciocínio rápido em LPU' },
      { id: 'qwen-qwq-32b', label: 'Qwen QwQ 32B (Groq)', hint: 'Agentes e lógica complexa' }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI API Direta',
    badge: 'Oficial',
    description: 'Use sua chave de API direta da OpenAI platform (GPT-4.1, GPT-4o, o3-mini).',
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    keyPlaceholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModels: [
      { id: 'gpt-4.1', label: 'GPT-4.1 (OpenAI API)', hint: 'Modelo principal para engenharia e tools' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (OpenAI API)', hint: 'Rápido e econômico' },
      { id: 'o3-mini', label: 'o3-mini (OpenAI API)', hint: 'Raciocínio técnico e STEM' }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic API Direta',
    badge: 'Oficial',
    description: 'Use sua chave de API direta do Console Anthropic (Claude Sonnet 4 / 3.7 / Haiku 3.5).',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    needsKey: true,
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    defaultModels: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (API)', hint: 'Equilíbrio máximo de inteligência' },
      { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (API)', hint: 'Excelente em front-end e arquitetura' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (API)', hint: 'Rápido e econômico' }
    ]
  },
  {
    id: 'custom',
    name: 'Gateway Customizado (LM Studio / vLLM / LiteLLM / xAI)',
    badge: 'OpenAI-Compatible',
    description: 'Qualquer servidor compatível com a rota /v1/chat/completions (LM Studio, vLLM, Together, Mistral, xAI Grok).',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    needsKey: false,
    keyPlaceholder: 'Chave de API (se exigida pelo servidor)',
    docsUrl: 'https://lmstudio.ai',
    defaultModels: []
  }
]

export function defaultApiProviders(): Record<ApiProviderId, ApiProviderConfig> {
  const out = {} as Record<ApiProviderId, ApiProviderConfig>
  for (const p of API_PROVIDER_PRESETS) {
    out[p.id] = {
      id: p.id,
      enabled: false,
      baseUrl: p.defaultBaseUrl,
      models: p.defaultModels.map((m) => m.id),
      hasKey: false
    }
  }
  return out
}

// Lists all configured models across enabled API providers as "<providerId>/<modelId>".
export function listConfiguredApiModels(
  configs: Partial<Record<ApiProviderId, ApiProviderConfig>> | undefined,
  hasSecret: (id: ApiProviderId) => boolean
): { status: EngineStatus; models: string[]; labels: Record<string, { label: string; hint?: string }> } {
  const base = { ...defaultApiProviders(), ...(configs ?? {}) }
  const models: string[] = []
  const labels: Record<string, { label: string; hint?: string }> = {}
  const activeProviders: string[] = []

  for (const preset of API_PROVIDER_PRESETS) {
    const cfg = base[preset.id]
    if (!cfg) continue
    const keyReady = !preset.needsKey || hasSecret(preset.id)
    if (!cfg.enabled || !keyReady) continue
    activeProviders.push(preset.name)
    const modelList = cfg.models?.length ? cfg.models : preset.defaultModels.map((m) => m.id)
    for (const m of modelList) {
      const fullId = `${preset.id}/${m}`
      models.push(fullId)
      const known = preset.defaultModels.find((d) => d.id === m)
      labels[fullId] = {
        label: known ? known.label : `${m} (${preset.name})`,
        hint: known?.hint ?? preset.name
      }
    }
  }

  return {
    status: {
      installed: true,
      loggedIn: models.length > 0,
      version: 'Hermes 1.0',
      route: models.length > 0 ? 'providers' : undefined,
      account:
        models.length > 0
          ? `${activeProviders.slice(0, 3).join(', ')}${activeProviders.length > 3 ? ` +${activeProviders.length - 3}` : ''} · ${models.length} ${L('modelos', 'models')}`
          : L('Configure em Configurações → Provedores & APIs', 'Configure in Settings → Providers & APIs')
    },
    models,
    labels
  }
}

// Queries a provider's /models endpoint (or Ollama's /api/tags) to auto-discover models.
export async function discoverProviderModels(id: ApiProviderId, baseUrl: string, apiKey?: string): Promise<{ models: string[]; error?: string }> {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '')
  try {
    if (id === 'ollama') {
      const rootUrl = cleanUrl.replace(/\/v1$/i, '')
      const res = await fetch(`${rootUrl}/api/tags`, { signal: AbortSignal.timeout(8_000) })
      if (res.ok) {
        const data = (await res.json()) as { models?: { name?: string }[] }
        const list = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean)
        if (list.length > 0) return { models: list }
      }
    }
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    if (id === 'anthropic' && apiKey) {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    }
    const res = await fetch(`${cleanUrl}/models`, { headers, signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return { models: [], error: `HTTP ${res.status}` }
    const json = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] }
    const raw = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : []
    const models = raw
      .map((m) => (typeof m.id === 'string' ? m.id : typeof (m as { name?: string }).name === 'string' ? (m as { name: string }).name : ''))
      .filter(Boolean)
      .slice(0, 120)
    return { models }
  } catch (err) {
    return { models: [], error: err instanceof Error ? err.message : String(err) }
  }
}

// Calls Elefante's internal MCP Gateway for the current turn.
interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

let rpcSeq = 0
function mcpRpc<T>(mcpUrl: string, method: string, params: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: ++rpcSeq, method, params })
    const req = request(
      mcpUrl,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (text += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(text) as { result?: T; error?: { message?: string } }
            if (parsed.error) reject(new Error(parsed.error.message ?? 'MCP error'))
            else resolve(parsed.result as T)
          } catch {
            reject(new Error(`Invalid MCP response: ${text.slice(0, 200)}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.end(body)
  })
}

export function apiEngine(
  getConfig: () => Partial<Record<ApiProviderId, ApiProviderConfig>> | undefined,
  getSecret: (id: ApiProviderId) => Promise<string | undefined>
): Engine {
  return {
    id: 'api',
    async *run(turn: Turn): AsyncIterable<EngineEvent> {
      const cleanModel = turn.model.startsWith('api:') ? turn.model.slice(4) : turn.model
      const slash = cleanModel.indexOf('/')
      const providerId = (slash > 0 ? cleanModel.slice(0, slash) : 'openrouter') as ApiProviderId
      const modelName = slash > 0 ? cleanModel.slice(slash + 1) : cleanModel

      const presets = defaultApiProviders()
      const userCfg = getConfig()?.[providerId]
      const cfg = { ...presets[providerId], ...userCfg }
      const preset = API_PROVIDER_PRESETS.find((p) => p.id === providerId) ?? API_PROVIDER_PRESETS[0]!
      const apiKey = await getSecret(providerId)

      if (preset.needsKey && !apiKey) {
        yield {
          type: 'error',
          message: L(
            `Falta a chave de API do ${preset.name}. Configure em Configurações → Provedores & APIs.`,
            `Missing API key for ${preset.name}. Configure it in Settings → Providers & APIs.`
          )
        }
        return
      }

      const baseUrl = (cfg.baseUrl || preset.defaultBaseUrl).trim().replace(/\/+$/, '')

      // Load turn tools from Elefante's MCP Gateway
      let mcpTools: McpTool[] = []
      if (turn.mcpUrl) {
        try {
          const listed = await mcpRpc<{ tools?: McpTool[] }>(turn.mcpUrl, 'tools/list', {})
          mcpTools = listed.tools ?? []
        } catch {
          mcpTools = []
        }
      }

      const openAiTools =
        mcpTools.length > 0
          ? mcpTools.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description ?? '',
                parameters: t.inputSchema ?? { type: 'object', properties: {} }
              }
            }))
          : undefined

      // Build initial messages
      type ChatMessage =
        | { role: 'system'; content: string }
        | { role: 'user'; content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }
        | { role: 'assistant'; content?: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
        | { role: 'tool'; tool_call_id: string; content: string }

      const messages: ChatMessage[] = []
      if (turn.system?.trim()) {
        messages.push({ role: 'system', content: turn.system })
      }

      const images = turn.images ?? []
      if (images.length > 0) {
        const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [{ type: 'text', text: turn.prompt }]
        for (const img of images) {
          try {
            const b64 = readFileSync(img.path).toString('base64')
            parts.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${b64}` } })
          } catch {
            // ignore unreadable image
          }
        }
        messages.push({ role: 'user', content: parts })
      } else {
        messages.push({ role: 'user', content: turn.prompt })
      }

      let totalInput = 0
      let totalCache = 0
      let totalOutput = 0
      let fullText = ''

      const maxSteps = 15
      for (let step = 0; step < maxSteps; step++) {
        if (turn.signal.aborted) return

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json'
        }
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
        if (providerId === 'openrouter') {
          headers['HTTP-Referer'] = 'https://github.com/viniciusromeiro/elefante'
          headers['X-Title'] = 'Elefante AI Orchestrator'
        }
        if (providerId === 'anthropic' && apiKey) {
          headers['x-api-key'] = apiKey
          headers['anthropic-version'] = '2023-06-01'
        }

        const payload: Record<string, unknown> = {
          model: modelName,
          messages,
          stream: true,
          stream_options: { include_usage: true }
        }
        if (openAiTools?.length) {
          payload['tools'] = openAiTools
        }

        let res: Response
        try {
          res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: turn.signal
          })
        } catch (err) {
          if (turn.signal.aborted) return
          yield { type: 'error', message: `${preset.name}: ${err instanceof Error ? err.message : String(err)}` }
          return
        }

        if (!res.ok) {
          const errBody = await res.text().catch(() => '')
          // If stream_options was rejected by a strict provider (e.g. older Ollama/Groq), retry once without stream_options
          if (res.status === 400 && payload['stream_options']) {
            delete payload['stream_options']
            res = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
              signal: turn.signal
            })
          }
          if (!res.ok) {
            const detail = errBody || (await res.text().catch(() => `HTTP ${res.status}`))
            yield { type: 'error', message: `${preset.name} (${res.status}): ${detail.slice(0, 400)}` }
            return
          }
        }

        const contentType = res.headers.get('content-type') ?? ''
        let stepText = ''
        const toolCalls = new Map<number, { id: string; name: string; args: string }>()

        if (contentType.includes('text/event-stream') && res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const rawLine of lines) {
              const line = rawLine.trim()
              if (!line.startsWith('data:')) continue
              const dataStr = line.slice(5).trim()
              if (!dataStr || dataStr === '[DONE]') continue
              try {
                const chunk = JSON.parse(dataStr) as {
                  choices?: Array<{
                    delta?: {
                      content?: string | null
                      reasoning_content?: string | null
                      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
                    }
                  }>
                  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
                }
                const delta = chunk.choices?.[0]?.delta
                if (delta?.content) {
                  stepText += delta.content
                  fullText += delta.content
                  yield { type: 'text', delta: delta.content }
                }
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0
                    const cur = toolCalls.get(idx) ?? { id: tc.id ?? `call_${idx}_${Date.now()}`, name: '', args: '' }
                    if (tc.id) cur.id = tc.id
                    if (tc.function?.name) cur.name += tc.function.name
                    if (tc.function?.arguments) cur.args += tc.function.arguments
                    toolCalls.set(idx, cur)
                  }
                }
                if (chunk.usage) {
                  totalInput += chunk.usage.prompt_tokens ?? 0
                  totalOutput += chunk.usage.completion_tokens ?? 0
                  totalCache += chunk.usage.prompt_tokens_details?.cached_tokens ?? 0
                  yield { type: 'progress', tokens: totalInput + totalOutput, cacheRead: totalCache }
                }
              } catch {
                // ignore malformed SSE line
              }
            }
          }
        } else {
          // Non-streaming JSON fallback
          const json = (await res.json()) as {
            choices?: Array<{
              message?: {
                content?: string | null
                tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
              }
            }>
            usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
          }
          const msg = json.choices?.[0]?.message
          if (msg?.content) {
            stepText += msg.content
            fullText += msg.content
            yield { type: 'text', delta: msg.content }
          }
          if (msg?.tool_calls) {
            msg.tool_calls.forEach((tc, idx) => {
              toolCalls.set(idx, {
                id: tc.id ?? `call_${idx}_${Date.now()}`,
                name: tc.function?.name ?? '',
                args: tc.function?.arguments ?? '{}'
              })
            })
          }
          if (json.usage) {
            totalInput += json.usage.prompt_tokens ?? 0
            totalOutput += json.usage.completion_tokens ?? 0
            totalCache += json.usage.prompt_tokens_details?.cached_tokens ?? 0
          }
        }

        // Estimate tokens if provider didn't send usage in stream
        if (totalInput === 0 && totalOutput === 0) {
          totalInput = Math.max(100, Math.round((turn.system.length + turn.prompt.length) / 4))
          totalOutput = Math.max(20, Math.round(fullText.length / 4))
        }

        if (toolCalls.size === 0 || !turn.mcpUrl) {
          break
        }

        // Execute tool calls against Elefante's MCP Gateway
        const calls = [...toolCalls.values()].filter((c) => c.name)
        messages.push({
          role: 'assistant',
          content: stepText || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.args || '{}' }
          }))
        })

        for (const call of calls) {
          if (turn.signal.aborted) return
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = call.args ? (JSON.parse(call.args) as Record<string, unknown>) : {}
          } catch {
            parsedArgs = {}
          }
          try {
            const r = await mcpRpc<{ content?: Array<{ type: string; text?: string }>; isError?: boolean }>(turn.mcpUrl, 'tools/call', {
              name: call.name,
              arguments: parsedArgs
            })
            const textOut = (r.content ?? []).map((c) => (c.type === 'text' ? (c.text ?? '') : `[${c.type}]`)).join('\n')
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: textOut || (r.isError ? 'Tool error' : 'OK')
            })
          } catch (err) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: `Error: ${err instanceof Error ? err.message : String(err)}`
            })
          }
        }
      }

      const usage: Usage = {
        inputTokens: totalInput,
        cacheReadTokens: totalCache,
        outputTokens: totalOutput
      }
      yield { type: 'done', text: fullText, usage }
    }
  }
}
