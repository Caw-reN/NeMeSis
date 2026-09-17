import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, Radar, Network, Info, Loader2, Wifi, Globe } from 'lucide-react'

/**
 * DiscoveryModal
 *
 * Modal that appears before running auto-discovery.
 * Allows user to specify one or more IP/CIDR ranges to filter which
 * discovered hosts get added to the NMS.
 *
 * Props:
 *   open        - boolean
 *   onClose     - () => void
 *   onConfirm   - (ipRanges: string[], filterType: string) => void
 *   loading     - boolean (discovery in progress)
 */
export default function DiscoveryModal({ open, onClose, onConfirm, loading }) {
  const [ranges, setRanges] = useState([''])
  const [errors, setErrors] = useState({})
  const [filterType, setFilterType] = useState('all') // 'all' | 'ap'

  // Validate a single range entry
  const validateRange = (val) => {
    if (!val.trim()) return 'IP range tidak boleh kosong'

    // CIDR notation e.g. 192.168.1.0/24
    const cidrRe = /^(\d{1,3}\.){3}\d{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/
    // Range notation e.g. 192.168.1.1-192.168.1.254
    const rangeRe = /^(\d{1,3}\.){3}\d{1,3}-(\d{1,3}\.){3}\d{1,3}$/
    // Single IP e.g. 192.168.1.1
    const singleRe = /^(\d{1,3}\.){3}\d{1,3}$/

    if (!cidrRe.test(val.trim()) && !rangeRe.test(val.trim()) && !singleRe.test(val.trim())) {
      return 'Format tidak valid. Gunakan CIDR (192.168.1.0/24), range (192.168.1.1-192.168.1.254), atau IP tunggal'
    }
    return null
  }

  const handleChange = (idx, val) => {
    setRanges(prev => prev.map((r, i) => i === idx ? val : r))
    // Clear error on change
    if (errors[idx]) {
      setErrors(prev => { const e = { ...prev }; delete e[idx]; return e })
    }
  }

  const addRange = () => setRanges(prev => [...prev, ''])

  const removeRange = (idx) => {
    setRanges(prev => prev.filter((_, i) => i !== idx))
    setErrors(prev => {
      const e = {}
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k)
        if (ki < idx) e[ki] = v
        else if (ki > idx) e[ki - 1] = v
      })
      return e
    })
  }

  const handleSubmit = () => {
    // If AP-only mode, skip IP range validation (we search all subnets)
    if (filterType === 'ap') {
      onConfirm([], 'ap')
      return
    }

    const newErrors = {}
    let valid = true

    ranges.forEach((r, i) => {
      const err = validateRange(r)
      if (err) { newErrors[i] = err; valid = false }
    })

    if (!valid) { setErrors(newErrors); return }

    onConfirm(ranges.map(r => r.trim()), '')
  }

  const handleSkip = () => {
    onConfirm([], '') // Empty = no filter, discover all
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onWheel={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={loading ? undefined : onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Radar size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">Auto-Discovery</h2>
                  <p className="text-indigo-200 text-xs mt-0.5">Tentukan range IP yang akan di-scan</p>
                </div>
              </div>
              {!loading && (
                <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {/* Info banner */}
            <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3.5">
              <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-700 leading-relaxed">
                Discovery akan membaca <strong>DHCP Leases</strong> dan <strong>ARP Table</strong> dari MikroTik Anda.
                {filterType === 'ap'
                  ? <><br /><span className="text-indigo-600 font-medium mt-1 block">Mode AP Only: hanya perangkat Access Point (EAP, UAP, UniFi, CAP, dll.) yang akan ditambahkan.</span></>
                  : <><br /><span className="text-blue-500 mt-1 block">Kosongkan untuk scan semua perangkat yang ditemukan.</span></>
                }
              </div>
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Mode Discovery</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  disabled={loading}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    filterType === 'all'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  } disabled:opacity-50`}
                >
                  <Globe size={15} />
                  Semua Perangkat
                </button>
                <button
                  onClick={() => setFilterType('ap')}
                  disabled={loading}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    filterType === 'ap'
                      ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  } disabled:opacity-50`}
                >
                  <Wifi size={15} />
                  <span>AP Only</span>
                  <span className="ml-auto text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-semibold">EAP · UAP · CAP</span>
                </button>
              </div>
            </div>
            {/* IP Range inputs - hidden in AP-only mode */}
            {filterType !== 'ap' && (
            <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Network size={15} />
                IP Range / CIDR
              </label>

              <div className="space-y-2">
                {ranges.map((r, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={r}
                        onChange={e => handleChange(idx, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addRange()}
                        placeholder="cth: 192.168.1.0/24 atau 192.168.1.1-192.168.1.254"
                        disabled={loading}
                        className={`flex-1 px-3 py-2.5 text-sm rounded-lg border transition-colors font-mono
                          ${errors[idx]
                            ? 'border-rose-400 bg-rose-50 focus:ring-rose-300'
                            : 'border-slate-200 bg-slate-50 focus:border-indigo-400 focus:ring-indigo-200'
                          }
                          focus:outline-none focus:ring-2 disabled:opacity-60`}
                      />
                      {ranges.length > 1 && (
                        <button
                          onClick={() => removeRange(idx)}
                          disabled={loading}
                          className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {errors[idx] && (
                      <p className="text-xs text-rose-500 pl-1">{errors[idx]}</p>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addRange}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1 disabled:opacity-50 transition-colors"
              >
                <Plus size={13} />
                Tambah range
              </button>
            </div>

            {/* Format hints */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-1.5 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-2">Format yang didukung:</p>
              {[
                { ex: '192.168.1.0/24', desc: 'CIDR notation (seluruh subnet)' },
                { ex: '10.0.0.1-10.0.0.100', desc: 'Range IP (dariâ€“sampai)' },
                { ex: '172.16.5.50', desc: 'IP tunggal' },
              ].map(({ ex, desc }) => (
                <div key={ex} className="flex items-center gap-2">
                  <code className="text-[11px] font-mono bg-white border border-slate-200 text-indigo-700 px-2 py-0.5 rounded">{ex}</code>
                  <span className="text-[11px] text-slate-500">{desc}</span>
                </div>
              ))}
            </div>
            </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              onClick={handleSkip}
              disabled={loading}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors disabled:opacity-50"
            >
              Scan semua (tanpa filter)
            </button>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (filterType !== 'ap' && ranges.every(r => !r.trim()))}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-60 flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Radar size={15} />
                    Mulai Scan
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
