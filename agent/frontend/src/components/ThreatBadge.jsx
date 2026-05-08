import { motion } from 'framer-motion'

const COLORS = {
  LOW:      'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  MEDIUM:   'text-amber-400   border-amber-400/30   bg-amber-400/10',
  HIGH:     'text-orange-400  border-orange-400/30  bg-orange-400/10',
  CRITICAL: 'text-red-400     border-red-400/30     bg-red-400/10',
}

export default function ThreatBadge({ level }) {
  const cls = COLORS[level] || COLORS.LOW
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-mono text-xs font-semibold tracking-widest ${cls}`}
    >
      {level === 'CRITICAL' && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"
        />
      )}
      {level}
    </motion.span>
  )
}
