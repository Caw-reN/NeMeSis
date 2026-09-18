import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function MatrixGreeting() {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative w-full flex items-center justify-center mb-6 pt-4"
    >
      {/* Main Text */}
      <div className="relative z-10 px-4 w-full flex flex-col items-center justify-center overflow-x-auto custom-scrollbar pb-2">
        <pre 
          className="font-mono font-light italic text-slate-800 text-[min(2.4vw,22px)] leading-[1.1] text-left select-none min-w-max mx-auto"
        >
          {displayText}
        </pre>
        <p className="mt-4 text-slate-500 font-mono text-xs md:text-sm tracking-widest uppercase font-light italic text-center w-full">
          SYSTEM_READY_ // AWAITING_COMMAND
        </p>
      </div>
    </motion.div>
  )
}
