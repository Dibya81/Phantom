import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DetectionModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null

  const isSafe = data.matches.length === 0
  const riskLevel = data.risk_level || 'LOW'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{
          width: '100%', maxWidth: 500,
          background: isSafe ? '#064E3B' : '#450A0A',
          border: `1px solid ${isSafe ? '#10B981' : '#EF4444'}`,
          borderRadius: 24, padding: 32,
          position: 'relative', overflow: 'hidden',
          boxShadow: `0 0 80px ${isSafe ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
        }}
      >
        {/* Animated background glow */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 4 }}
          style={{
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: `radial-gradient(circle, ${isSafe ? '#10B981' : '#EF4444'} 0%, transparent 60%)`,
            zIndex: 0, pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ 
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
            background: isSafe ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, border: `1px solid ${isSafe ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`
          }}>
            {isSafe ? '🛡️' : '🚨'}
          </div>

          <h2 style={{ 
            fontFamily: 'Outfit, sans-serif', fontSize: 32, fontWeight: 800, 
            color: '#fff', marginBottom: 12, letterSpacing: '-0.04em' 
          }}>
            {isSafe ? 'Neural Audit: SECURE' : 'CRITICAL EXPOSURE'}
          </h2>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 32 }}>
            {isSafe 
              ? 'Neural audit complete. Your identity demonstrates maximum integrity across all scanned intelligence vectors. No unauthorized exposures detected.' 
              : `Unauthorized exposure identified. Our intelligence matrix has localized ${data.matches.length} breach signatures linked to your identity profile. Immediate review required.`}
          </p>

          {!isSafe && (
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 20, marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em' }}>THREAT LEVEL</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#EF4444' }}>{riskLevel}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.matches.map((m, i) => (
                  <div key={i} style={{ 
                    fontSize: 11, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                    padding: '4px 10px', borderRadius: 100, color: '#fff'
                  }}>
                    {m.breach}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.proof_result?.report_hash && (
            <div style={{ textAlign: 'left', background: 'rgba(0,0,100,0.2)', border: '1px solid rgba(0,122,255,0.3)', borderRadius: 16, padding: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>ON-CHAIN PROOF HASH</span>
              <p style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#fff', wordBreak: 'break-all', margin: 0 }}>
                {data.proof_result.report_hash}
              </p>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 100,
              background: '#fff', color: '#000', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', border: 'none'
            }}
          >
            {isSafe ? 'Continue to Console' : 'Access Risk Report'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
