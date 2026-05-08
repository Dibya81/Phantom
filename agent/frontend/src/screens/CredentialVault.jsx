import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { jsPDF } from 'jspdf'
import { useI18n } from '../contexts/I18nContext'
import ThreatBadge from '../components/ThreatBadge'

const API = '/api'

// ─── Simulation Data ────────────────────────────────────────────────────────
const FEED_POOL = [
  'Block header verified. Hash: 0xa3f...c12.',
  'ZK proof generated. Entropy: 256-bit.',
  'Solana ledger confirmed. Slot #442810.',
  'IPFS chunk pinned. CID: Qm...f3a.',
  'Identity vector normalized.',
  'Perimeter scan: 0 intrusions detected.',
  'Merkle root computed. Integrity: OK.',
  'Node latency: 11ms. All peers online.',
  'Encryption layer rotated. AES-256.',
  'Memory flush complete. Buffer cleared.',
  'Threat DB sync: 2,841 signatures loaded.',
  'Consensus reached. Round #1,204.',
]

const MOCK_TIMELINE = [
  { id: 'mock-1', detected_at: new Date(Date.now() - 3600000).toISOString(), risk_level: 'LOW', threat_assessment: { threat_summary: 'Minor anomaly in identity fingerprint. Auto-resolved.' }, proof_result: { solana_tx_sig: null, ipfs_cid: null } },
  { id: 'mock-2', detected_at: new Date(Date.now() - 7200000).toISOString(), risk_level: 'MEDIUM', threat_assessment: { threat_summary: 'Credential pattern deviation detected and sealed.' }, proof_result: { solana_tx_sig: 'sim_tx_abc123', ipfs_cid: null } },
]

const NODE_POSITIONS = [
  { cx: '50%', cy: '50%', r: 14, color: '#3B82F6', speed: 0 },
  { cx: '22%', cy: '22%', r: 8, color: '#10B981', speed: 4 },
  { cx: '78%', cy: '20%', r: 6, color: '#EF4444', speed: 3.5 },
  { cx: '28%', cy: '78%', r: 10, color: '#F59E0B', speed: 5 },
  { cx: '76%', cy: '74%', r: 7, color: '#8B5CF6', speed: 3 },
  { cx: '60%', cy: '35%', r: 5, color: '#06B6D4', speed: 4.5 },
]

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useVaultSim() {
  const [integrity, setIntegrity] = useState(100)
  const [blockCount, setBlockCount] = useState(1204)
  const [latency, setLatency] = useState(11)

  useEffect(() => {
    const iv = setInterval(() => {
      setIntegrity(prev => Math.max(98, Math.min(100, prev + (Math.random() > 0.5 ? 0 : -0.2))))
      setBlockCount(prev => prev + Math.floor(Math.random() * 2))
      setLatency(Math.floor(Math.random() * 20) + 8)
    }, 2000)
    return () => clearInterval(iv)
  }, [])

  return { integrity, blockCount, latency }
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function AmbientBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--sys-bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--sys-grid) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <motion.div animate={{ x: [0, -50, 0], y: [0, 40, 0] }} transition={{ repeat: Infinity, duration: 20, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-15%', right: '-10%', width: '55%', height: '55%', background: 'radial-gradient(circle, var(--sys-orb-b) 0%, transparent 65%)', filter: 'blur(90px)' }} />
      <motion.div animate={{ x: [0, 40, 0], y: [0, -30, 0] }} transition={{ repeat: Infinity, duration: 26, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, var(--sys-orb-a) 0%, transparent 65%)', filter: 'blur(90px)' }} />
      <motion.div animate={{ y: ['-2%', '102%'] }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
        style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.2) 40%, rgba(16,185,129,0.2) 60%, transparent 100%)' }} />
    </div>
  )
}

