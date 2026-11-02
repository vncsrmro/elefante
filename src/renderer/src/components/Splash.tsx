// Intro screen for Elefante.
// Features the 3D faceted Elephant emblem, aurora mesh,
// orbiting glassmorphic squad capsules, and smooth Apple typography reveal.
import { L } from '../../../shared/lang'
import { gsap } from 'gsap'
import { useEffect, useRef, type ReactNode } from 'react'
import elefanteIcon from '../assets/elefante-icon.png'

// Synthesizes a clean Apple Spatial Chime + warm Elephant Horn resonance via Web Audio API (no wing-flapping mp3).
function playElephantGlassChime(): () => void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime

    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.28, now + 0.18)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3.8)
    master.connect(ctx.destination)

    // 1. Warm sub-bass & crystalline pad chord (C3 - G3 - D4 - E4 - G4)
    const chord = [130.81, 196.0, 293.66, 329.63, 392.0, 587.33]
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = i < 2 ? 'sine' : 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.04)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(900 + i * 250, now)
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.9)
      filter.frequency.exponentialRampToValueAtTime(400, now + 3.6)

      const amp = i === 0 ? 0.32 : 0.16 / (1 + i * 0.25)
      gain.gain.setValueAtTime(0.0001, now + i * 0.04)
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.25 + i * 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      osc.start(now + i * 0.04)
      osc.stop(now + 3.7)
    })

    // 2. Gentle warm brassy elephant call motif (G3 -> D4 -> E4 warm horn)
    const horn = ctx.createOscillator()
    const hornFilter = ctx.createBiquadFilter()
    const hornGain = ctx.createGain()
    horn.type = 'sawtooth'
    horn.frequency.setValueAtTime(196.0, now + 0.35)
    horn.frequency.exponentialRampToValueAtTime(293.66, now + 0.75)
    horn.frequency.exponentialRampToValueAtTime(329.63, now + 1.25)
    horn.frequency.exponentialRampToValueAtTime(293.66, now + 1.9)

    hornFilter.type = 'lowpass'
    hornFilter.Q.value = 3.2
    hornFilter.frequency.setValueAtTime(320, now + 0.35)
    hornFilter.frequency.exponentialRampToValueAtTime(1150, now + 0.9)
    hornFilter.frequency.exponentialRampToValueAtTime(420, now + 2.1)

    hornGain.gain.setValueAtTime(0.0001, now + 0.35)
    hornGain.gain.exponentialRampToValueAtTime(0.11, now + 0.7)
    hornGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)

    horn.connect(hornFilter)
    hornFilter.connect(hornGain)
    hornGain.connect(master)
    horn.start(now + 0.35)
    horn.stop(now + 2.3)

    return () => {
      ctx.close().catch(() => {})
    }
  } catch {
    return () => {}
  }
}

const PILLARS = [
  { title: L('Agentes Autônomos', 'Autonomous Agents'), sub: L('Multi-CLI & Modelos', 'Multi-CLI & Models'), color: '#38bdf8', angle: -145, dist: 245 },
  { title: L('Memória Contínua', 'Continuous Memory'), sub: L('Contexto Inteligente', 'Smart Context'), color: '#f472b6', angle: -90, dist: 220 },
  { title: L('Conectores MCP', 'MCP Connectors'), sub: L('APIs & Bancos', 'APIs & Databases'), color: '#a855f7', angle: -35, dist: 245 },
  { title: L('Computador & SSH', 'Computer & SSH'), sub: L('Execução Local', 'Local Execution'), color: '#34d399', angle: 35, dist: 245 },
  { title: L('Rotinas & Gatilhos', 'Routines & Triggers'), sub: L('Automação 24/7', '24/7 Automation'), color: '#fbbf24', angle: 90, dist: 220 },
  { title: L('Skills & Canais', 'Skills & Channels'), sub: L('Trabalho em Equipe', 'Team Workflows'), color: '#60a5fa', angle: 145, dist: 245 }
]

