import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ScrollyCanvas from '../components/ScrollyCanvas'
import Overlay from '../components/Overlay'
import CinematicHover from '../components/CinematicHover'

function MeshOrb() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {[0, 1, 2].map(i => (
        <div key={i} className={`ripple-ring${i > 0 ? `-${i + 1}` : ''}`} style={{
          position: 'absolute', width: 160 + i * 80, height: 160 + i * 80, borderRadius: '50%',
          border: `1px solid rgba(0,122,255,${0.1 - i * 0.03})`,
        }} />
      ))}
      <div className="mesh-orb absolute" style={{ width: 200, height: 200, background: 'radial-gradient(circle at 35% 35%, rgba(147,197,253,0.8), rgba(37,99,235,0.4) 50%, rgba(30,64,175,0.2) 100%)' }} />
      <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,1), 0 12px 48px rgba(0,122,255,0.15)' }} />
      <div className="relative z-10 text-3xl">🛡</div>
    </div>
  )
}

function FeatureCard({ icon, title, body, accent = '#007AFF', delay = 0 }) {
  const cardRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isActive, setIsActive] = useState(false)

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsActive(true)
  }

  const handleMouseLeave = () => {
    setIsActive(false)
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseMove}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseLeave}
      onTouchCancel={handleMouseLeave}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="card card-hover spotlight-card p-10 flex flex-col gap-6 relative overflow-hidden"
    >
      <div 
        className="spotlight absolute pointer-events-none transition-opacity duration-300" 
        style={{ 
          left: mousePos.x - 150, // offset by half width for perfect center
          top: mousePos.y - 150, 
          width: 300,
          height: 300,
          opacity: isActive ? 1 : 0,
          background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)` 
        }} 
      />
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
        style={{ background: accent + '08', border: `1px solid ${accent}15` }}>{icon}</div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed m-0">{body}</p>
      </div>
    </motion.div>
  )
}

const EVENTS = [
  { time: '00:02', msg: 'Breach detected · MobiKwik_2021', level: 'HIGH' },
  { time: '00:06', msg: 'Groq LLM reasoning initiated', level: 'INFO' },
  { time: '00:11', msg: 'Risk level elevated → CRITICAL', level: 'CRIT' },
  { time: '00:15', msg: 'Solana tx anchored · devnet', level: 'OK' },
  { time: '00:19', msg: 'VC credential issued', level: 'OK' },
]
const PILL = { HIGH: 'badge-red', INFO: 'badge-blue', CRIT: 'badge-red', OK: 'badge-green', WARN: 'badge-amber' }

// ─── System Pipeline Visual ────────────────────────────────────────────────
function Pipeline() {
  const { t } = useI18n()
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
      <div style={{ width: '100%', height: '100%', backgroundImage: 'url(/Gemini_Generated_Image_xiykwzxiykwzxiyk.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center center' }} />
      <div style={{ position: 'absolute', top: 64, left: 64, maxWidth: 600 }}>
        <h2 style={{ fontSize: 48, fontWeight: 900, color: '#fff', marginBottom: 24 }}>{t.ecosystem.architecture.pipelineTitle}</h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{t.ecosystem.architecture.pipelineDesc}</p>
      </div>
    </div>
  )
}

function LiveLog() {
  const { t } = useI18n()
  const [shown, setShown] = useState([])
  const idx = useRef(0)
  useEffect(() => {
    const t = setInterval(() => {
      if (idx.current < EVENTS.length) setShown(v => [...v, EVENTS[idx.current++]])
      else { idx.current = 0; setShown([]) }
    }, 1500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="card p-8" style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13 }}>
      <div className="flex items-center justify-between mb-6">
        <span className="label-overline">{t.agent.systemLogs}</span>
        <span className="badge badge-green" style={{ fontSize: 10 }}>● {t.agent.liveLabel} {t.vault.liveStatus}</span>
      </div>
      <div style={{ minHeight: 180 }} className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {shown.map((ev, i) => ev && (
            <motion.div key={`${ev.time}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex items-center gap-4 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-gray-400 font-medium">{ev.time}</span>
              <span className={`badge ${PILL[ev.level]}`} style={{ fontSize: 9, padding: '2px 8px' }}>{ev.level}</span>
              <span className="text-gray-700 truncate">{ev.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const scrollContainerRef = useRef(null)
  const l = t.landing

  const FEATURES = [
    { icon: '🛰', title: t.onboard.headline, body: t.onboard.sub, accent: '#007AFF' },
    { icon: '🧠', title: t.agent.synthesisLabel, body: t.agent.logs.reasoning, accent: '#7C3AED' },
    { icon: '⚡', title: t.agent.status.running, body: t.agent.logs.reqAccepted, accent: '#D97706' },
    { icon: '🔗', title: t.agent.toast.verified, body: t.vault.sub, accent: '#7C3AED' },
    { icon: '📱', title: t.nav.notifs, body: t.agent.toast.fingerprint, accent: '#059669' },
    { icon: '🔐', title: t.onboard.secureVault, body: t.modal.secureSub, accent: '#DC2626' },
  ]

  return (
    <div className="bg-[#06070d] text-white selection:bg-[#007aff]/30">
      
      {/* ── CINEMATIC SCROLL SEQUENCE (500vh) ── */}
      <section ref={scrollContainerRef} className="relative h-[500vh] bg-[#06070d]">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <ScrollyCanvas scrollContainerRef={scrollContainerRef} />
          <Overlay scrollContainerRef={scrollContainerRef} />
          
          {/* Subtle grain overlay */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03] z-20 mix-blend-overlay"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
          />
        </div>
      </section>


      {/* FEATURES BENTO GRID */}
      <section className="py-32 px-6 bg-white relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <span className="label-overline block mb-4 text-[#007aff]">{l.capabilities}</span>
            <h2 className="text-4xl md:text-6xl font-light max-w-2xl leading-tight text-gray-900 tracking-tight">
              {l.perimeterHeadline}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => <FeatureCard key={i} {...f} delay={i * 0.05} />)}
          </div>
        </div>
      </section>

      {/* PREMIUM INTERACTIVE SCENE */}
      <CinematicHover />

      {/* SYSTEM PIPELINE VISUAL */}
      <Pipeline />

      {/* LIVE SYSTEM PREVIEW */}
      <section className="bg-[#FAFAFA] py-32 px-6 relative z-20 border-t border-gray-100" id="rl5c2e">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="label-overline block mb-4 text-[#007aff]">{t.agent.liveLabel}</span>
            <h2 className="text-4xl font-bold mb-8 text-gray-900 tracking-tight">{l.clinicalOversight}</h2>
            <p className="text-gray-500 text-lg mb-10 leading-relaxed font-light">
              {l.clinicalDesc}
            </p>
            <div className="flex gap-8">
              <div>
                <p className="text-3xl font-medium text-[#00d2ff] mb-1">99.9%</p>
                <p className="text-xs font-bold text-gray-500 tracking-wider uppercase">{l.precision}</p>
              </div>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="card">
            <LiveLog />
          </motion.div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-32 px-6 bg-white relative z-20">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-20 rounded-[48px] bg-gray-50 text-gray-900 text-center relative overflow-hidden border border-gray-200"
          >
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1, background: 'radial-gradient(circle at 50% 120%, #007AFF 0%, transparent 70%)' }} />
            <div className="relative z-10">
              <span className="text-blue-600 font-bold tracking-[0.3em] uppercase text-[10px] block mb-8">{l.deployNow}</span>
              <h2 className="text-4xl md:text-5xl font-light mb-8 max-w-2xl mx-auto tracking-tight">{l.assetHeadline}</h2>
              <p className="text-gray-500 mb-12 text-lg font-light">{l.joinPerimeter}</p>
              <button className="bg-gray-900 text-white px-10 py-4 rounded-full font-medium hover:scale-105 transition-transform shadow-lg" onClick={() => navigate('/register')}>
                {l.initPerimeter}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 border-t border-gray-200 bg-white px-6 relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-light text-xl tracking-tight text-gray-900">Tri-Zero<span className="text-blue-600 font-medium">TRO</span></span>
          </div>
          <div className="flex gap-10 text-sm font-light text-gray-500">
            <a href="#" className="hover:text-gray-900 transition-colors">{l.privacy}</a>
            <a href="#" className="hover:text-gray-900 transition-colors">{l.security}</a>
            <a href="#" className="hover:text-gray-900 transition-colors">{l.docs}</a>
          </div>
          <p className="text-sm text-gray-600 font-light">{l.copyright}</p>
        </div>
      </footer>
    </div>
  )
}

