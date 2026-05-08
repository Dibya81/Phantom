import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useI18n } from '../contexts/I18nContext'

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { t, lang, changeLang } = useI18n()
  const s = t.settings

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center rounded border border-gray-700 hover:border-green-400/50 transition-colors text-gray-400 hover:text-green-400"
        aria-label="Settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-52 bg-[#0d1117] border border-[#1a2332] rounded-lg p-4 z-50 shadow-2xl"
          >
            {/* Theme */}
            <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-2">{s.theme}</p>
            <div className="flex gap-1 mb-4">
              {['dark','light','system'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setTheme(opt)}
                  className={`flex-1 py-1 rounded text-xs font-mono transition-all ${
                    theme === opt
                      ? 'bg-green-400/20 text-green-400 border border-green-400/40'
                      : 'text-gray-500 border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {s[opt]}
                </button>
              ))}
            </div>

            {/* Language */}
            <p className="font-mono text-[10px] tracking-widest text-gray-500 mb-2">{s.language}</p>
            <div className="flex flex-col gap-1">
              {['en','hi','kn'].map(l => (
                <button
                  key={l}
                  onClick={() => { changeLang(l); setOpen(false) }}
                  className={`py-1.5 px-2 rounded text-xs font-mono text-left transition-all ${
                    lang === l
                      ? 'bg-green-400/20 text-green-400 border border-green-400/40'
                      : 'text-gray-500 border border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {s[l]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
