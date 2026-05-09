import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useTheme } from '../contexts/ThemeContext'

// ─── Ambient Background ──────────────────────────────────────────────────────
function EcosystemBg() {
  const { theme } = useTheme()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--sys-grid) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      <motion.div 
        animate={{ 
          x: [0, 100, 0], 
          y: [0, -60, 0],
          scale: [1, 1.1, 1]
        }} 
        transition={{ repeat: Infinity, duration: 25, ease: 'easeInOut' }}
        style={{ 
          position: 'absolute', top: '-10%', left: '-5%', width: '60%', height: '60%', 
          background: `radial-gradient(circle, var(--sys-orb-a) 0%, transparent 70%)`, 
          filter: 'blur(100px)', opacity: 0.6 
        }} 
      />
      <motion.div 
        animate={{ 
          x: [0, -80, 0], 
          y: [0, 80, 0],
          scale: [1, 1.05, 1]
        }} 
        transition={{ repeat: Infinity, duration: 30, ease: 'easeInOut' }}
        style={{ 
          position: 'absolute', bottom: '-10%', right: '-5%', width: '55%', height: '55%', 
          background: `radial-gradient(circle, var(--sys-orb-b) 0%, transparent 70%)`, 
          filter: 'blur(100px)', opacity: 0.5 
        }} 
      />
    </div>
  )
}

