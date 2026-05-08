import React from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

export default function Overlay({ scrollContainerRef }) {
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  })

  // Fade animations for sections based on scroll progress
  // Sec 1: 0% - 15%
  const opacitySec1 = useTransform(scrollYProgress, [0, 0.05, 0.1, 0.15], [1, 1, 1, 0])
  const ySec1 = useTransform(scrollYProgress, [0, 0.15], [0, -50])

  // Sec 2: 15% - 35%
  const opacitySec2 = useTransform(scrollYProgress, [0.15, 0.2, 0.3, 0.35], [0, 1, 1, 0])
  const ySec2 = useTransform(scrollYProgress, [0.15, 0.2, 0.3, 0.35], [50, 0, 0, -50])

  // Sec 3: 35% - 55%
  const opacitySec3 = useTransform(scrollYProgress, [0.35, 0.4, 0.5, 0.55], [0, 1, 1, 0])
  const ySec3 = useTransform(scrollYProgress, [0.35, 0.4, 0.5, 0.55], [50, 0, 0, -50])

  // Sec 4: 55% - 75%
  const opacitySec4 = useTransform(scrollYProgress, [0.55, 0.6, 0.7, 0.75], [0, 1, 1, 0])
  const ySec4 = useTransform(scrollYProgress, [0.55, 0.6, 0.7, 0.75], [50, 0, 0, -50])

  // Sec 5: 75% - 100%
  const opacitySec5 = useTransform(scrollYProgress, [0.75, 0.8, 0.9, 1], [0, 1, 1, 1])
  const scaleSec5 = useTransform(scrollYProgress, [0.75, 0.85], [0.95, 1])

  return (
    <div className="absolute inset-0 pointer-events-none z-10 font-['Inter',sans-serif] text-white">
      {/* SECTION 1 - INTRO */}
      <motion.div
        style={{ opacity: opacitySec1, y: ySec1 }}
        className="absolute inset-0 flex flex-col items-center justify-center text-center p-6"
      >
        <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-4" style={{ fontFamily: "'SF Pro Display', 'Inter', sans-serif" }}>
          PHANTOM<span className="font-semibold">ID</span>
        </h1>
        <p className="text-xl md:text-2xl font-light text-gray-300 tracking-wide">
          Autonomous Cyber Defense
        </p>
        <div className="mt-8 text-sm md:text-base text-gray-500 tracking-widest uppercase">
          Your identity is the most valuable asset in 2026.
        </div>
      </motion.div>

      {/* SECTION 2 - DIGITAL IDENTITY */}
      <motion.div
        style={{ opacity: opacitySec2, y: ySec2 }}
        className="absolute inset-0 flex flex-col justify-center px-10 md:px-32 lg:px-48"
      >
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-5xl font-light leading-tight mb-8">
            Every click.<br />
            Every login.<br />
            Every digital footprint.
          </h2>
          <p className="text-xl md:text-2xl text-[#00d2ff] font-medium">
            Becomes part of your identity.
          </p>
        </div>
      </motion.div>

      {/* SECTION 3 - BREACH VISUALIZATION */}
      <motion.div
        style={{ opacity: opacitySec3, y: ySec3 }}
        className="absolute inset-0 flex flex-col justify-center items-end text-right px-10 md:px-32 lg:px-48"
      >
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-5xl font-light leading-tight mb-6">
            And breaches happen before people even realize they were exposed.
          </h2>
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent mt-8" />
        </div>
      </motion.div>

      {/* SECTION 4 - AI DEFENSE */}
      <motion.div
        style={{ opacity: opacitySec4, y: ySec4 }}
        className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
      >
        <h2 className="text-4xl md:text-6xl font-light leading-tight mb-4 tracking-tight">
          PhantomID detects.<br />
          <span className="text-[#007aff]">Reasons.</span><br />
          Responds.<br />
          <span className="font-semibold text-[#00d2ff]">Autonomously.</span>
        </h2>
      </motion.div>

      {/* SECTION 5 - FINAL CTA */}
      <motion.div
        style={{ opacity: opacitySec5, scale: scaleSec5 }}
        className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-t from-[#06070d] via-transparent to-transparent"
      >
        <p className="text-lg md:text-2xl text-gray-400 font-light mb-8">
          The future of cyber defense is autonomous.
        </p>
        <h1 className="text-6xl md:text-8xl font-medium tracking-tighter" style={{ fontFamily: "'SF Pro Display', 'Inter', sans-serif" }}>
          PHANTOM<span className="font-semibold">ID</span>
        </h1>
      </motion.div>
    </div>
  )
}
