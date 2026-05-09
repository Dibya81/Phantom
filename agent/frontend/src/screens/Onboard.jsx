import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

const API_BASE = 'https://phantom-mlxh.onrender.com'

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
    <div className="hidden lg:flex flex-col items-center justify-center relative mesh-bg" style={{
      width: '42%', minHeight: '100vh',
      borderRight: '1px solid var(--border)',
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
            background: 'var(--bg-soft)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-premium), inset 0 1px 2px rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
          }}
        >🛡</motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.03em' }}
        >
          PhantomID
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.8 }}
          style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 280, margin: '0 auto 48px' }}
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
                background: 'var(--bg-soft)', backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderRadius: 100, padding: '10px 20px', maxWidth: 260,
                boxShadow: 'var(--shadow-premium)',
              }}
            >
              <span style={{ fontSize: 16 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{f.label}</span>
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
  
  const [mode, setMode] = useState('register') // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    if (!email || !password || (mode === 'register' && !phone)) {
      setError('Required fields missing.')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const endpoint = mode === 'register' ? `${API_BASE}/register` : `${API_BASE}/login`
      const body = mode === 'register' 
        ? { email, phone, password }
        : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json().catch(() => ({ detail: 'Server error. Please try again later.' }))
      
      if (!res.ok) {
        setError(data.detail || 'Authentication failed.')
        setLoading(false)
        return
      }
      localStorage.setItem('phantom-email', data.email)
      
      login({ email: data.email, pseudonym: data.user_token }, data.user_token)
      
      // Auto breach check will be triggered by LiveAgent or a shared hook
      navigate('/agent')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <LeftPanel />
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ width: '100%', maxWidth: 400 }}
        >
          <div style={{ marginBottom: 40 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', color: '#3B82F6', textTransform: 'uppercase' }}>
              {mode === 'register' ? 'New Account' : 'Welcome Back'}
            </span>
            <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 32, color: 'var(--text-primary)', marginTop: 8, letterSpacing: '-0.02em' }}>
              {mode === 'register' ? 'Create your Phantom.' : 'Access your Vault.'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
              {mode === 'register' ? 'Your data is hashed locally. We only ever see cryptographic fingerprints.' : 'Enter your credentials to manage your identity defense.'}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <FloatingInput 
              label="Email Address" 
              value={email} 
              onChange={setEmail} 
              type="email" 
              placeholder="you@example.com" 
              valid={email.includes('@') && email.includes('.')} 
            />
            
            {mode === 'register' && (
              <FloatingInput 
                label="Phone Number" 
                value={phone} 
                onChange={setPhone} 
                type="tel" 
                placeholder="+91 98765 43210" 
                valid={phone.length >= 10} 
              />
            )}

            <FloatingInput 
              label="Password" 
              value={password} 
              onChange={setPassword} 
              type="password" 
              placeholder="••••••••" 
              valid={password.length >= 8} 
            />

            <AnimatePresence>
              {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px' }}
                  >
                    <p style={{ fontSize: 13, color: '#EF4444', margin: 0, fontWeight: 500 }}>{error}</p>
                  </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '16px 0', fontSize: 16, marginTop: 12 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                  />
                  {mode === 'register' ? 'Activating…' : 'Authenticating…'}
                </span>
              ) : (mode === 'register' ? 'Activate Identity' : 'Secure Login')}
            </motion.button>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 14, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                {mode === 'register' ? 'Already have an account? Login' : 'Need an account? Register'}
              </button>
            </div>

            <div style={{ marginTop: 48, textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: 32 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                By continuing, you agree to our zero-knowledge privacy protocols and encrypted data handling.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
