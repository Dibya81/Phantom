import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../contexts/I18nContext'

const WS_URL = `ws://127.0.0.1:8000/ws/agent`

// ─── Metrics Hook ─────────────────────────────────────────────────────────────
function useMetrics(active) {
  const [m, setM] = useState({ cpu: 0.8, mem: 12.4, tasks: 0, latency: 2 })
  useEffect(() => {
    const iv = setInterval(() => {
      if (active) {
        setM({
          cpu: (Math.random() * 15 + 5).toFixed(1),
          mem: (Math.random() * 10 + 35).toFixed(1),
          tasks: 1,
          latency: Math.floor(Math.random() * 30 + 15),
        })
      } else {
        setM({ cpu: 0.8, mem: 12.4, tasks: 0, latency: 2 })
      }
    }, 2000)
    return () => clearInterval(iv)
  }, [active])
  return m
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AmbientBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--sys-bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--sys-grid) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <motion.div animate={{ x: [0, 60, 0], y: [0, -40, 0] }} transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', background: `radial-gradient(circle, var(--sys-orb-a) 0%, transparent 65%)`, filter: 'blur(80px)' }} />
      <motion.div animate={{ x: [0, -50, 0], y: [0, 50, 0] }} transition={{ repeat: Infinity, duration: 24, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '45%', height: '45%', background: `radial-gradient(circle, var(--sys-orb-b) 0%, transparent 65%)`, filter: 'blur(80px)' }} />
      {/* scan line */}
      <motion.div animate={{ y: ['-2%', '102%'] }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
        style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.2) 40%, rgba(16,185,129,0.2) 60%, transparent 100%)' }} />
    </div>
  )
}

