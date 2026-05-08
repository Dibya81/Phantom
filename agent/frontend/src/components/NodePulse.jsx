import { motion } from 'framer-motion'

const STATE_STYLES = {
  idle:     { ring: 'border-gray-700',           dot: 'bg-gray-600',      glow: '' },
  active:   { ring: 'border-green-400/60',        dot: 'bg-green-400',     glow: 'shadow-[0_0_20px_rgba(0,255,135,0.4)]' },
  complete: { ring: 'border-green-500/40',        dot: 'bg-green-500',     glow: 'shadow-[0_0_12px_rgba(0,255,135,0.2)]' },
  error:    { ring: 'border-red-500/60',          dot: 'bg-red-500',       glow: 'shadow-[0_0_20px_rgba(255,56,96,0.4)]' },
}

export default function NodePulse({ label, subLabel, state = 'idle', index = 0 }) {
  const s = STATE_STYLES[state] || STATE_STYLES.idle
  const isActive = state === 'active'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Node circle */}
      <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${s.ring} ${s.glow}`}>
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-green-400/30"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
        <motion.div
          className={`w-4 h-4 rounded-full transition-colors duration-300 ${s.dot}`}
          animate={isActive ? { scale: [1, 1.2, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      </div>

      {/* Labels */}
      <div className="text-center">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-gray-200 dark:text-gray-200">{label}</p>
        <p className="font-mono text-[10px] text-gray-500 mt-0.5">{subLabel}</p>
      </div>
    </motion.div>
  )
}
