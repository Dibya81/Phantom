import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../contexts/I18nContext'

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/agent`

// ─── Simulation Data ──────────────────────────────────────────────────────────
const STEPS = ['perceive', 'reason', 'act']

const SIM_LOGS = {
  perceive: [
    'Binding neural input channels...',
    'Signal scan: 847 endpoints checked.',
    'Entropy delta: +0.0032 detected.',
    'Identity vector extracted from stream.',
    'Threat surface mapped: 12 nodes.',
  ],
  reason: [
    'Cross-referencing identity fingerprint...',
    'Pattern match: 94.7% confidence.',
    'Anomaly cluster found at layer 3.',
    'Risk score computed: 72/100.',
    'Selecting countermeasure protocol...',
  ],
  act: [
    'Dispatching cryptographic proof...',
    'Anchoring record to Solana devnet...',
    'IPFS upload: chunk 1/3 complete.',
    'Seal applied. Evidence immutable.',
    'Response cycle complete. Standby.',
  ],
}

const INSIGHTS = [
  'No anomalies detected. System integrity remains intact.',
  'Monitoring active. No unusual patterns observed.',
  'Cryptographic layers stable. Awaiting vector input.',
  'Surveillance matrix operating at optimal efficiency.',
  'Network topology secure. Zero hostile signatures.',
  'Entropy levels nominal. All nodes synchronized.',
  'Threat surface: minimal. Perimeter holding.',
]

// ─── Hooks ────────────────────────────────────────────────────────────────────
function fmtTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

function useTypingLog() {
  const [logs, setLogs] = useState([
    { id: 0, text: '> System initialized.', done: true, ts: fmtTime() },
    { id: 1, text: '> Awaiting command vector...', done: true, ts: fmtTime() },
  ])
  const idRef = useRef(2)
  const typingRef = useRef(null)

  const pushLog = useCallback((raw) => {
    const id = idRef.current++
    const ts = fmtTime()
    const full = `> ${raw}`
    setLogs(prev => [...prev, { id, text: '', done: false, ts }].slice(-30))
    let i = 0
    clearInterval(typingRef.current)
    typingRef.current = setInterval(() => {
      i++
      setLogs(prev => prev.map(l => l.id === id ? { ...l, text: full.slice(0, i) } : l))
      if (i >= full.length) {
        clearInterval(typingRef.current)
        setLogs(prev => prev.map(l => l.id === id ? { ...l, done: true } : l))
      }
    }, 18)
  }, [])

  useEffect(() => () => clearInterval(typingRef.current), [])
  return [logs, pushLog]
}

function useMetrics(active) {
  const [m, setM] = useState({ cpu: 8, mem: 31, tasks: 0, latency: 4 })
  useEffect(() => {
    const iv = setInterval(() => {
      if (active) {
        setM({
          cpu: Math.floor(Math.random() * 45) + 18,
          mem: Math.floor(Math.random() * 15) + 38,
          tasks: Math.floor(Math.random() * 4) + 1,
          latency: Math.floor(Math.random() * 60) + 8,
        })
      } else {
        setM(p => ({ cpu: Math.max(2, p.cpu - 2), mem: Math.max(28, p.mem - 1), tasks: 0, latency: Math.max(2, p.latency - 1) }))
      }
    }, 1200)
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
export default function LiveAgent() {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [cyclePhase, setCyclePhase] = useState('idle')
  const [nodeStates, setNodeStates] = useState({ perceive: 'idle', reason: 'idle', act: 'idle' })
  const [streamText, setStreamText] = useState('')
  const [insightIdx, setInsightIdx] = useState(0)
  const [riskLevel, setRiskLevel] = useState(null)
  const [logs, pushLog] = useTypingLog()
  const metrics = useMetrics(cyclePhase === 'running')

  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const logsEndRef = useRef(null)
  const cycleRef = useRef(null)
  const token = localStorage.getItem('phantom-token')
  const isRunning = cyclePhase === 'running'

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    const iv = setInterval(() => setInsightIdx(i => (i + 1) % INSIGHTS.length), 5000)
    return () => clearInterval(iv)
  }, [])

  const typeText = useCallback((text) => {
    if (streamRef.current) clearInterval(streamRef.current)
    let i = 0; setStreamText('')
    streamRef.current = setInterval(() => {
      i++; setStreamText(text.slice(0, i))
      if (i >= text.length) clearInterval(streamRef.current)
    }, 14)
  }, [])

  // ── Autonomous simulation loop
  useEffect(() => {
    let stepIdx = 0
    let logIdx = 0

    const advance = () => {
      const stepName = STEPS[stepIdx]
      setNodeStates(prev => ({ ...prev, [stepName]: 'active' }))
      setCyclePhase('running')
      const pool = SIM_LOGS[stepName]
      pushLog(pool[logIdx % pool.length])
      logIdx++
      if (stepName === 'reason') {
        typeText('Cross-referencing identity fingerprint against known threat vectors. Pattern match confidence: 94.7%. Anomaly cluster isolated at layer 3.')
      }
      const dur = stepName === 'reason' ? 4000 : 2500
      cycleRef.current = setTimeout(() => {
        setNodeStates(prev => ({ ...prev, [stepName]: 'complete' }))
        stepIdx = (stepIdx + 1) % 3
        if (stepIdx === 0) {
          setCyclePhase('paused')
          setRiskLevel(['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)])
          cycleRef.current = setTimeout(() => {
            setNodeStates({ perceive: 'idle', reason: 'idle', act: 'idle' })
            setStreamText('')
            setCyclePhase('idle')
            cycleRef.current = setTimeout(advance, 1200)
          }, 2000)
        } else {
          cycleRef.current = setTimeout(advance, 400)
        }
      }, dur)
      setStep(stepIdx)
    }

    cycleRef.current = setTimeout(advance, 800)
    return () => clearTimeout(cycleRef.current)
  }, [pushLog, typeText])

  // ── Real WebSocket overlay
  useEffect(() => {
    try {
      const url = token ? `${WS_URL}?token=${token}` : WS_URL
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onmessage = ({ data }) => {
        try {
          const ev = JSON.parse(data)
          if (ev.event === 'PERCEIVE') pushLog('WS: Perceive event received.')
          if (ev.event === 'REASON' && ev.payload?.threat_summary) typeText(ev.payload.threat_summary)
          if (ev.event === 'COMPLETE') pushLog('WS: Execution cycle complete.')
          if (ev.event === 'ERROR') pushLog(`WS ERROR: ${ev.node || 'unknown'} module failed.`)
        } catch {}
      }
      return () => ws.close()
    } catch {}
  }, [token, pushLog, typeText])

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
                  {cyclePhase === 'running' ? `PROCESSING · ${STEPS[step].toUpperCase()}` : cyclePhase === 'paused' ? 'CYCLE COMPLETE' : 'STANDBY'}
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
                    <span style={{ opacity: log.done ? 0.85 : 1 }}>{log.text}
                      {!log.done && (
                        <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                          style={{ display: 'inline-block', width: 6, height: 12, background: '#10B981', marginLeft: 3, verticalAlign: 'middle' }} />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Dynamic Insight */}
            <motion.div whileHover={{ y: -2, boxShadow: 'var(--shadow-premium)' }}
              style={{ padding: 24, background: 'var(--accent-soft)', border: '1px solid var(--accent-mid)', borderRadius: 16, backdropFilter: 'blur(12px)' }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--accent)', display: 'block', marginBottom: 12 }}>PHANTOM INSIGHT</span>
              <AnimatePresence mode="wait">
                <motion.p key={insightIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ fontFamily: 'Outfit,sans-serif', fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  "{INSIGHTS[insightIdx]}"
                </motion.p>
              </AnimatePresence>
            </motion.div>

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
    </>
  )
}
