import type { ReactNode } from 'react'

export function ProviderMark({ model, size = 20 }: { model: string; size?: number }): ReactNode {
  const id = model.toLowerCase()
  const provider = /claude|anthropic/.test(id) ? 'claude' : /gemini|google/.test(id) ? 'gemini' : /codex|openai|gpt|o[134]-/.test(id) ? 'openai' : /deepseek/.test(id) ? 'deepseek' : 'other'
  return <span className={`provider-mark provider-mark--${provider}`} title={provider === 'other' ? model : provider} style={{ width: size, height: size }}>
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {provider === 'claude' ? <g stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M12 3v6" transform={`rotate(${i * 30} 12 12)`} />)}</g>
        : provider === 'gemini' ? <path fill="currentColor" d="M12 1C11 8 8 11 1 12c7 1 10 4 11 11 1-7 4-10 11-11C16 11 13 8 12 1Z" />
        : provider === 'openai' ? <g stroke="currentColor" strokeWidth="1.5">{Array.from({ length: 6 }, (_, i) => <path key={i} d="M12 6c-4-4-9 1-6 5l6 4 5-3V6l-5-3" transform={`rotate(${i * 60} 12 12)`} />)}</g>
        : provider === 'deepseek' ? <path fill="currentColor" d="M3 8c6-5 14-2 15 4l4-3-1 6-4 1C11 23 3 18 2 12l6 2-5-6Z" />
        : <g stroke="currentColor" strokeWidth="1.6"><rect x="5" y="5" width="14" height="14" rx="4" /><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3" /></g>}
    </svg>
  </span>
}
