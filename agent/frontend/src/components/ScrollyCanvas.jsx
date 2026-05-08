import React, { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent, useSpring, AnimatePresence } from 'framer-motion'

const FRAME_COUNT = 96

export default function ScrollyCanvas({ scrollContainerRef }) {
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  // Preload images
  useEffect(() => {
    let loadedCount = 0
    const images = []

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image()
      const frameIndex = i.toString().padStart(2, '0')
      img.src = `/sequence/frame_${frameIndex}_delay-0.083s.png`
      
      img.onload = () => {
        loadedCount++
        setLoadProgress(Math.round((loadedCount / FRAME_COUNT) * 100))
        if (loadedCount === FRAME_COUNT) {
          imagesRef.current = images
          setImagesLoaded(true)
        }
      }
      images.push(img)
    }
  }, [])

  // Setup scroll values
  const { scrollYProgress } = useScroll({
    target: scrollContainerRef,
    offset: ["start start", "end end"]
  })

  // Smooth the scroll progress to ensure we hit intermediate frames and prevent skipping/jerky movement
  const smoothProgress = useSpring(scrollYProgress, {
    damping: 50,
    stiffness: 400,
    mass: 0.1
  })

  const frameIndex = useTransform(smoothProgress, [0, 1], [0, FRAME_COUNT - 1])

  // Draw to canvas
  const drawFrame = (index) => {
    if (!imagesLoaded || !canvasRef.current || !imagesRef.current[index]) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = imagesRef.current[index]

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    
    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Object-fit: cover logic
    const canvasRatio = rect.width / rect.height
    const imgRatio = img.width / img.height

    let renderWidth, renderHeight, xOffset, yOffset

    if (canvasRatio > imgRatio) {
      // Canvas is wider than image
      renderWidth = rect.width
      renderHeight = rect.width / imgRatio
      xOffset = 0
      yOffset = (rect.height - renderHeight) / 2
    } else {
      // Canvas is taller than image
      renderHeight = rect.height
      renderWidth = rect.height * imgRatio
      yOffset = 0
      xOffset = (rect.width - renderWidth) / 2
    }

    ctx.drawImage(img, xOffset, yOffset, renderWidth, renderHeight)
  }

  // Draw initial frame once loaded
  useEffect(() => {
    if (imagesLoaded) {
      drawFrame(0)
    }
  }, [imagesLoaded])

  // Draw on scroll
  useMotionValueEvent(frameIndex, "change", (latest) => {
    drawFrame(Math.floor(latest))
  })

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawFrame(Math.floor(frameIndex.get()))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [imagesLoaded])

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-white">
      
      {/* Loading State Overlay */}
      <AnimatePresence>
        {!imagesLoaded && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white"
          >
            <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden mb-4">
              <motion.div 
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${loadProgress}%` }}
                transition={{ ease: "linear" }}
              />
            </div>
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase font-mono">
              Decrypting Assets // {loadProgress}%
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas 
        ref={canvasRef}
        className="w-full h-full object-cover"
      />
    </div>
  )
}
