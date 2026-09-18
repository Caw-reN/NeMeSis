import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

export default function MatrixGreeting() {
  const canvasRef = useRef(null)
  
  // Scramble text state
  const targetText = "HALLO ADMIN NMS"
  const [displayText, setDisplayText] = useState("")

  // Scramble effect
  useEffect(() => {
    let iteration = 0
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()"
    
    const interval = setInterval(() => {
      setDisplayText(
        targetText
          .split("")
          .map((letter, index) => {
            if (index < iteration) {
              return targetText[index]
            }
            if (letter === " " && Math.random() > 0.5) {
              return " "
            }
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )

      if (iteration >= targetText.length) {
        clearInterval(interval)
      }

      iteration += 1 / 4 // 4 frames per letter
    }, 40) // speed

    return () => clearInterval(interval)
  }, [])

  // Canvas Matrix Rain
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Make canvas full size of container
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Matrix characters
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()'.split('')
    const fontSize = 14
    const columns = canvas.width / fontSize

    // Array of drops - one per column
    const drops = []
    for (let x = 0; x < columns; x++) {
      drops[x] = Math.random() * -100 // Start off-screen randomly
    }

    // Draw the matrix rain
    const draw = () => {
      // White background with slight opacity to create trail effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)' // White trail
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#10b981' // Tailwind emerald-500
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)]
        
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        // Reset drop to top randomly
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.95) {
          drops[i] = 0
        }
        
        drops[i]++
      }
    }

    const interval = setInterval(draw, 33)

    // Handle resize
    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative w-full h-48 md:h-64 rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4"
    >
      {/* Canvas for Matrix Rain */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-50"
      />
      
      {/* White overlay to make text pop more and blend edges */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/30 to-white/60" />

      {/* Main Text */}
      <div className="relative z-10 text-center px-4">
        <h1 
          className="font-display font-black text-4xl md:text-6xl lg:text-7xl tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-emerald-700 drop-shadow-[0_4px_10px_rgba(16,185,129,0.2)]"
        >
          {displayText}
        </h1>
        <p className="mt-3 text-emerald-600/90 font-mono text-xs md:text-sm tracking-widest uppercase font-semibold">
          SYSTEM_READY_ // AWAITING_COMMAND
        </p>
      </div>
    </motion.div>
  )
}
