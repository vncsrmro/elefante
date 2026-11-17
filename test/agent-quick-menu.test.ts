import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { hasChrome } from '../src/core/chrome'
import { Db } from '../src/core/db'
import { randomUUID } from 'node:crypto'
import type { Agent } from '../src/shared/types'
import { modelInfo } from '../src/shared/types'

const root = fileURLToPath(new URL('../', import.meta.url))

describe('Agent Quick Menu & Model Switching', () => {
  it('updates agent modelId directly and persists in database', () => {
    const db = new Db(':memory:')
    const agent: Agent = {
      id: randomUUID(),
      name: 'Lia',
      handle: 'lia',
      role: 'Arquiteta de Software',
      color: 'teal',
      instructions: 'Escreve código e arquitetura',
      modelId: 'sonnet',
      effort: 'medium',
      limit: 100_000,
      used: 0,
      grants: {},
      memory: 'auto',
      computer: false,
      archived: false
    }

    db.saveAgent(agent)
    expect(db.agent(agent.id)?.modelId).toBe('sonnet')

    // Switch model to gpt-5.6-luna
    db.saveAgent({ ...agent, modelId: 'gpt-5.6-luna' })
    expect(db.agent(agent.id)?.modelId).toBe('gpt-5.6-luna')

    // Switch effort to high
    db.saveAgent({ ...agent, modelId: 'gpt-5.6-luna', effort: 'high' })
    const updated = db.agent(agent.id)
    expect(updated?.effort).toBe('high')
    expect(updated?.modelId).toBe('gpt-5.6-luna')
  })

  it('correctly resolves model labels for built-in, prefixed and custom API models', () => {
    expect(modelInfo('sonnet')?.label).toBe('Sonnet')
    expect(modelInfo('opus')?.label).toBe('Opus')
    expect(modelInfo('haiku')?.label).toBe('Haiku')
    expect(modelInfo('gpt-5.6-luna')?.label).toBe('GPT-5.6 Luna')

    // Prefixed built-in model resolves to friendly label
    const prefixedBuiltIn = modelInfo('antigravity:gemini-3.8-flash-low')
    expect(prefixedBuiltIn?.engine).toBe('antigravity')
    expect(prefixedBuiltIn?.label).toBe('Gemini 3.8 Flash (Low)')

    // Custom API model format
    const custom = modelInfo('api:openrouter/anthropic/claude-3.7-sonnet')
    expect(custom?.engine).toBe('api')
    expect(custom?.label).toBe('openrouter/anthropic/claude-3.7-sonnet')
  })

  it.skipIf(!hasChrome())(
    'never overflows horizontally even with long model names and expanded picker',
    async () => {
      const browser = await chromium.launch({ channel: 'chrome', headless: true, timeout: 15_000 })
      try {
        const page = await browser.newPage({ viewport: { width: 900, height: 800 } })
        const css = readFileSync(join(root, 'src/renderer/src/styles.css'), 'utf8')
        await page.setContent(`
          <!DOCTYPE html>
          <html data-theme="dark">
          <head><style>${css}</style></head>
          <body style="background:#101115;margin:0;padding:40px;font-family:Inter,system-ui,sans-serif">
            <div class="agent-quick-card c-rose" style="position:fixed;top:30px;left:40px">
              <div class="agent-quick-card__banner">
                <button class="agent-quick-card__close-btn">✕</button>
              </div>
              <div class="agent-quick-card__profile">
                <div class="agent-quick-card__top-row">
                  <div class="agent-quick-card__avatar-wrap">
                    <span class="avatar avatar--agent c-rose" style="width:50px;height:50px;font-size:21px">
                      <span class="avatar__eyes"><i></i><i></i></span>
                    </span>
                    <span class="agent-quick-card__status-dot"></span>
                  </div>
                  <div class="agent-quick-card__identity">
                    <div class="agent-quick-card__name-row">
                      <h2 class="agent-quick-card__name">Maya</h2>
                    </div>
                    <div class="agent-quick-card__handle-row">
                      <button class="agent-quick-card__handle-btn"><span>@maya</span></button>
                    </div>
                  </div>
                </div>
                <div class="agent-quick-card__badges">
                  <span class="agent-quick-card__role-badge">Social Media PaperX</span>
                  <span class="agent-quick-card__dept-badge">Vendas · Mateus</span>
                </div>
              </div>
              <div class="agent-quick-card__content">
                <div class="agent-quick-card__section">
                  <div class="agent-quick-card__section-head">
                    <div class="agent-quick-card__section-title"><span>Troca Rápida de Modelo</span></div>
                    <button class="agent-quick-card__link-btn">Mais modelos…</button>
                  </div>
                  <div class="agent-quick-card__active-model">
                    <div class="agent-quick-card__active-model-info">
                      <span class="provider-mark provider-mark--gemini" style="width:22px;height:22px">✦</span>
                      <div class="agent-quick-card__active-model-text">
                        <span class="agent-quick-card__active-model-label">Gemini 3.8 Flash (Low)</span>
                        <span class="agent-quick-card__active-model-sub">Instantâneo (2s), ideal pro Fante · <strong class="agent-quick-card__ready-text">Pronto</strong></span>
                      </div>
                    </div>
                    <span class="agent-quick-card__active-pill">Ativo</span>
                  </div>
                  <div class="agent-quick-card__quick-grid">
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">✻</span><span class="agent-quick-card__model-btn-label">Claude Sonnet</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">✻</span><span class="agent-quick-card__model-btn-label">Claude Opus</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">✻</span><span class="agent-quick-card__model-btn-label">Claude Haiku</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">◎</span><span class="agent-quick-card__model-btn-label">GPT-5.6 Luna</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">◎</span><span class="agent-quick-card__model-btn-label">GPT-5.6 Terra</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">✦</span><span class="agent-quick-card__model-btn-label">Gemini 4 Argon</span></button>
                    <button class="agent-quick-card__model-btn is-selected"><span class="provider-mark" style="width:14px;height:14px">✦</span><span class="agent-quick-card__model-btn-label">Gemini Flash</span><span class="icon">✓</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">🐋</span><span class="agent-quick-card__model-btn-label">DeepSeek V3</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">🐋</span><span class="agent-quick-card__model-btn-label">DeepSeek R1</span></button>
                    <button class="agent-quick-card__model-btn"><span class="provider-mark" style="width:14px;height:14px">⚙</span><span class="agent-quick-card__model-btn-label">openrouter/anthropic/claude-3.7-sonnet-very-long-name</span></button>
                  </div>
                </div>
                <div class="agent-quick-card__section">
                  <div class="agent-quick-card__section-head">
                    <div class="agent-quick-card__section-title"><span>Esforço de Raciocínio</span></div>
                  </div>
                  <div class="agent-quick-card__effort-group">
                    <button class="agent-quick-card__effort-btn is-active">Baixo</button>
                    <button class="agent-quick-card__effort-btn">Médio</button>
                    <button class="agent-quick-card__effort-btn">Alto</button>
                    <button class="agent-quick-card__effort-btn">Máximo</button>
                  </div>
                </div>
                <div class="agent-quick-card__section">
                  <div class="agent-quick-card__section-head">
                    <div class="agent-quick-card__section-title"><span>Capacidades & Consumo</span></div>
                  </div>
                  <div class="agent-quick-card__caps-row">
                    <button class="agent-quick-card__cap-pill is-active"><span>Web: ON</span></button>
                    <button class="agent-quick-card__cap-pill is-active"><span>Mem: Auto</span></button>
                    <span class="agent-quick-card__cap-pill is-muted"><span>Sem PC</span></span>
                  </div>
                  <div class="agent-quick-card__quota">
                    <div class="agent-quick-card__quota-labels">
                      <span>Consumo mensal</span>
                      <strong>14.2k / 100k (14%)</strong>
                    </div>
                    <div class="agent-quick-card__quota-bar">
                      <div class="agent-quick-card__quota-fill" style="width:14%"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="agent-quick-card__footer">
                <button class="agent-quick-card__action-btn agent-quick-card__action-btn--primary"><span>⚙ Configurações do Agente</span></button>
                <div class="agent-quick-card__footer-sub">
                  <button class="agent-quick-card__action-btn"><span>💬 Conversar em DM</span></button>
                  <button class="agent-quick-card__action-btn"><span>🔌 Provedores & APIs</span></button>
                </div>
              </div>
            </div>
          </body>
          </html>
        `)

        const metrics = await page.locator('.agent-quick-card').evaluate((card) => {
          const content = card.querySelector<HTMLElement>('.agent-quick-card__content')!
          const sections = Array.from(card.querySelectorAll<HTMLElement>('.agent-quick-card__section'))
          const buttons = Array.from(card.querySelectorAll<HTMLElement>('.agent-quick-card__model-btn'))
          const cardRect = card.getBoundingClientRect()
          const contentRect = content.getBoundingClientRect()
          return {
            cardHorizontalOverflow: card.scrollWidth > card.clientWidth,
            contentHorizontalOverflow: content.scrollWidth > content.clientWidth,
            sectionsInsideCard: sections.every((s) => {
              const r = s.getBoundingClientRect()
              return r.left >= contentRect.left - 1 && r.right <= contentRect.right + 1
            }),
            buttonsInsideSection: buttons.every((b) => {
              const r = b.getBoundingClientRect()
              const parent = b.closest('.agent-quick-card__section')!.getBoundingClientRect()
              return r.left >= parent.left && r.right <= parent.right + 1
            }),
            cardFitsViewport: cardRect.bottom <= window.innerHeight
          }
        })

        expect(metrics).toEqual({
          cardHorizontalOverflow: false,
          contentHorizontalOverflow: false,
          sectionsInsideCard: true,
          buttonsInsideSection: true,
          cardFitsViewport: true
        })
      } finally {
        await browser.close()
      }
    },
    // Cold browser startup on macOS/Linux runners can exceed the unit-test budget.
    30_000
  )
})
