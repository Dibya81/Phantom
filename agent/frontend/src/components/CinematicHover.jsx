import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

export default function CinematicHover() {
  const containerRef = useRef(null)

  // Motion values for mouse tracking
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  // Spring configuration for smooth, heavy luxury feel
  const springConfig = { damping: 40, stiffness: 150, mass: 1.5 }
  const smoothX = useSpring(mouseX, springConfig)
  const smoothY = useSpring(mouseY, springConfig)

  // 3D Rotations (subtle Apple-like tilts)
  const rotateX = useTransform(smoothY, [0, 1], [4, -4])
  const rotateY = useTransform(smoothX, [0, 1], [-4, 4])

  // Parallax offsets
  const upperX = useTransform(smoothX, [0, 1], [-15, 15])
  const upperY = useTransform(smoothY, [0, 1], [-15, 15])
  
  const lowerX = useTransform(smoothX, [0, 1], [8, -8])
  const lowerY = useTransform(smoothY, [0, 1], [8, -8])

  const handleMouseMove = (e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    // Calculate relative mouse position (0 to 1)
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    mouseX.set(x)
    mouseY.set(y)
  }

  const handleMouseLeave = () => {
    // Return to center
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

    const handleTouchMove = (e) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const touch = e.touches[0]
      const x = (touch.clientX - rect.left) / rect.width
      const y = (touch.clientY - rect.top) / rect.height
      mouseX.set(x)
      mouseY.set(y)
    }
  
    return (
      <section 
        className="relative w-full py-32 bg-[#FAFAFA] overflow-hidden flex flex-col items-center justify-center cursor-crosshair z-20"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseLeave}
        onTouchCancel={handleMouseLeave}
      >
        {/* 3D Scene Container */}
        <div 
          ref={containerRef}
          className="relative w-full aspect-video max-w-6xl flex items-center justify-center perspective-[2500px]"
        >
          <motion.div
            className="relative w-full h-full transform-style-3d flex items-center justify-center"
            style={{
              rotateX,
              rotateY,
            }}
          >
            {/* BASE LAYER (Default Visible: main_outer) */}
            <motion.div
              className="absolute inset-0 rounded-[32px] overflow-hidden shadow-2xl bg-white border border-gray-200"
              style={{
                x: lowerX,
                y: lowerY,
                scale: 0.98,
                translateZ: -20,
              }}
            >
              <div 
                className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: 'url("/main_outer/ChatGPT Image May 7, 2026, 07_01_35 PM.png")' }}
              />
            </motion.div>

            {/* REVEAL LAYER (Hidden by default, revealed on mouse: inner) */}
            <motion.div
              className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none"
              style={{
                x: upperX,
                y: upperY,
                scale: 1.02,
                translateZ: 50,
                maskImage: useTransform(() => `radial-gradient(circle 350px at ${parseInt(smoothX.get() * 100)}% ${parseInt(smoothY.get() * 100)}%, black 30%, transparent 80%)`),
                WebkitMaskImage: useTransform(() => `radial-gradient(circle 350px at ${parseInt(smoothX.get() * 100)}% ${parseInt(smoothY.get() * 100)}%, black 30%, transparent 80%)`),
              }}
            >
              <div 
                className="absolute inset-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_20px_40px_rgba(0,122,255,0.2)]"
                style={{ backgroundImage: 'url("/inner/ChatGPT Image May 7, 2026, 07_01_30 PM.png")' }}
              />
            </motion.div>

          </motion.div>
        </div>

        {/* Cinematic Text Overlay - NOW BELOW THE PHOTO */}
        <div className="mt-16 w-full max-w-6xl px-8 md:px-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <span className="label-overline block mb-4 text-[#007aff]">
              Architectural Integrity
            </span>
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-light text-gray-900 tracking-tighter leading-[0.95]">
              Impenetrable.<br />
              <span className="text-gray-400">By design.</span>
            </h2>
          </motion.div>
        </div>
      </section>
  )
}