function LiveFeed({ feed }) {
  return (
    <div style={{ background: 'var(--sys-terminal)', border: '1px solid var(--sys-term-border)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--sys-term-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>LIVE ACTIVITY FEED</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        <AnimatePresence initial={false}>
          {feed.map(item => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -14, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ padding: '5px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: 'var(--text-muted)' }}>{item.ts}</span>
              <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: `rgba(16,185,129,${item.age < 3 ? 1 : 0.5})` }}>{item.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TopologyGraph() {
  return (
    <div style={{ background: 'var(--sys-panel)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 20, overflow: 'hidden', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>TOPOLOGY MAP</span>
        <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px #3B82F6' }} />
      </div>
      <div style={{ position: 'relative', height: 180 }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* Pulsing connection lines */}
          {NODE_POSITIONS.slice(1).map((n, i) => (
            <motion.line key={i}
              animate={{ strokeOpacity: [0.1, 0.5, 0.1] }}
              transition={{ repeat: Infinity, duration: n.speed, ease: 'easeInOut' }}
              x1="50%" y1="50%" x2={n.cx} y2={n.cy}
              stroke={n.color} strokeWidth="1.5"
            />
          ))}
          {/* Data packets traveling along lines */}
          {NODE_POSITIONS.slice(1).map((n, i) => (
            <motion.circle key={`pkt-${i}`} r="3" fill={n.color}
              style={{ filter: `drop-shadow(0 0 4px ${n.color})` }}
              animate={{ offsetDistance: ['0%', '100%', '0%'] }}
              transition={{ repeat: Infinity, duration: n.speed + 1, delay: i * 0.5 }}>
              <animateMotion repeatCount="indefinite" dur={`${n.speed}s`} path={`M 50% 50% L ${n.cx} ${n.cy}`} />
            </motion.circle>
          ))}
        </svg>
        {/* Central node */}
        <motion.div animate={{ boxShadow: ['0 0 0px #3B82F6', '0 0 28px #3B82F6', '0 0 0px #3B82F6'], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', zIndex: 2 }} />
        {/* Satellite nodes */}
        {NODE_POSITIONS.slice(1).map((n, i) => (
          <motion.div key={i}
            animate={{ y: [-(i % 2 === 0 ? 4 : -4), (i % 2 === 0 ? 4 : -4)], x: [-(i % 3 === 0 ? 3 : -3), (i % 3 === 0 ? 3 : -3)] }}
            transition={{ repeat: Infinity, duration: n.speed, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: n.cy, left: n.cx, transform: 'translate(-50%,-50%)', width: n.r * 2, height: n.r * 2, borderRadius: '50%', background: n.color, boxShadow: `0 0 10px ${n.color}`, zIndex: 2 }} />
        ))}
      </div>
      <p style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.2)', margin: 0 }}>NETWORK ALIVE · 6 NODES</p>
    </div>
  )
}

function IntegrityMeter({ value, blockCount, latency }) {
  return (
    <div style={{ padding: 20, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>VAULT INTEGRITY</span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#10B981' }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 3, background: 'var(--border-strong)', borderRadius: 4, marginBottom: 16 }}>
        <motion.div animate={{ width: `${value}%` }} transition={{ duration: 1 }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#3B82F6,#10B981)', borderRadius: 4, boxShadow: '0 0 6px #10B981' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[{ label: 'CONSENSUS', val: `#${blockCount}` }, { label: 'LATENCY', val: `${latency}ms` }].map(x => (
          <div key={x.label} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', display: 'block' }}>{x.label}</span>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, color: 'var(--text-secondary)' }}>{x.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CredentialVault() {
  const { t } = useI18n()
  const token = localStorage.getItem('phantom-token')
  const [creds, setCreds] = useState([])
  const feedIdRef = useRef(100)
  const sim = useVaultSim()

  // Use real creds from API, fall back to mock for timeline
  useEffect(() => {
    if (!token) return
    fetch(`${API}/credentials`, { headers: { 'X-User-Token': token } })
      .then(r => r.json())
      .then(d => setCreds(d.credentials || []))
      .catch(() => { })
  }, [token])

  // Timeline = real creds OR mock placeholders (never empty)
  const timeline = creds.length > 0 ? creds : MOCK_TIMELINE

  // Live feed
  const [feed, setFeed] = useState(() =>
    FEED_POOL.slice(0, 6).map((text, i) => ({ id: i, text, ts: new Date(Date.now() - (6 - i) * 45000).toLocaleTimeString('en-US', { hour12: false }), age: 6 - i }))
  )

  useEffect(() => {
    const iv = setInterval(() => {
      setFeed(prev => {
        const text = FEED_POOL[Math.floor(Math.random() * FEED_POOL.length)]
        const newItem = { id: feedIdRef.current++, text, ts: new Date().toLocaleTimeString('en-US', { hour12: false }), age: 0 }
        return [newItem, ...prev.map(f => ({ ...f, age: f.age + 1 }))].slice(0, 10)
      })
    }, 3500)
    return () => clearInterval(iv)
  }, [])

  const downloadPDF = (cred) => {
    const doc = new jsPDF()
    const pr = cred.proof_result || {}
    const ta = cred.threat_assessment || {}
    doc.setFont('courier', 'bold'); doc.setFontSize(16)
    doc.text('PhantomID — Threat Evidence Certificate', 14, 20)
    doc.setFont('courier', 'normal'); doc.setFontSize(10)
    doc.text(`Risk Level:  ${cred.risk_level}`, 14, 36)
    doc.text(`Detected:    ${new Date(cred.detected_at).toLocaleString()}`, 14, 44)
    doc.text(`Summary:     ${ta.threat_summary || 'N/A'}`, 14, 52)
    doc.text(`IPFS CID:    ${pr.ipfs_cid || 'N/A'}`, 14, 60)
    doc.text(`Solana Tx:   ${pr.solana_tx_sig || 'N/A'}`, 14, 68)
    doc.save(`phantomid-certificate-${Date.now()}.pdf`)
  }

  const secured = creds.length === 0
  const statusColor = secured ? '#10B981' : '#EF4444'

  return (
    <>
      <AmbientBg />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 10 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              {[0, 1].map(i => (
                <motion.div key={i} animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3, delay: i * 1.5 }}
                  style={{ position: 'absolute', inset: -6, borderRadius: '50%', background: `${statusColor}30` }} />
              ))}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `linear-gradient(135deg,${statusColor},${secured ? '#059669' : '#B91C1C'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 0 32px ${statusColor}80` }}>🛡</div>
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>Secure Intelligence Vault</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: `0 0 12px ${statusColor}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: statusColor }}>
                  STATUS: {secured ? 'SECURED · ACTIVE' : 'BREACH DETECTED'}
                </span>
              </div>
            </div>
          </div>
          {/* Real-time clock */}
          <Clock />
        </div>

        {/* ── Metrics Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Records', val: timeline.length, color: '#3B82F6' },
            { label: 'Security Level', val: secured ? 'MAXIMUM' : 'CRITICAL', color: statusColor },
            { label: 'Blockchain', val: 'SYNCED', color: '#10B981' },
            { label: 'Consensus Block', val: `#${sim.blockCount}`, color: '#8B5CF6' },
          ].map((m, i) => (
            <motion.div key={i} whileHover={{ y: -3, boxShadow: 'var(--shadow-premium)' }}
              style={{ padding: '16px 20px', background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 14, backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{m.label}</span>
              <p style={{ fontFamily: 'Outfit,sans-serif', fontSize: 20, fontWeight: 700, color: m.color, margin: 0 }}>{m.val}</p>
            </motion.div>
          ))}
        </div>

        {/* ── 3-column main ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 20 }}>

          {/* LEFT: Live Feed */}
          <LiveFeed feed={feed} />

          {/* CENTER: Timeline — always has content */}
          <div style={{ background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 20, padding: '24px 28px', backdropFilter: 'blur(16px)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, position: 'relative', zIndex: 1 }}>
              <span style={{ width: 4, height: 18, background: '#3B82F6', borderRadius: 2 }} />
              <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>Event Timeline</h2>
              {!secured && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: '0.1em' }}>● BREACH LOG</span>}
            </div>

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Vertical spine */}
              <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, #3B82F6 0%, rgba(59,130,246,0.05) 100%)' }} />

              {timeline.map((ev, i) => (
                <motion.div key={ev.id || i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
                  style={{ position: 'relative', paddingLeft: 30, marginBottom: 24 }}>
                  {/* Pulsing dot */}
                  <motion.div animate={{ boxShadow: ['0 0 0px #3B82F6', '0 0 14px rgba(59,130,246,0.6)', '0 0 0px #3B82F6'] }} transition={{ repeat: Infinity, duration: 2, delay: i * 0.6 }}
                    style={{ position: 'absolute', left: 4, top: 6, width: 14, height: 14, borderRadius: '50%', background: '#020810', border: '3px solid #3B82F6' }} />

                  <motion.div whileHover={{ x: 4 }}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(ev.detected_at).toLocaleString()}</span>
                      <ThreatBadge level={ev.risk_level} />
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>{ev.threat_assessment?.threat_summary}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => downloadPDF(ev)} style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', background: 'var(--bg-soft)', color: 'var(--text-secondary)', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)' }}>↓ PDF</button>
                      {ev.proof_result?.solana_tx_sig && ev.proof_result.solana_tx_sig !== 'sim_tx_abc123' && (
                        <a href={`https://explorer.solana.com/tx/${ev.proof_result.solana_tx_sig}?cluster=devnet`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', background: 'rgba(124,58,237,0.1)', color: '#8B5CF6', borderRadius: 6, textDecoration: 'none', border: '1px solid rgba(124,58,237,0.2)' }}>↗ Solana</a>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT: Graph + Integrity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TopologyGraph />
            <IntegrityMeter value={sim.integrity} blockCount={sim.blockCount} latency={sim.latency} />
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Clock ───────────────────────────────────────────────────────────────────
function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 22, fontWeight: 600, color: '#1E3A5F', margin: 0 }}>{time.toLocaleTimeString('en-US', { hour12: false })}</p>
      <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: '#0F2035', margin: 0 }}>{time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    </div>
  )
}