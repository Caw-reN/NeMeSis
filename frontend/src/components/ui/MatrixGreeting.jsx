import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
export default function MatrixGreeting() {
  const canvasRef = useRef(null)
  
  // Scramble text state
  const targetAscii = `
HHH   HHH    AAA     LLL       LLL        OOOOOO       AAA     DDDDD     MMM   MMM  III  NNN   NNN    NNN   NNN  MMM   MMM   SSSSSS  
HHH   HHH   AAAAA    LLL       LLL       OOO  OOO     AAAAA    DDD DDD   MMMM MMMM  III  NNNN  NNN    NNNN  NNN  MMMM MMMM  SSS      
HHHHHHHHH  AAA AAA   LLL       LLL       OOO  OOO    AAA AAA   DDD  DDD  MMM M MMM  III  NNN N NNN    NNN N NNN  MMM M MMM   SSSSSS  
HHH   HHH  AAAAAAA   LLL       LLL       OOO  OOO    AAAAAAA   DDD  DDD  MMM   MMM  III  NNN  NNNN    NNN  NNNN  MMM   MMM       SSS 
HHH   HHH  AAA AAA   LLLLLLLL  LLLLLLLL  OOO  OOO    AAA AAA   DDD DDD   MMM   MMM  III  NNN   NNN    NNN   NNN  MMM   MMM  SSS  SSS 
HHH   HHH  AAA AAA   LLLLLLLL  LLLLLLLL   OOOOOO     AAA AAA   DDDDD     MMM   MMM  III  NNN   NNN    NNN   NNN  MMM   MMM   SSSSSS  
`.substring(1) // remove leading newline

  const [displayText, setDisplayText] = useState("")

  // Scramble effect
  useEffect(() => {
    let iteration = 0
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()"
    
    const interval = setInterval(() => {
      setDisplayText(
        targetAscii
          .split("")
          .map((letter, index) => {
            // Keep shapes perfectly intact
            if (letter === " " || letter === "\n") {
              return letter
            }
            if (index < iteration) {
              return targetAscii[index]
            }
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )

      if (iteration >= targetAscii.length) {
        clearInterval(interval)
      }

      iteration += 5 // Reveal 5 characters per frame so it takes a couple of seconds
    }, 25) // speed

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
      <div className="relative z-10 text-center px-4 w-full flex flex-col items-center justify-center overflow-hidden">
        <pre 
          className="font-mono font-black text-[min(1.4vw,14px)] leading-[1.1] text-left text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700 drop-shadow-sm select-none"
        >
          {displayText}
        </pre>
        <p className="mt-4 text-emerald-600/90 font-mono text-xs md:text-sm tracking-widest uppercase font-semibold">
          SYSTEM_READY_ // AWAITING_COMMAND
        </p>
      </div>
    </motion.div>
  )
}
