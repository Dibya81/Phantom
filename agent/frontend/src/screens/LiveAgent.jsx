import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../contexts/I18nContext'
import DetectionModal from '../components/DetectionModal'

const WS_URL = `wss://phantom-mlxh.onrender.com/ws/agent`

function AmbientBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--sys-bg)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--sys-grid) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <motion.div animate={{ x: [0, 60, 0], y: [0, -40, 0] }} transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', background: `radial-gradient(circle, var(--sys-orb-a) 0%, transparent 65%)`, filter: 'blur(80px)' }} />
      <motion.div animate={{ x: [0, -50, 0], y: [0, 50, 0] }} transition={{ repeat: Infinity, duration: 24, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '45%', height: '45%', background: `radial-gradient(circle, var(--sys-orb-b) 0%, transparent 65%)`, filter: 'blur(80px)' }} />
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

export default function LiveAgent() {
  const { t } = useI18n()
  const fmtTime = useCallback(() => {
    return new Date().toLocaleTimeString('en-US', { hour12: false })
  }, [])

  const [logs, setLogs] = useState([
    { id: 'init', text: t.agent.logInit1, done: true, ts: fmtTime() },
    { id: 'init2', text: t.agent.logInit2, done: true, ts: fmtTime() },
  ])
  
  const pushLog = useCallback((raw) => {
    setLogs(prev => [...prev, { id: Date.now() + Math.random(), text: `> ${raw}`, done: true, ts: fmtTime() }].slice(-30))
  }, [fmtTime])

  const [cyclePhase, setCyclePhase] = useState('idle')
  const [nodeStates, setNodeStates] = useState({ perceive: 'idle', reason: 'idle', act: 'idle' })
  const [streamText, setStreamText] = useState('')
  const [riskLevel, setRiskLevel] = useState(null)
  const [matches, setMatches] = useState([])
  const [metrics, setMetrics] = useState({ cpu: 0.8, mem: 12.4, tasks: 0, latency: 2 })
  const [showModal, setShowModal] = useState(false)
  const [detectionData, setDetectionData] = useState(null)
  const [hashToast, setHashToast] = useState(null)
  const [checkEmail, setCheckEmail] = useState('')

  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const logsEndRef = useRef(null)
  const token = localStorage.getItem('phantom-token')
  const isRunning = cyclePhase === 'running'

  useEffect(() => {
    const iv = setInterval(() => {
      if (isRunning) {
        setMetrics({
          cpu: (Math.random() * 15 + 5).toFixed(1),
          mem: (Math.random() * 10 + 35).toFixed(1),
          tasks: 1,
          latency: Math.floor(Math.random() * 30 + 15),
        })
      }
    }, 2000)
    return () => clearInterval(iv)
  }, [isRunning])

  useEffect(() => {
    if (logsEndRef.current) {
        logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight
    }
  }, [logs])

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
    pushLog(`${t.agent.logs.initAudit}: ${email}`)

    try {
      const res = await fetch('/api/detect-breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Token': token || '' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) throw new Error('API failure')
      pushLog(t.agent.logs.reqAccepted)
    } catch (err) {
      pushLog(`${t.agent.logs.criticalFail}: ${err.message}`)
      setCyclePhase('idle')
    }
  }, [cyclePhase, pushLog, token, t])

  useEffect(() => {
    const email = localStorage.getItem('phantom-email')
    if (email) setTimeout(() => initiateScan(email), 2000)
  }, [])

  useEffect(() => {
    try {
      const url = token ? `${WS_URL}?token=${token}` : WS_URL
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onopen = () => pushLog(t.agent.logs.wsOpen)
      ws.onerror = () => pushLog(t.agent.logs.wsError)
      ws.onmessage = ({ data }) => {
        try {
          const ev = JSON.parse(data)
          const payload = ev.payload || {}
          if (ev.event === 'CONNECTED') pushLog(t.agent.logs.handshake)
          if (ev.event === 'PERCEIVE') {
            if (payload.status === 'complete') {
              setNodeStates(prev => ({ ...prev, perceive: 'complete' }))
              if (payload.match_count === 0) typeText(t.modal.secureSub)
            } else {
              setNodeStates({ perceive: 'active', reason: 'idle', act: 'idle' })
              pushLog(t.agent.logs.auditStarted)
            }
          }
          if (ev.event === 'REASON') {
            setNodeStates({ perceive: 'complete', reason: 'active', act: 'idle' })
            pushLog(t.agent.logs.reasoning)
            if (payload.threat_assessment) {
              setRiskLevel(payload.threat_assessment.risk_level)
              setMatches(payload.threat_assessment.matches || [])
              setDetectionData(payload.threat_assessment)
              if (payload.threat_assessment.threat_summary) typeText(payload.threat_assessment.threat_summary)
            }
          }
          if (ev.event === 'ACT') {
            setNodeStates({ perceive: 'complete', reason: 'complete', act: 'active' })
            if (payload.status === 'anchoring') pushLog(t.agent.logs.anchoring)
            if (payload.status === 'anchored') {
              pushLog(t.agent.logs.anchored)
              setHashToast({ hash: payload.report_hash, sig: payload.solana_tx_sig })
              setTimeout(() => setHashToast(null), 8000)
            }
            if (payload.proof_result) setDetectionData(prev => ({ ...prev, proof_result: payload.proof_result }))
          }
          if (ev.event === 'ERROR') {
            pushLog(`${t.agent.logs.error}: ${payload.error || t.agent.logs.fault}`)
            setCyclePhase('idle')
          }
          if (ev.event === 'COMPLETE') {
              pushLog(t.agent.logs.complete)
              setNodeStates({ perceive: 'complete', reason: 'complete', act: 'complete' })
              setCyclePhase('idle')
              setShowModal(true)
          }
        } catch (err) {}
      }
      return () => ws.close()
    } catch {}
  }, [token, pushLog, t, typeText])

  return (
    <>
      <AmbientBg />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              {isRunning && [0, 1, 2].map(i => (
                <motion.div key={i} animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.65, ease: 'easeOut' }}
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(59,130,246,0.4)' }} />
              ))}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧠</div>
            </div>
            <div>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.04em', color: 'var(--text-primary)', margin: 0 }}>{t.agent.headline}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                <motion.div animate={{ opacity: isRunning ? [1, 0.2, 1] : 1 }} transition={{ repeat: Infinity, duration: 1.2 }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#10B981' : 'var(--text-muted)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: isRunning ? '#10B981' : 'var(--text-muted)' }}>
                  {cyclePhase === 'running' ? t.agent.status.running : cyclePhase === 'complete' ? t.agent.status.complete : t.agent.status.idle}
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
                {t.agent.riskLabel.toUpperCase()} · {t.risk[riskLevel]}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <motion.div style={{ padding: 28, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 20, backdropFilter: 'blur(16px)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <span style={{ width: 4, height: 18, background: '#3B82F6', borderRadius: 2 }} />
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>{t.agent.pipelineLabel}</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 26, left: '16%', right: '16%', height: 2, background: 'var(--border-strong)' }} />
                {isRunning && <motion.div animate={{ left: ['16%', '84%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }} style={{ position: 'absolute', top: 25, width: 56, height: 4, background: '#3B82F6', borderRadius: 4 }} />}
                {[
                  { id: 'perceive', label: t.nodes.perceive.label, sub: t.nodes.perceive.sub },
                  { id: 'reason',  label: t.nodes.reason.label,  sub: t.nodes.reason.sub },
                  { id: 'act',     label: t.nodes.act.label,     sub: t.nodes.act.sub },
                ].map((n, i) => <FlowNode key={n.id} idx={i} label={n.label} sub={n.sub} state={nodeStates[n.id]} />)}
              </div>
              <div style={{ marginTop: 28, background: 'var(--bg-soft)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: '#3B82F6', display: 'block', marginBottom: 10 }}>{t.agent.synthesisLabel}</span>
                <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 13, color: streamText ? 'var(--text-secondary)' : 'var(--text-muted)', lineHeight: 1.7, margin: 0, minHeight: 42 }}>
                  {streamText || t.agent.awaitingExecution}
                </p>
              </div>
            </motion.div>

            <motion.div style={{ padding: 24, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 20, backdropFilter: 'blur(16px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ width: 4, height: 18, background: '#10B981', borderRadius: 2 }} />
                <h2 style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>{t.agent.intelligenceCheck}</h2>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); initiateScan(checkEmail); }} style={{ display: 'flex', gap: 12 }}>
                <input type="email" value={checkEmail} onChange={(e) => setCheckEmail(e.target.value)} placeholder={t.agent.emailPlaceholder} style={{ flex: 1, background: 'var(--bg-soft)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }} />
                <motion.button disabled={isRunning || !checkEmail} style={{ padding: '0 24px', background: isRunning ? 'var(--text-muted)' : '#007AFF', color: '#fff', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer' }}>{t.agent.scanBtn}</motion.button>
              </form>
            </motion.div>

            <div style={{ background: 'var(--sys-terminal)', border: '1px solid var(--sys-term-border)', borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--sys-term-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#475569' }}>{t.agent.systemLogs}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#1E293B', fontFamily: 'JetBrains Mono,monospace' }}>{t.agent.versionLabel}</span>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <AnimatePresence>
              {matches?.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: '#EF4444', display: 'block' }}>{t.agent.threatsDetected}</span>
                  {matches.map((m, i) => (
                    <motion.div key={i} style={{ padding: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.breach}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.date}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{m.summary}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <MetricCard label={t.agent.metrics.cpu} value={metrics.cpu} unit={t.agent.metrics.cpuUnit} color={metrics.cpu > 50 ? '#F59E0B' : '#10B981'} />
              <MetricCard label={t.agent.metrics.mem} value={metrics.mem} unit={t.agent.metrics.memUnit} color="#3B82F6" />
              <MetricCard label={t.agent.metrics.tasks} value={metrics.tasks} color="#8B5CF6" />
              <MetricCard label={t.agent.metrics.latency} value={metrics.latency} unit={t.agent.metrics.latencyUnit} color={metrics.latency > 40 ? '#EF4444' : '#10B981'} />
            </div>
            <motion.div style={{ padding: 20, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: 'var(--text-muted)' }}>{t.agent.vaultIntegrity}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>100{t.agent.metrics.cpuUnit}</span>
              </div>
              <div style={{ height: 4, background: 'var(--border-strong)', borderRadius: 4 }}>
                <motion.div animate={{ width: '100%' }} style={{ height: '100%', background: 'linear-gradient(90deg,#3B82F6,#10B981)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono,monospace' }}>{t.agent.cycleLabel} #{Math.floor(Date.now() / 1000) % 9999}</span>
                <span style={{ fontSize: 10, color: '#10B981', fontFamily: 'JetBrains Mono,monospace' }}>● {t.agent.liveLabel}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hashToast && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', bottom: 40, right: 40, zIndex: 1100, width: 320, background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #3B82F6', borderRadius: 16, padding: 20, backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#3B82F6' }}>{t.agent.toast.anchored}</span>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 700 }}>{t.agent.toast.fingerprint}</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#fff', wordBreak: 'break-all', marginBottom: 16, background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 8 }}>{hashToast.hash}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#10B981', fontWeight: 800 }}>{t.agent.toast.verified}</span>
              <a href={`https://explorer.solana.com/tx/${hashToast.sig}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#3B82F6', fontWeight: 700 }}>{t.agent.toast.view}</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DetectionModal isOpen={showModal} onClose={() => setShowModal(false)} data={detectionData} />
    </>
  )
}
