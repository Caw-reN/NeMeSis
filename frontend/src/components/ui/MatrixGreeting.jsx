import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export default function MatrixGreeting() {
  const canvasRef = useRef(null)

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
      // Black background with slight opacity to create trail effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)' // Tailwind slate-900 with opacity
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
      className="relative w-full h-32 md:h-40 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-center mb-2"
    >
      {/* Canvas for Matrix Rain */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-60"
      />
      
      {/* Dark overlay to make text pop more */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/40" />

      {/* Main Text */}
      <div className="relative z-10 text-center px-4">
        <h1 
          className="font-display font-black text-3xl md:text-5xl lg:text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
          style={{ textShadow: '0 0 20px rgba(16,185,129, 0.4)' }}
        >
          HALLO ADMIN NMS
        </h1>
        <p className="mt-2 text-emerald-400/80 font-mono text-xs md:text-sm tracking-widest uppercase">
          SYSTEM_READY_ // AWAITING_COMMAND
        </p>
      </div>
    </motion.div>
  )
}
