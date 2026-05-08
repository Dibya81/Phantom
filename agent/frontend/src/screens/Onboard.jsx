import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

const API = '/api'

function FloatingInput({ label, value, onChange, type = 'text', placeholder, valid }) {
  return (
    <div className="input-wrap">
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="input-elegant"
      />
      <label className="input-label">{label}</label>
      <AnimatePresence>
        {valid && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ position: 'absolute', right: 0, top: 32, fontSize: 18, color: '#10B981' }}
          >✓</motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function LeftPanel() {
  return (
    <div className="hidden lg:flex flex-col items-center justify-center relative" style={{
      width: '42%', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(0,122,255,0.14) 0%, transparent 60%), radial-gradient(ellipse at 60% 30%, rgba(147,51,234,0.1) 0%, transparent 50%), #F8FAFF',
    }}>
      {/* Animated rings */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[180, 280, 380, 480].map((size, i) => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: size, height: size,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: `1px solid rgba(0,122,255,${0.08 - i * 0.015})`,
            animation: `ripple ${3 + i * 0.5}s ease-out ${i * 0.4}s infinite`,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', textAlign: 'center', padding: '0 40px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: 100, height: 100, borderRadius: '50%', margin: '0 auto 32px',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 16px 64px rgba(0,122,255,0.15), inset 0 1px 2px rgba(255,255,255,1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
          }}
        >🛡</motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 28, color: '#111827', marginBottom: 12, letterSpacing: '-0.03em' }}
        >
          PhantomID
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, maxWidth: 280, margin: '0 auto 48px' }}
        >
          Autonomous identity defense powered by AI and anchored on chain.
        </motion.p>

        {/* Feature pills */}
        {[
          { icon: '🔒', label: 'Zero-knowledge hashing' },
          { icon: '🧠', label: 'Groq LLaMA 3.1 reasoning' },
          { icon: '⛓', label: 'Solana-anchored proofs' },
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '10px auto',
              background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: 100, padding: '10px 20px', maxWidth: 260,
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: 16 }}>{f.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{f.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function Onboard() {
  const { t } = useI18n()
  const { login } = useAuth()
  const o = t.onboard
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pan, setPan] = useState('')
  const [gmail, setGmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const u = new URLSearchParams(window.location.search)
    if (u.get('gmail') === 'connected') setGmail(true)
  }, [])

  const handleGmail = async () => {
    const token = localStorage.getItem('phantom-token')
    if (!token) { setError('Activate the agent first, then connect Gmail.'); return }
    const res = await fetch(`${API}/connect-gmail`, { method: 'POST', headers: { 'X-User-Token': token } })
    const data = await res.json()
    if (data.auth_url) window.location.href = data.auth_url
  }

  const handleActivate = async () => {
    if (!email || !phone || !pan) { setError('All fields are required.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, pan_prefix: pan })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed')
      localStorage.setItem('phantom-token', data.user_token)
      login({ email, phone, pan_prefix: pan }, data.user_token)
      navigate('/agent')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>
      <LeftPanel />

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 40px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 48 }}>
            <span style={{
              display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#007AFF', marginBottom: 16,
            }}>New Account</span>
            <h1 style={{
              fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 36,
              letterSpacing: '-0.04em', color: '#111827', marginBottom: 10, lineHeight: 1.1,
            }}>Create your Phantom.</h1>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.65 }}>
              Your data is hashed locally. We only ever see cryptographic fingerprints.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 28 }}
          >
            <FloatingInput label={o.email} value={email} onChange={setEmail} type="email" placeholder="you@example.com" valid={email.includes('@') && email.includes('.')} />
            <FloatingInput label={o.phone} value={phone} onChange={setPhone} type="tel" placeholder="+91 98765 43210" valid={phone.length >= 10} />
            <FloatingInput label={`${o.pan} (first 5 chars)`} value={pan} onChange={setPan} placeholder="ABCDE" valid={pan.length === 5} />

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px' }}
                >
                  <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gmail connect */}
            <motion.button
              onClick={handleGmail}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 100, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                background: gmail ? '#F0FDF4' : '#fff',
                color: gmail ? '#166534' : '#374151',
                border: gmail ? '1px solid #BBF7D0' : '1px solid #E5E7EB',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {gmail ? (
                <><span style={{ color: '#10B981' }}>✓</span> Gmail connected</>
              ) : (
                <><span>📧</span> Connect Gmail for context signals</>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleActivate}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '16px 0', fontSize: 16 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                  />
                  Activating…
                </span>
              ) : o.activate}
            </motion.button>

            <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7 }}>{o.privacy}</p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
