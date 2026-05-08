import { useEffect, useRef } from 'react'

const CHARS = '!<>-_\\/[]{}—=+*^?#'

export default function GlitchText({ text, className = '', trigger = true }) {
  const ref = useRef()

  useEffect(() => {
    if (!trigger) return
    let iter = 0
    const interval = setInterval(() => {
      if (!ref.current) return
      ref.current.innerText = text
        .split('')
        .map((char, i) => {
          if (i < iter) return char
          return char === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)]
        })
        .join('')
      iter += 0.5
      if (iter >= text.length) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [text, trigger])

  return <span ref={ref} className={className}>{text}</span>
}
