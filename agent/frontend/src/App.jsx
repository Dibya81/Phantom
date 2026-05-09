import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { I18nProvider, useI18n } from './contexts/I18nContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage from './screens/LandingPage'
import Onboard from './screens/Onboard'
import LiveAgent from './screens/LiveAgent'
import CredentialVault from './screens/CredentialVault'
import TriZeroTRO from './screens/TriZeroTRO'
import VaultEntrance from './components/VaultEntrance'

function NavBar() {
  const { t } = useI18n()
  const { lang, changeLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const { user, logout, isAuthenticated } = useAuth()
  const n = t.nav
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const links = [
    { to: '/agent', label: n.agent },
    { to: '/vault',  label: n.vault  },
  ]

  const THEMES = [
    { id: 'light',  icon: '☀️', label: t.settings.light  },
    { id: 'dark',   icon: '🌙', label: t.settings.dark   },
    { id: 'system', icon: '💻', label: t.settings.system },
  ]
  const LANGS = [
    { id: 'en', label: 'EN', full: t.settings.en },
    { id: 'hi', label: 'हि', full: t.settings.hi   },
    { id: 'kn', label: 'ಕ',  full: t.settings.kn },
  ]

  return (
    <>
      <nav className="glass-nav fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          {/* Brand */}
          <NavLink to="/" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[10px] font-extrabold tracking-tighter">TZ</span>
            </div>
            <span style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:16, color:'var(--text-primary)', letterSpacing:'0.05em', textTransform: 'uppercase' }}>
              Tri-Zero<span style={{ color:'var(--accent)' }}>TRO</span>
            </span>
          </NavLink>

          {/* Desktop segmented nav */}
          <div className="hidden md:flex items-center gap-1 segmented">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `segmented-item${isActive ? ' active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
          </div>

          {/* Controls: Lang + Theme + Account */}
          <div className="hidden md:flex items-center gap-2 relative">

            {/* Settings toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(s => !s)}
                style={{ padding: '6px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <span>{THEMES.find(th => th.id === theme)?.icon}</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11 }}>{LANGS.find(l => l.id === lang)?.label}</span>
                <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
              </button>

              <AnimatePresence>
                {showSettings && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.4,0,0.2,1] }}
                      style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 220, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: 12, zIndex: 50, boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}
                    >
                      {/* Theme */}
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>{n.appearance}</p>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                        {THEMES.map(th => (
                          <button key={th.id} onClick={() => setTheme(th.id)}
                            style={{ flex: 1, padding: '7px 4px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${theme === th.id ? 'var(--accent)' : 'var(--border)'}`, background: theme === th.id ? 'var(--accent-soft)' : 'transparent', color: theme === th.id ? 'var(--accent)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}
                          >
                            <span style={{ fontSize: 14 }}>{th.icon}</span>
                            <span>{th.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Language */}
                      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>{n.language}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {LANGS.map(l => (
                          <button key={l.id} onClick={() => { changeLang(l.id); }}
                            style={{ padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: lang === l.id ? 600 : 400, cursor: 'pointer', border: 'none', background: lang === l.id ? 'var(--accent-soft)' : 'transparent', color: lang === l.id ? 'var(--accent)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', transition: 'all 0.15s' }}
                          >
                            <span>{l.full}</span>
                            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, opacity: 0.6 }}>{l.label}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Account */}
            {!isAuthenticated ? (
              <NavLink to="/register">
                <button className="btn-primary" style={{ padding:'9px 20px', fontSize:13 }}>
                  {n.getStarted}
                </button>
              </NavLink>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowAccount(!showAccount)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:100, cursor:'pointer', background:'var(--bg-subtle)', border:'1px solid var(--border)', transition:'all 0.2s' }}
                >
                  <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--accent-mid)', color:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{n.account}</span>
                  <span style={{ fontSize:9, color:'var(--text-muted)' }}>▼</span>
                </button>

                <AnimatePresence>
                  {showAccount && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowAccount(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        style={{ position:'absolute', right:0, top:'calc(100% + 8px)', width:220, background:'var(--bg-card)', border:'1px solid var(--border-strong)', borderRadius:16, padding:8, zIndex:50, boxShadow:'0 16px 48px rgba(0,0,0,0.12)' }}
                      >
                        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
                          <p style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', margin:'0 0 4px' }}>{n.signedInAs}</p>
                          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:0 }}>{user.email}</p>
                          {user.phone && <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>{user.phone}</p>}
                        </div>
                        {[
                          { label: n.profile, action: () => {} },
                          { label: n.settings, action: () => {} },
                        ].map(item => (
                          <button key={item.label} style={{ width:'100%', textAlign:'left', padding:'8px 14px', fontSize:13, color:'var(--text-primary)', background:'transparent', border:'none', borderRadius:10, cursor:'pointer', transition:'background 0.15s' }}
                            onMouseEnter={e => e.target.style.background='var(--bg-soft)'}
                            onMouseLeave={e => e.target.style.background='transparent'}>{item.label}</button>
                        ))}
                        <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
                        <button onClick={logout} style={{ width:'100%', textAlign:'left', padding:'8px 14px', fontSize:13, fontWeight:600, color:'#EF4444', background:'transparent', border:'none', borderRadius:10, cursor:'pointer', transition:'background 0.15s' }}
                          onMouseEnter={e => e.target.style.background='rgba(239,68,68,0.06)'}
                          onMouseLeave={e => e.target.style.background='transparent'}>{n.logout}</button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden flex flex-col gap-1.5 p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <span className="block w-5 h-0.5 rounded" style={{ background:'var(--text-primary)' }} />
            <span className="block w-5 h-0.5 rounded" style={{ background:'var(--text-primary)' }} />
            <span className="block w-3.5 h-0.5 rounded" style={{ background:'var(--text-primary)' }} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100]" style={{ background: 'rgba(var(--bg),0.95)', backdropFilter:'blur(24px)' }}>
            <div className="flex flex-col items-center justify-center h-full gap-8">
              <button onClick={() => setMobileOpen(false)} className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center" style={{ background:'var(--bg-subtle)' }}>
                <span style={{ fontSize:18 }}>×</span>
              </button>
              {links.map((l, i) => (
                <motion.div key={l.to} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}>
                  <NavLink to={l.to} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => `block text-2xl font-semibold ${isActive ? 'text-blue-500' : ''}`}
                    style={{ fontFamily:'Inter,sans-serif', color: 'var(--text-primary)' }}>{l.label}</NavLink>
                </motion.div>
              ))}
              {/* Mobile lang + theme */}
              <div style={{ display:'flex', gap:8 }}>
                {LANGS.map(l => (
                  <button key={l.id} onClick={() => { changeLang(l.id); setMobileOpen(false); }} style={{ padding:'8px 14px', borderRadius:10, fontSize:13, fontWeight:600, border:`1px solid ${lang===l.id?'var(--accent)':'var(--border)'}`, background:lang===l.id?'var(--accent-soft)':'transparent', color:lang===l.id?'var(--accent)':'var(--text-secondary)', cursor:'pointer' }}>{l.full}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {THEMES.map(th => (
                  <button key={th.id} onClick={() => setTheme(th.id)} style={{ padding:'8px 12px', borderRadius:10, fontSize:12, border:`1px solid ${theme===th.id?'var(--accent)':'var(--border)'}`, background:theme===th.id?'var(--accent-soft)':'transparent', color:theme===th.id?'var(--accent)':'var(--text-secondary)', cursor:'pointer' }}>{th.icon} {th.label}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen"
        style={{ paddingTop: location.pathname === '/' ? 0 : 56 }}
      >
        <Routes location={location}>
          <Route path="/" element={
            <VaultEntrance>
              <TriZeroTRO />
            </VaultEntrance>
          } />
          <Route path="/intro" element={<LandingPage />} />
          <Route path="/register" element={<Onboard />} />
          <Route path="/agent"    element={<LiveAgent />} />
          <Route path="/vault"    element={<CredentialVault />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <I18nProvider>
          <BrowserRouter>
            <NavBar />
            <AnimatedRoutes />
          </BrowserRouter>
        </I18nProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
