import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export default function CredentialVault() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const token = localStorage.getItem('phantom-token')
    if (!token) return

    try {
      const [profRes, credRes] = await Promise.all([
        fetch('/api/profile', { headers: { 'X-User-Token': token } }),
        fetch('/api/credentials', { headers: { 'X-User-Token': token } })
      ])
      
      const profData = await profRes.json()
      const credData = await credRes.json()
      
      setProfile(profData)
      setCredentials(credData.credentials || [])
    } catch (e) {
      console.error('Failed to fetch vault data', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sys-bg)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(0,122,255,0.1)', borderTopColor: '#007AFF' }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sys-bg)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#007AFF', display: 'block', marginBottom: 12 }}>Secured Repository</span>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.04em' }}>Credential Vault</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>VAULT STATUS</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 12px #10B981' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>ENCRYPTED & LIVE</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32 }}>
          
          {/* Left Column - Real Credentials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Identity Summary Card */}
            <motion.div whileHover={{ y: -4 }} style={{ padding: 32, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 24, backdropFilter: 'blur(16px)' }}>
              <div style={{ display: 'flex', gap: 48 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>PSEUDONYM</p>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, color: '#007AFF' }}>{profile?.pseudonym?.slice(0, 16)}...</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>RISK PROFILE</p>
                  <span style={{ 
                    fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
                    background: profile?.risk_level === 'HIGH' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: profile?.risk_level === 'HIGH' ? '#EF4444' : '#10B981'
                  }}>{profile?.risk_level}</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12 }}>LAST AUDIT</p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{profile?.last_scan ? new Date(profile.last_scan).toLocaleString() : 'Never'}</p>
                </div>
              </div>
            </motion.div>

            {/* Proofs List */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>On-Chain Identity Proofs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {credentials.length > 0 ? credentials.map((c, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    style={{ padding: 24, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--sys-panel-border)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>⛓️</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.threat_assessment?.matches[0]?.breach || 'Unknown Exposure'}</span>
                      </div>
                      <p style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginBottom: 4 }}>
                        SIG: {c.proof_result?.solana_tx_sig?.slice(0, 24)}...
                      </p>
                      <p style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#007AFF', opacity: 0.8 }}>
                        HASH: {c.proof_result?.report_hash}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#10B981', display: 'block', marginBottom: 4 }}>VERIFIED</span>
                      <a href={`https://explorer.solana.com/tx/${c.proof_result?.solana_tx_sig}?cluster=devnet`} target="_blank" rel="noreferrer" 
                        style={{ fontSize: 11, color: '#007AFF', textDecoration: 'none' }}>View on Solana</a>
                    </div>
                  </motion.div>
                )) : (
                  <div style={{ padding: 48, textAlign: 'center', border: '2px dashed var(--sys-panel-border)', borderRadius: 24 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No verifiable credentials issued yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Stats & Fingerprints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div style={{ padding: 28, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 24, backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <span style={{ fontSize: 18 }}>🧬</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cryptographic Fingerprints</h3>
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.05em' }}>EMAIL_SHA256</p>
                  <span style={{ fontSize: 9, color: '#007AFF', fontWeight: 800 }}>PROTECTED</span>
                </div>
                <motion.div 
                  whileHover={{ background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.2)' }}
                  style={{ 
                    padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid transparent', borderRadius: 12, 
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, wordBreak: 'break-all', color: 'var(--text-secondary)',
                    lineHeight: 1.6, cursor: 'pointer', position: 'relative', overflow: 'hidden'
                  }}
                >
                  {profile?.hashed_email ? (
                    <>
                      <span style={{ color: '#007AFF' }}>{profile.hashed_email.slice(0, 32)}</span>
                      <span style={{ opacity: 0.6 }}>{profile.hashed_email.slice(32)}</span>
                    </>
                  ) : 'Unavailable'}
                </motion.div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.05em' }}>PHONE_SHA256</p>
                  <span style={{ fontSize: 9, color: '#007AFF', fontWeight: 800 }}>PROTECTED</span>
                </div>
                <motion.div 
                   whileHover={{ background: 'rgba(0,122,255,0.05)', borderColor: 'rgba(0,122,255,0.2)' }}
                   style={{ 
                    padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid transparent', borderRadius: 12, 
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11, wordBreak: 'break-all', color: 'var(--text-secondary)',
                    lineHeight: 1.6, cursor: 'pointer'
                  }}
                >
                  {profile?.hashed_phone ? (
                    <>
                      <span style={{ color: '#007AFF' }}>{profile.hashed_phone.slice(0, 32)}</span>
                      <span style={{ opacity: 0.6 }}>{profile.hashed_phone.slice(32)}</span>
                    </>
                  ) : 'Not provided'}
                </motion.div>
              </div>
            </div>

            <div style={{ padding: 28, background: 'linear-gradient(135deg, #007AFF, #0044FF)', borderRadius: 24, color: '#fff' }}>
              <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.8, marginBottom: 8 }}>TOTAL EXPOSURES</p>
              <p style={{ fontSize: 48, fontWeight: 800, margin: 0, letterSpacing: '-0.05em' }}>{profile?.breach_count || 0}</p>
              <p style={{ fontSize: 13, marginTop: 16, opacity: 0.9, lineHeight: 1.5 }}>
                Your identity has been identified in {profile?.breach_count || 0} intelligence vectors.
              </p>
            </div>

            <div style={{ padding: 24, background: 'var(--sys-panel)', border: '1px solid var(--sys-panel-border)', borderRadius: 24 }}>
              <h3 style={{ fontSize: 11, fontWeight: 800, color: '#007AFF', letterSpacing: '0.15em', marginBottom: 16 }}>NETWORK-WIDE ACTIVITY</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profile?.recent_global_scans?.map((scan, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 8, borderLeft: '3px solid #007AFF' }}>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 700 }}>IDENTITY_HASH</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-all' }}>
                      {scan.hashed_email}
                    </p>
                  </div>
                ))}
                {!profile?.recent_global_scans && (
                   <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Syncing global intelligence...</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}