import { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, Loader2 } from 'lucide-react'
import api from '../../services/api'

export default function TerminalPanel({ deviceId }) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  // Scroll to bottom whenever history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleExecute = async (e) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd) return

    // Add command to history
    setHistory(prev => [...prev, { type: 'command', content: cmd }])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await api.post(`/api/devices/${deviceId}/config/execute`, { command: cmd })
      
      setHistory(prev => [...prev, { type: 'output', content: res.data?.output || '(No output)' }])
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', content: err?.response?.data?.message || err.message || 'Failed to execute command.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm relative">
      {/* Terminal Header */}
      <div className="bg-[#2d2d2d] border-b border-[#3e3e3e] flex items-center gap-2 px-4 py-2 shrink-0">
        <TerminalIcon size={14} className="text-emerald-500" />
        <span className="font-semibold text-xs tracking-wider uppercase text-slate-300">Remote Console</span>
        <span className="ml-auto text-xs text-slate-500">Connected</span>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="text-emerald-600 font-bold mb-4">
          NMS Web Terminal v1.0<br/>
          Enter a command to execute on the remote device.
        </div>
        
        {history.map((entry, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {entry.type === 'command' && (
              <div className="flex gap-2">
                <span className="text-emerald-500 select-none">❯</span>
                <span className="text-white">{entry.content}</span>
              </div>
            )}
            {entry.type === 'output' && (
              <div className="text-slate-300 ml-4 py-1">{entry.content}</div>
            )}
            {entry.type === 'error' && (
              <div className="text-rose-400 ml-4 py-1">Error: {entry.content}</div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 text-slate-400 ml-4 py-1">
            <Loader2 size={14} className="animate-spin" />
            Executing...
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Terminal Input */}
      <form onSubmit={handleExecute} className="shrink-0 p-4 pt-2 flex gap-2 items-center bg-[#1e1e1e]">
        <span className="text-emerald-500 font-bold select-none">❯</span>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          autoComplete="off"
          autoFocus
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-white placeholder-slate-600 disabled:opacity-50"
          placeholder="Type command here (e.g. show ip int brief)"
        />
      </form>
    </div>
  )
}
