import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Particle canvas ──────────────────────────────────────────────────────────
function Particles({ active }) {
  const ref = useRef()
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    let raf
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const pts = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.05,
      r: Math.random() * 1.4 + 0.3,
      life: Math.random(),
      speed: Math.random() * 0.006 + 0.002,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      pts.forEach(p => {
        p.life += p.speed
        if (p.life > 1) { p.life = 0; p.x = Math.random() * c.width; p.y = c.height + 5 }
        p.x += p.vx; p.y += p.vy
        const a = Math.sin(p.life * Math.PI) * (active ? 1 : 0.4)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,210,255,${a * 0.9})`; ctx.fill()
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 10, p.y - p.vy * 10)
        ctx.strokeStyle = `rgba(0,200,255,${a * 0.25})`; ctx.lineWidth = p.r * 0.6; ctx.stroke()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [active])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12, mixBlendMode: 'screen' }} />
}

// ─── Center core button ───────────────────────────────────────────────────────
function Core({ phase, onClick }) {
  const idle = phase === 'idle'
  const activating = phase === 'activating'
  return (
    <div onClick={onClick} style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)', zIndex: 30,
      cursor: idle ? 'pointer' : 'default',
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 80 + i * 36, height: 80 + i * 36,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          border: `1px solid rgba(0,210,255,${0.25 - i * 0.06})`,
          animation: `vaultRipple ${2.4 + i * 0.6}s ease-out ${i * 0.5}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}
      <motion.div
        animate={activating ? {
          boxShadow: ['0 0 20px 4px rgba(0,210,255,0.6)', '0 0 80px 20px rgba(0,210,255,1)', '0 0 120px 40px rgba(0,160,255,0.8)'],
          scale: [1, 1.3, 1.1],
        } : {}}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'radial-gradient(circle, #fff 10%, #00d2ff 40%, #007aff 70%, transparent 100%)',
          boxShadow: '0 0 20px 4px rgba(0,210,255,0.6), 0 0 60px rgba(0,140,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'coreBreath 3s ease-in-out infinite',
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px #fff' }} />
      </motion.div>
      {idle && (
        <p style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 16, fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'rgba(0,210,255,0.7)',
          whiteSpace: 'nowrap', animation: 'labelPulse 2s ease-in-out infinite',
        }}>ACTIVATE SYSTEM</p>
      )}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function VaultEntrance({ children }) {
  const [phase, setPhase] = useState('idle')
  const [isOpen, setIsOpen] = useState(false)
  const hasOpened = useRef(false)
  const phaseRef = useRef('idle')
  const openRef = useRef(false)
  phaseRef.current = phase
  openRef.current = isOpen

  const activate = () => {
    if (phaseRef.current !== 'idle') return
    setPhase('activating')
    setTimeout(() => setPhase('opening'), 150)
    setTimeout(() => { setPhase('open'); setIsOpen(true); hasOpened.current = true }, 300)
  }

  // The vault is a one-time preloader now. No scroll listener needed.

  const spring = { type: 'spring', stiffness: 80, damping: 20, mass: 1 }
  const isActivating = phase === 'activating'

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Dashboard behind */}
      <motion.div animate={{ opacity: isOpen ? 1 : 0 }} transition={{ duration: 1.2 }}
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
        {children}
      </motion.div>

      {/* Vault overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        perspective: '2200px', perspectiveOrigin: 'center center',
        pointerEvents: isOpen ? 'none' : 'auto',
      }}>
        {/* Center glow seam */}
        <motion.div animate={{ opacity: isOpen ? 0 : 0.8, scaleX: isActivating ? 6 : 1 }}
          transition={{ duration: isActivating ? 0.2 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg,transparent,rgba(0,210,255,0.9) 30%,rgba(0,210,255,1) 50%,rgba(0,210,255,0.9) 70%,transparent)',
            filter: 'blur(5px)', zIndex: 16, pointerEvents: 'none',
          }} />

        {/* Bloom on activate */}
        <AnimatePresence>
          {isActivating && (
            <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              style={{
                position: 'absolute', top: '50%', left: '50%', width: 700, height: 700,
                transform: 'translate(-50%,-50%)', borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(0,210,255,0.28) 0%,rgba(0,140,255,0.08) 50%,transparent 70%)',
                filter: 'blur(24px)', pointerEvents: 'none', zIndex: 14,
              }} />
          )}
        </AnimatePresence>

        <Particles active={isActivating} />

        {/* LEFT DOOR */}
        <motion.div
          animate={isOpen ? { x: '-101%', rotateY: -16, filter: 'brightness(0.6) blur(0.5px)' }
                        : { x: '0%',    rotateY: 0,   filter: 'brightness(1) blur(0px)' }}
          transition={spring}
          style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', transformOrigin: 'left center', overflow: 'hidden', willChange: 'transform' }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/vault-door.png)', backgroundSize: '200% 100%', backgroundPosition: 'left center', backgroundRepeat: 'no-repeat' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(270deg,rgba(0,200,255,0.07) 0%,transparent 50%)', animation: 'doorBreath 4s ease-in-out infinite' }} />
          <motion.div animate={{ opacity: isOpen ? 0 : 1 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg,transparent,rgba(0,210,255,1) 50%,transparent)', boxShadow: '0 0 14px 4px rgba(0,210,255,0.7)' }} />
          <motion.div animate={isOpen ? { opacity: [0, 0.5, 0] } : { opacity: 0 }} transition={{ duration: 0.8 }}
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(270deg,rgba(0,210,255,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
        </motion.div>

        {/* RIGHT DOOR */}
        <motion.div
          animate={isOpen ? { x: '101%',  rotateY: 16,  filter: 'brightness(0.6) blur(0.5px)' }
                        : { x: '0%',     rotateY: 0,   filter: 'brightness(1) blur(0px)' }}
          transition={spring}
          style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', transformOrigin: 'right center', overflow: 'hidden', willChange: 'transform' }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/vault-door.png)', backgroundSize: '200% 100%', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,200,255,0.07) 0%,transparent 50%)', animation: 'doorBreath 4s ease-in-out infinite' }} />
          <motion.div animate={{ opacity: isOpen ? 0 : 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg,transparent,rgba(0,210,255,1) 50%,transparent)', boxShadow: '0 0 14px 4px rgba(0,210,255,0.7)' }} />
          <motion.div animate={isOpen ? { opacity: [0, 0.5, 0] } : { opacity: 0 }} transition={{ duration: 0.8 }}
            style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,210,255,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
        </motion.div>

        {/* Core — hidden when open */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              style={{ position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'auto' }}>
              <Core phase={phase} onClick={activate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