export function Splash({ onDone }: { onDone: () => void }): ReactNode {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const finish = (): void => {
      if (done.current) return
      done.current = true
      onDone()
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setTimeout(finish, 400)
      return () => clearTimeout(id)
    }

    const stopSound = playElephantGlassChime()

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: finish
      })

      // Initial states
      gsap.set('.ag-orb', { scale: 0.4, opacity: 0 })
      gsap.set('.ag-ring', { scale: 0.5, opacity: 0 })
      gsap.set('.ag-hero-icon', { scale: 0.65, opacity: 0, rotateX: 18, y: 24 })
      gsap.set('.ag-pill', { scale: 0.7, opacity: 0, x: 0, y: 0 })
      gsap.set('.ag-title', { opacity: 0, y: 18, filter: 'blur(10px)' })
      gsap.set('.ag-sub', { opacity: 0, y: 12, filter: 'blur(6px)' })
      gsap.set('.ag-author', { opacity: 0, y: 10 })
      gsap.set('.ag-progress-fill', { scaleX: 0, transformOrigin: 'left center' })

      // 1. Spatial Aurora Orbs awaken
      tl.to('.ag-orb-1', { scale: 1.15, opacity: 0.65, duration: 2.2, ease: 'sine.out' }, 0)
        .to('.ag-orb-2', { scale: 1.2, opacity: 0.55, duration: 2.4, ease: 'sine.out' }, 0.15)
        .to('.ag-orb-3', { scale: 1.1, opacity: 0.45, duration: 2.4, ease: 'sine.out' }, 0.3)

      // 2. 3D Elephant Icon materializes in the center
      tl.to(
        '.ag-hero-icon',
        {
          scale: 1,
          opacity: 1,
          rotateX: 0,
          y: 0,
          duration: 1.35,
          ease: 'expo.out'
        },
        0.2
      )

      // 3. Concentric shockwave rings expand outward
      tl.to(
        '.ag-ring',
        {
          scale: (i) => 1 + i * 0.38,
          opacity: (i) => 0.36 - i * 0.09,
          duration: 1.6,
          stagger: 0.16,
          ease: 'expo.out'
        },
        0.45
      )

      // 4. Progress bar glides smoothly across
      tl.to('.ag-progress-fill', { scaleX: 1, duration: 4.4, ease: 'power2.inOut' }, 0.3)

      // 5. Glassmorphic Capability Capsules launch into spatial orbit
      PILLARS.forEach((b, i) => {
        const rad = (b.angle * Math.PI) / 180
        const tx = Math.cos(rad) * b.dist
        const ty = Math.sin(rad) * (b.dist * 0.62) - 18
        tl.to(
          `.ag-pill-${i}`,
          {
            x: tx,
            y: ty,
            scale: 1,
            opacity: 1,
            duration: 1.15,
            ease: 'back.out(1.35)'
          },
          0.65 + i * 0.09
        )
      })

      // 6. Typography reveal (Apple Keynote style blur-to-crisp)
      tl.to('.ag-title', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out' }, 1.1)
        .to('.ag-sub', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.85, ease: 'power3.out' }, 1.35)
        .to('.ag-author', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 1.55)

      // 7. Gentle floating pulse while squad connects
      tl.to(
        '.ag-hero-icon',
        {
          y: -6,
          scale: 1.04,
          duration: 1.4,
          yoyo: true,
          repeat: 1,
          ease: 'sine.inOut'
        },
        1.6
      )

      // 8. Converge capsules into the core & smooth glass fade out
      tl.to(
        '.ag-pill',
        {
          x: 0,
          y: -10,
          scale: 0.4,
          opacity: 0,
          duration: 0.65,
          stagger: 0.03,
          ease: 'power3.in'
        },
        4.1
      )
        .to('.ag-ring', { scale: 2.2, opacity: 0, duration: 0.7, ease: 'power2.in' }, 4.2)
        .to('.ag-stage', { scale: 1.06, opacity: 0, filter: 'blur(12px)', duration: 0.65, ease: 'power2.in' }, 4.55)
        .to(el, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 4.85)
    }, el)

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stopSound()
      ctx.revert()
    }
  }, [onDone])

  return (
    <div
      ref={root}
      className="splash"
      onClick={() => {
        if (!done.current) {
          done.current = true
          onDone()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={L('Pular abertura', 'Skip intro')}
      style={{
        background: '#05070e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f5f7ff',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Variable', sans-serif"
      }}
    >
      <div className="splash__drag" />

      {/* Spatial Aurora Mesh Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}
      >
        <div
          className="ag-orb ag-orb-1"
          style={{
            position: 'absolute',
            width: 680,
            height: 680,
            left: '50%',
            top: '42%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10, 132, 255, 0.34) 0%, rgba(94, 92, 230, 0.14) 48%, transparent 72%)',
            filter: 'blur(45px)'
          }}
        />
        <div
          className="ag-orb ag-orb-2"
          style={{
            position: 'absolute',
            width: 520,
            height: 520,
            left: '34%',
            top: '36%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
            filter: 'blur(50px)'
          }}
        />
        <div
          className="ag-orb ag-orb-3"
          style={{
            position: 'absolute',
            width: 560,
            height: 560,
            left: '66%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.26) 0%, transparent 70%)',
            filter: 'blur(55px)'
          }}
        />
      </div>

      {/* Main Spatial Glass Stage */}
      <div
        className="ag-stage"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: 780,
          padding: '0 24px'
        }}
      >
        {/* Orbit Zone */}
        <div
          style={{
            position: 'relative',
            width: 560,
            height: 310,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Concentric Rings */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="ag-ring"
              style={{
                position: 'absolute',
                width: 170,
                height: 170,
                borderRadius: '50%',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 0 30px rgba(56, 189, 248, 0.08)',
                pointerEvents: 'none'
              }}
            />
          ))}

          {/* Orbiting Capability Glass Pills */}
          {PILLARS.map((b, i) => (
            <div
              key={b.title}
              className={`ag-pill ag-pill-${i}`}
              style={{
                position: 'absolute',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px 7px 10px',
                borderRadius: 999,
                background: 'rgba(20, 25, 40, 0.58)',
                backdropFilter: 'blur(20px) saturate(190%)',
                WebkitBackdropFilter: 'blur(20px) saturate(190%)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 10px 28px rgba(0, 0, 0, 0.42)',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: b.color,
                  boxShadow: `0 0 10px ${b.color}`
                }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.01em' }}>{b.title}</span>
              <span style={{ fontSize: 11, color: 'rgba(186, 198, 224, 0.78)' }}>{b.sub}</span>
            </div>
          ))}

          {/* Center 3D Elephant Icon */}
          <div
            className="ag-hero-icon"
            style={{
              position: 'relative',
              width: 136,
              height: 136,
              borderRadius: 34,
              padding: 3,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(56,189,248,0.25) 50%, rgba(139,92,246,0.28) 100%)',
              boxShadow:
                '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 50px rgba(10, 132, 255, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.45)'
            }}
          >
            <img
              src={elefanteIcon}
              alt="Elefante"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 31,
                objectFit: 'cover',
                display: 'block'
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Apple Keynote Typography */}
        <h1
          className="ag-title"
          style={{
            margin: '8px 0 0',
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.05,
            background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent'
          }}
        >
          Elefante
        </h1>

        <p
          className="ag-sub"
          style={{
            margin: '10px 0 0',
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'rgba(203, 213, 225, 0.85)'
          }}
        >
          {L('Seu Esquadrão Autônomo de Agentes de IA.', 'Your Autonomous AI Agent Squad.')}
        </p>

        {/* Progress Capsule */}
        <div
          style={{
            width: 220,
            height: 5,
            marginTop: 26,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.09)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)'
          }}
        >
          <div
            className="ag-progress-fill"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #38bdf8 0%, #0a84ff 50%, #8b5cf6 100%)',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)'
            }}
          />
        </div>

        {/* Author Badge */}
        <div
          className="ag-author"
          style={{
            marginTop: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            fontSize: 12,
            color: 'rgba(148, 163, 184, 0.9)',
            letterSpacing: '0.02em'
          }}
        >
          <span>Criado por</span>
          <strong style={{ color: '#f8fafc', fontWeight: 600 }}>Vinicius Romeiro</strong>
        </div>
      </div>

      <span className="splash__skip" style={{ color: 'rgba(148, 163, 184, 0.65)' }}>
        {L('Clique ou aperte Esc para pular', 'Click or press Esc to skip')}
      </span>
    </div>
  )
}