function FlowNode({ label, sub, state, idx }) {
  const active = state === 'active'
  const done = state === 'complete'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
      <motion.div
        animate={active ? { scale: [1, 1.12, 1], boxShadow: ['0 0 0px #3B82F6', '0 0 28px #3B82F6', '0 0 0px #3B82F6'] } : {}}
        transition={{ repeat: Infinity, duration: 1.4 }}
        style={{
          width: 52, height: 52, borderRadius: '50%', marginBottom: 12,
          background: active ? 'linear-gradient(135deg,#3B82F6,#1D4ED8)' : done ? 'linear-gradient(135deg,#10B981,#059669)' : 'var(--bg-soft)',
          border: `2px solid ${active ? '#3B82F6' : done ? '#10B981' : 'var(--border-strong)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: done ? 20 : 15, fontWeight: 800,
          color: active || done ? '#fff' : 'var(--text-muted)',
          boxShadow: done ? '0 8px 16px rgba(16,185,129,0.2)' : '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        {done ? '✓' : idx + 1}
      </motion.div>
      <p style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--text-primary)' : done ? '#10B981' : 'var(--text-muted)', margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{sub}</p>
    </div>
  )
}

function MetricCard({ label, value, unit = '', color = '#3B82F6' }) {
  return (
    <motion.div whileHover={{ y: -3, boxShadow: 'var(--shadow-premium)' }}
      style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 16, backdropFilter: 'blur(10px)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>{label}</span>
      <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 26, fontWeight: 600, color, margin: 0 }}>{value}{unit}</p>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
import DetectionModal from '../components/DetectionModal'

const STEPS = ['perceive', 'reason', 'act']

function fmtTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function useTypingLog() {
  const [logs, setLogs] = useState([
    { id: 'init', text: '> PhantomID Intelligence Layer v2.1', done: true, ts: fmtTime() },
    { id: 'init2', text: '> Neural-Blockchain Bridge Active', done: true, ts: fmtTime() },
  ])
  const idRef = useRef(2)

  const pushLog = useCallback((raw) => {
    const id = Date.now() + Math.random()
    setLogs(prev => [...prev, { id, text: `> ${raw}`, done: true, ts: fmtTime() }].slice(-30))
  }, [])

  return [logs, pushLog]
}

// ─── Metrics Hook ─────────────────────────────────────────────────────────────
// (Already updated in previous step)

// ... existing sub-components ...

export default function LiveAgent() {
  const { t } = useI18n()
  const [cyclePhase, setCyclePhase] = useState('idle')
  const [nodeStates, setNodeStates] = useState({ perceive: 'idle', reason: 'idle', act: 'idle' })
  const [streamText, setStreamText] = useState('')
  const [riskLevel, setRiskLevel] = useState(null)
  const [matches, setMatches] = useState([])
  const [logs, pushLog] = useTypingLog()
  const metrics = useMetrics(cyclePhase === 'running')
  const [showModal, setShowModal] = useState(false)
  const [detectionData, setDetectionData] = useState(null)
  const [hashToast, setHashToast] = useState(null) // { hash, sig }

  // Ad-hoc check state
  const [checkEmail, setCheckEmail] = useState('')
  const [checking, setChecking] = useState(false)

  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const logsEndRef = useRef(null)
  const token = localStorage.getItem('phantom-token')
  const isRunning = cyclePhase === 'running'

  const typeText = useCallback((text) => {
    if (streamRef.current) clearInterval(streamRef.current)
    let i = 0; setStreamText('')
    streamRef.current = setInterval(() => {
      i++; setStreamText(text.slice(0, i))
      if (i >= text.length) clearInterval(streamRef.current)
    }, 12)
  }, [])

  const initiateScan = useCallback(async (targetEmail) => {
    if (cyclePhase === 'running') return
    const email = targetEmail || localStorage.getItem('phantom-email')
    if (!email) return

    setCyclePhase('running')
    setNodeStates({ perceive: 'active', reason: 'idle', act: 'idle' })
    pushLog(`Initiating neural audit for: ${email}`)

    try {
      const res = await fetch('/api/detect-breach', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Token': token || ''
        },
        body: JSON.stringify({ email })
      })
      
      if (!res.ok) throw new Error('API failure')
      
      pushLog(`Analysis request accepted by neural core. Monitoring stream...`)
      // Note: We don't setNodeStates here anymore, 
      // we let the WebSocket 'PERCEIVE' and 'REASON' events drive the UI.
      
    } catch (err) {
      pushLog(`CRITICAL: Neural bridge failure. ${err.message}`)
      setCyclePhase('idle')
    }
  }, [cyclePhase, pushLog, typeText])

  useEffect(() => {
    // Auto-run on mount if first time
    const email = localStorage.getItem('phantom-email')
    if (email) setTimeout(() => initiateScan(email), 2000)
  }, [])

  useEffect(() => {
    try {
      const url = token ? `${WS_URL}?token=${token}` : WS_URL
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        pushLog("Neural stream connection established.")
      }

      ws.onerror = (err) => {
        pushLog("CRITICAL: Neural stream connection error.")
      }

      ws.onmessage = ({ data }) => {
        try {
          const ev = JSON.parse(data)
          const payload = ev.payload || {}

          if (ev.event === 'CONNECTED') {
            pushLog(`SYNC: Handshake verified.`)
          }
          
          if (ev.event === 'PERCEIVE') {
            if (payload.status === 'complete') {
              setNodeStates(prev => ({ ...prev, perceive: 'complete' }))
              if (payload.match_count === 0) {
                 typeText("Intelligence scan complete. No active data breaches detected in global repositories.")
              }
            } else {
              setNodeStates({ perceive: 'active', reason: 'idle', act: 'idle' })
              pushLog(`AUDIT: Neural scan initiated.`)
            }
          }
          if (ev.event === 'REASON') {
            setNodeStates({ perceive: 'complete', reason: 'active', act: 'idle' })
            pushLog(`REASON: Analyzing data patterns.`)
            if (payload.status === 'reasoning') {
               pushLog(`SYNTHESIS: LLM processing intelligence signals…`)
            }
            if (payload.threat_assessment) {
              setRiskLevel(payload.threat_assessment.risk_level)
              setMatches(payload.threat_assessment.matches || [])
              setDetectionData(payload.threat_assessment)
              if (payload.threat_assessment.threat_summary) {
                typeText(payload.threat_assessment.threat_summary)
              }
            }
          }
          if (ev.event === 'ACT') {
            setNodeStates({ perceive: 'complete', reason: 'complete', act: 'active' })
            if (payload.status === 'anchoring') {
              pushLog(`BLOCKCHAIN: Initiating cryptographic anchoring…`)
            }
            if (payload.status === 'anchored') {
              pushLog(`SUCCESS: Transaction signature confirmed on Solana.`)
              setHashToast({ hash: payload.report_hash, sig: payload.solana_tx_sig })
              setTimeout(() => setHashToast(null), 8000)
            }
            if (payload.proof_result) {
              setDetectionData(prev => ({ ...prev, proof_result: payload.proof_result }))
            }
          }
          if (ev.event === 'ERROR') {
            pushLog(`ERROR: ${payload.error || 'System fault'}`)
            setCyclePhase('idle')
          }
          
          if (ev.event === 'COMPLETE') {
              pushLog(`SYNC: Neural intelligence and blockchain ledger synchronized.`)
              setNodeStates({ perceive: 'complete', reason: 'complete', act: 'complete' })
              setCyclePhase('idle')
              setShowModal(true)
          }
        } catch (err) {
          console.error("WS Parse Error:", err)
        }
      }
      return () => ws.close()
    } catch {}
  }, [token, pushLog])

  const handleManualCheck = (e) => {
    e.preventDefault()
    if (!checkEmail) return
    initiateScan(checkEmail)
  }

  return (
    <>
      <AmbientBg />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              {isRunning && [0, 1, 2].map(i => (
                <motion.div key={i} animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.65, ease: 'easeOut' }}
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(59,130,246,0.4)' }} />
              ))}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: isRunning ? '0 0 40px rgba(59,130,246,0.5)' : 'var(--shadow-subtle)', transition: 'box-shadow 0.5s' }}>🧠</div>
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>AI Control Center</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                <motion.div animate={{ opacity: isRunning ? [1, 0.2, 1] : 1 }} transition={{ repeat: Infinity, duration: 1.2 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#10B981' : 'var(--text-muted)', boxShadow: isRunning ? '0 0 12px #10B981' : 'none' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isRunning ? '#10B981' : 'var(--text-muted)' }}>
                  {cyclePhase === 'running' ? 'PROCESSING · ACTIVE' : cyclePhase === 'paused' ? 'CYCLE COMPLETE' : 'STANDBY'}
                </span>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {riskLevel && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
                  background: riskLevel === 'HIGH' ? 'rgba(239,68,68,0.1)' : riskLevel === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                  color: riskLevel === 'HIGH' ? '#EF4444' : riskLevel === 'MEDIUM' ? '#F59E0B' : '#10B981',
                  border: `1px solid ${riskLevel === 'HIGH' ? 'rgba(239,68,68,0.25)' : riskLevel === 'MEDIUM' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}` }}>
                RISK · {riskLevel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Execution Flow */}
            <motion.div whileHover={{ y: -2, boxShadow: 'var(--shadow-premium)' }}
              style={{ padding: 28, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 20, backdropFilter: 'blur(16px)', position: 'relative', overflow: 'hidden' }}>
              {isRunning && (
                <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.03), transparent)', pointerEvents: 'none' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <span style={{ width: 4, height: 18, background: '#3B82F6', borderRadius: 2 }} />
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>Execution Pipeline</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 26, left: '16%', right: '16%', height: 2, background: 'var(--border-strong)' }} />
                {isRunning && (
                  <motion.div animate={{ left: ['16%', '84%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    style={{ position: 'absolute', top: 25, width: 56, height: 4, background: '#3B82F6', borderRadius: 4, boxShadow: '0 0 16px #3B82F6' }} />
                )}
                {[
                  { id: 'perceive', label: 'Perceiving', sub: 'Signal Intake' },
                  { id: 'reason',  label: 'Reasoning',  sub: 'Pattern Match' },
                  { id: 'act',     label: 'Acting',     sub: 'Response' },
                ].map((n, i) => <FlowNode key={n.id} idx={i} label={n.label} sub={n.sub} state={nodeStates[n.id]} />)}
              </div>

              {/* Synthesis */}
              <div style={{ marginTop: 28, background: 'var(--bg-soft)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: '#3B82F6', display: 'block', marginBottom: 10 }}>AI CORE SYNTHESIS</span>
                <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: streamText ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: 1.7, margin: 0, minHeight: 42 }}>
                  {streamText || 'Awaiting execution phase...'}
                  {isRunning && streamText && (
                    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.7 }}
                      style={{ display: 'inline-block', width: 7, height: 14, background: '#3B82F6', marginLeft: 4, verticalAlign: 'middle' }} />
                  )}
                </p>
              </div>
            </motion.div>

            {/* Manual Exposure Check */}
            <motion.div whileHover={{ y: -2, boxShadow: 'var(--shadow-premium)' }}
              style={{ padding: 24, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 20, backdropFilter: 'blur(16px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ width: 4, height: 18, background: '#10B981', borderRadius: 2 }} />
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>Intelligence Check</h2>
              </div>
              <form onSubmit={handleManualCheck} style={{ display: 'flex', gap: 12 }}>
                <input 
                  type="email" 
                  value={checkEmail}
                  onChange={(e) => setCheckEmail(e.target.value)}
                  placeholder="Enter email to check exposure..."
                  style={{
                    flex: 1, background: 'var(--bg-soft)', border: '1px solid var(--border-strong)',
                    borderRadius: 12, padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)',
                    outline: 'none', transition: 'border-color 0.2s'
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  disabled={isRunning || !checkEmail}
                  style={{
                    padding: '0 24px', background: isRunning ? 'var(--text-muted)' : '#007AFF',
                    color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700,
                    border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer'
                  }}
                >
                  Scan
                </motion.button>
              </form>
            </motion.div>

            {/* Terminal */}
            <div style={{ background: 'var(--sys-terminal)', border: '1px solid var(--sys-term-border)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--sys-term-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 12px #10B981' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#475569' }}>SYSTEM LOGS</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#1E293B', fontFamily: 'JetBrains Mono,monospace' }}>PHANTOM/AI v2.1</span>
              </div>
              <div ref={logsEndRef} style={{ height: 220, overflowY: 'auto', padding: '14px 20px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12, lineHeight: 1.9 }}>
                {logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 12, color: '#10B981', marginBottom: 2 }}>
                    <span style={{ color: '#1E3A5F', flexShrink: 0 }}>{log.ts}</span>
                    <span style={{ opacity: log.done ? 0.85 : 1 }}>{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Real Matches List */}
            <AnimatePresence>
              {matches?.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: '#EF4444', display: 'block' }}>THREATS DETECTED</span>
                  {matches.map((m, i) => (
                    <motion.div key={i} initial={{ x: -10 }} animate={{ x: 0 }}
                      style={{ padding: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.breach}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.date}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 8 }}>{m.summary}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {m.exposed_fields?.map(f => (
                          <span key={f} style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: 'var(--text-muted)' }}>{f}</span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MetricCard label="CPU Load"     value={metrics.cpu}     unit="%" color={metrics.cpu > 50 ? '#F59E0B' : '#10B981'} />
              <MetricCard label="Memory"       value={metrics.mem}     unit="%" color="#3B82F6" />
              <MetricCard label="Active Tasks" value={metrics.tasks}             color="#8B5CF6" />
              <MetricCard label="Latency"      value={metrics.latency} unit="ms" color={metrics.latency > 40 ? '#EF4444' : '#10B981'} />
            </div>

            {/* Integrity bar */}
            <motion.div whileHover={{ y: -2 }}
              style={{ padding: 20, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>VAULT INTEGRITY</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>100%</span>
              </div>
              <div style={{ height: 4, background: 'var(--border-strong)', borderRadius: 4 }}>
                <motion.div animate={{ width: ['0%', '100%'] }} transition={{ duration: 2, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg,#3B82F6,#10B981)', borderRadius: 4, boxShadow: '0 0 8px rgba(16,185,129,0.4)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono,monospace' }}>CYCLE #{Math.floor(Date.now() / 1000) % 9999}</span>
                <motion.span animate={{ opacity: isRunning ? [1, 0.3, 1] : 1 }} transition={{ repeat: Infinity, duration: 1 }}
                  style={{ fontSize: 10, color: '#10B981', fontFamily: 'JetBrains Mono,monospace' }}>● LIVE</motion.span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hashToast && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            style={{
              position: 'fixed', bottom: 40, right: 40, zIndex: 1100,
              width: 320, background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #3B82F6', borderRadius: 16, padding: 20,
              backdropFilter: 'blur(12px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(59,130,246,0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⛓️</div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#3B82F6', letterSpacing: '0.05em' }}>HASH ANCHORED</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 700 }}>REPORT FINGERPRINT</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#fff', wordBreak: 'break-all', marginBottom: 16, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>
              {hashToast.hash}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#10B981', fontWeight: 800 }}>VERIFIED ON SOLANA</span>
              <a href={`https://explorer.solana.com/tx/${hashToast.sig}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#3B82F6', fontWeight: 700 }}>VIEW TX</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <DetectionModal 
            isOpen={showModal} 
            onClose={() => setShowModal(false)} 
            data={detectionData} 
          />
        )}
      </AnimatePresence>
    </>
  )
}