// ─── Neural Portal (Hover Reveal) ──────────────────────────────────────────
function NeuralPortal() {
  const portalRef = useRef(null)
  const { t } = useI18n()

  const handleMouseMove = (e) => {
    const r = portalRef.current.getBoundingClientRect()
    portalRef.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
    portalRef.current.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <div 
      ref={portalRef}
      onMouseMove={handleMouseMove}
      style={{ 
        position: 'relative', width: '100%', height: 'calc(100vh - 64px)', 
        marginTop: 64,
        overflow: 'hidden', background: '#000', cursor: 'none',
        '--mx': '-1000px', '--my': '-1000px'
      }}
    >
      {/* Base Reality (Outer - 1.png) */}
      <div style={{ 
        position: 'absolute', inset: 0, 
        backgroundImage: 'url(/1.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center top' 
      }} />

      {/* Neural Insight (Inner - 2.png) - Revealed on Hover */}
      <div style={{ 
        position: 'absolute', inset: 0, 
        backgroundImage: 'url(/2.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center top',
        zIndex: 2,
        WebkitClipPath: 'circle(250px at var(--mx) var(--my))',
        clipPath: 'circle(250px at var(--mx) var(--my))',
        transition: 'clip-path 0.05s linear'
      }} />

      {/* Portal Overlay Label */}
      <div style={{ position: 'absolute', bottom: 40, left: 40, zIndex: 10, pointerEvents: 'none' }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.4em', color: '#fff', textTransform: 'uppercase', opacity: 0.6 }}>{t.ecosystem.scanner.title}</p>
        <p style={{ fontSize: 14, color: '#fff', fontWeight: 300 }}>{t.ecosystem.scanner.desc}</p>
      </div>

      {/* Custom Cursor Dot */}
      <div style={{ 
        position: 'absolute', top: 0, left: 0, width: 8, height: 8, 
        background: '#fff', borderRadius: '50%', zIndex: 100, pointerEvents: 'none',
        boxShadow: '0 0 20px #fff',
        transform: 'translate(calc(var(--mx) - 4px), calc(var(--my) - 4px))'
      }} />
    </div>
  )
}

// ─── Cinematic Card ──────────────────────────────────────────────────────────
function ProjectCard({ title, tagline, problem, tech, features, accent, visual, onClick }) {
  const { t } = useI18n()
  const cardRef = useRef(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -8 }}
      onClick={onClick}
      style={{
        width: '100%', minHeight: 600,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 40,
        padding: 64,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 64,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: isHovered ? 'var(--shadow-floating)' : 'var(--shadow-premium)',
        transition: 'box-shadow 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div 
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, ${accent}08 0%, transparent 40%)`,
          opacity: isHovered ? 1 : 0, transition: 'opacity 0.3s'
        }}
      />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.4em', color: accent, textTransform: 'uppercase', marginBottom: 24, display: 'block' }}>{tagline}</span>
        <h2 style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text-primary)', margin: '0 0 32px', lineHeight: 1 }}>{title}</h2>
        
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{t.ecosystem.problemLabel}</p>
          <p style={{ fontSize: 24, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.4, margin: 0 }}>{problem}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 48 }}>
          {features.map((f, i) => (
            <div key={i}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{f.title}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tech.map((t, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, background: 'var(--bg-subtle)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 100, border: '1px solid var(--border)' }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {visual}
      </div>
    </motion.div>
  )
}

// ─── Visual Components ───────────────────────────────────────────────────────
function PhantomVisual() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 40, ease: 'linear' }} style={{ position: 'absolute', width: 400, height: 400, border: '1px dashed rgba(0,122,255,0.2)', borderRadius: '50%' }} />
      <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 60, ease: 'linear' }} style={{ position: 'absolute', width: 320, height: 320, border: '1px solid rgba(0,122,255,0.1)', borderRadius: '50%' }} />
      <div style={{ position: 'relative', zIndex: 5, width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #1E40AF)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(59,130,246,0.4)' }}>
        <span style={{ fontSize: 64 }}>🧠</span>
      </div>
    </div>
  )
}

function TrustFlowVisual() {
  const { t } = useI18n()
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 400, height: 280, background: 'var(--bg-subtle)', borderRadius: 32, border: '1px solid var(--border-strong)', padding: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🤝</div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#D97706', margin: 0 }}>{t.agent.status.running}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>4.20 SOL</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i} initial={{ x: -20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.2 }}
              style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: i < 2 ? '#10B981' : '#D97706' }} />
              <div style={{ flex: 1, height: 8, background: 'var(--bg-subtle)', borderRadius: 4 }} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function WitnessVisual() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(139,92,246,0.1)', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 64 }}>🏙️</span>
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 4 }} style={{ position: 'absolute', inset: -20, border: '1px solid rgba(139,92,246,0.2)', borderRadius: '50%' }} />
      </div>
    </div>
  )
}

// ─── Architecture Components ────────────────────────────────────────────────
function ArchNode({ label, tech, x, y, delay }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.6 }}
      style={{ position: 'absolute', top: `${y}%`, left: `${x}%`, padding: '16px 24px', background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 12, boxShadow: '0 0 30px var(--accent-soft)', zIndex: 10, textAlign: 'center', transform: 'translate(-50%, -50%)' }}
    >
      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{tech}</p>
    </motion.div>
  )
}

function DataStream() {
  const { t } = useI18n()
  const sources = ['Indian Breach DB', 'HIBP Repository', 'NVD CVE Intel', 'Kaggle Cyber Data', 'CERT-In Feed']
  return (
    <div style={{ padding: 40, background: 'var(--sys-terminal)', borderRadius: 32, border: '1px solid var(--sys-term-border)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: '#64748B' }}>{t.ecosystem.infrastructure.feedsTitle}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sources.map((s, i) => (
          <motion.div key={i} animate={{ x: [0, 5, 0], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 4, delay: i * 0.5 }} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#10B981', display: 'flex', justifyContent: 'space-between' }}>
            <span>{s}</span><span style={{ opacity: 0.5 }}>{t.ecosystem.infrastructure.connected}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TriZeroTRO() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const ec = t.ecosystem
  
  const containerRef = useRef(null)
  const heroRef = useRef(null)
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  })

  const opacityHero = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const scaleHero = useTransform(scrollYProgress, [0, 0.8], [1, 0.9])

  return (
    <div ref={containerRef} style={{ position: 'relative', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <EcosystemBg />
      
      {/* SECTION 0: NEURAL PORTAL */}
      <NeuralPortal />

      {/* SECTION 1: HERO */}
      <motion.section 
        ref={heroRef}
        style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center', 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          padding: '0 24px', 
          opacity: opacityHero, 
          scale: scaleHero,
          pointerEvents: 'auto'
        }}
      >
        <motion.span initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.5em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 32, display: 'block' }}>Tri-ZeroTRO 2026</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ fontSize: 'clamp(48px, 8vw, 120px)', fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.9, marginBottom: 40, maxWidth: 1200, color: 'var(--text-primary)' }}>
          {ec.headline.split(' ').map((word, i) => word === 'Autonomous' || word === 'Systems.' ? <span key={i} style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{word} </span> : word + ' ')}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ fontSize: 'clamp(18px, 2vw, 24px)', color: 'var(--text-secondary)', maxWidth: 800, fontWeight: 300, lineHeight: 1.5, marginBottom: 48 }}>{ec.sub}</motion.p>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ display: 'flex', gap: 16, zIndex: 20 }}>
          <button onClick={() => navigate('/intro')} className="btn-primary" style={{ padding: '16px 32px', fontSize: 14, boxShadow: '0 20px 40px rgba(0,122,255,0.2)' }}>{ec.cta1}</button>
          <button className="btn-secondary" style={{ padding: '16px 32px', fontSize: 14, background: 'var(--bg-card)', backdropFilter: 'blur(12px)' }}>{ec.cta2}</button>
          <button onClick={() => window.location.href = 'https://trust-flow-delta-livid.vercel.app/'} className="btn-secondary" style={{ padding: '16px 32px', fontSize: 14, background: 'var(--bg-card)', backdropFilter: 'blur(12px)' }}>{ec.cta3}</button>
        </motion.div>
        
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-muted)' }}>{t.nav.scrollExpl}</span><div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom, var(--accent), transparent)' }} /></motion.div>
      </motion.section>

      {/* SECTION 2: THE SYSTEMS */}
      <section style={{ position: 'relative', zIndex: 20, padding: '160px 24px', display: 'flex', flexDirection: 'column', gap: 120, maxWidth: 1400, margin: '0 auto' }}>
        <ProjectCard 
          title={ec.projects.phantom.title} 
          tagline={ec.projects.phantom.tagline} 
          problem={ec.projects.phantom.problem} 
          tech={['LangGraph', 'Groq', 'Solana', 'Supabase']} 
          features={[{ title: ec.projects.phantom.f1_title, desc: ec.projects.phantom.f1_desc }, { title: ec.projects.phantom.f2_title, desc: ec.projects.phantom.f2_desc }]} 
          accent="#3B82F6" visual={<PhantomVisual />} onClick={() => navigate('/intro')} />
        
        <ProjectCard 
          title={ec.projects.trustflow.title} 
          tagline={ec.projects.trustflow.tagline} 
          problem={ec.projects.trustflow.problem} 
          tech={['Solana', 'FastAPI', 'GitHub', 'Claude AI']} 
          features={[{ title: ec.projects.trustflow.f1_title, desc: ec.projects.trustflow.f1_desc }, { title: ec.projects.trustflow.f2_title, desc: ec.projects.trustflow.f2_desc }]} 
          accent="#D97706" visual={<TrustFlowVisual />} onClick={() => window.location.href = 'https://trust-flow-delta-livid.vercel.app/'} />
        
        <ProjectCard 
          title={ec.projects.witness.title} 
          tagline={ec.projects.witness.tagline} 
          problem={ec.projects.witness.problem} 
          tech={['React Native', 'IPFS', 'TensorFlow.js']} 
          features={[{ title: ec.projects.witness.f1_title, desc: ec.projects.witness.f1_desc }, { title: ec.projects.witness.f2_title, desc: ec.projects.witness.f2_desc }]} 
          accent="#8B5CF6" visual={<WitnessVisual />} onClick={() => {}} />
      </section>

      {/* SECTION 3: ARCHITECTURE Visual */}
      <section style={{ position: 'relative', zIndex: 20, padding: '160px 0', textAlign: 'center', background: 'var(--bg)' }}>
        <h2 style={{ fontSize: 64, fontWeight: 900, marginBottom: 80 }}>{ec.architecture.headline.split('.').map((s, i) => i === 1 ? <span key={i} style={{ color: 'var(--accent)' }}>{s}</span> : s + '.')}</h2>
        
        {/* Full Screen Image Container */}
        <div style={{ 
          width: '100%', 
          height: '100vh', 
          backgroundImage: 'url(/3rd.png)', 
          backgroundSize: 'contain', 
          backgroundRepeat: 'no-repeat', 
          backgroundPosition: 'center center',
          marginBottom: 120
        }} />

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 64, 
          maxWidth: 1200, 
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: 40,
          padding: 64,
          boxShadow: 'var(--shadow-premium)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 30
        }}>
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ fontSize: 32, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>{ec.infrastructure.title}</h3>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{ec.infrastructure.desc}</p>
          </div>
          <DataStream />
        </div>
      </section>

      {/* SECTION 4: LOCALIZATION MATRIX */}
      <section style={{ position: 'relative', zIndex: 20, padding: '160px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 48, textAlign: 'center' }}>{t.nav.locMatrix}</h2>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 24, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-strong)' }}><th style={{ padding: '20px 24px', textAlign: 'left', fontSize: 12, fontWeight: 800 }}>{t.nav.matrixComp}</th><th style={{ padding: '20px 24px', textAlign: 'left', fontSize: 12, fontWeight: 800 }}>{t.nav.matrixCov}</th><th style={{ padding: '20px 24px', textAlign: 'left', fontSize: 12, fontWeight: 800 }}>{t.nav.matrixLang}</th></tr></thead>
              <tbody>
                {[t.nav.agent, t.nav.vault, t.nav.modal, t.nav.notifs].map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '20px 24px', fontSize: 14, fontWeight: 600 }}>{c}</td><td style={{ padding: '20px 24px', fontSize: 14, color: '#10B981', fontWeight: 800 }}>100%</td><td style={{ padding: '20px 24px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>EN, HI, KN</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer style={{ padding: '120px 24px 64px', textAlign: 'center', borderTop: '1px solid var(--border-strong)' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t.landing.copyright}</p>
      </footer>
    </div>
  )
}
