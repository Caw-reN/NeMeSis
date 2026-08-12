import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Pencil } from 'lucide-react'

/**
 * NodeEditPanel — floats next to the NodeInfoPanel to allow quick editing of basic device details.
 *
 * Props:
 *   node     — device object
 *   position — { x, y } base coordinates (will be shifted right)
 *   onSave   — callback with (id, data) to update the backend
 *   onClose  — callback to cancel
 */
export default function NodeEditPanel({ node, position, onSave, onClose }) {
  const [saving, setSaving] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    type: 'other',
    vendor: 'generic',
    location: '',
    description: ''
  })

  useEffect(() => {
    if (node) {
      setForm({
        name: node.name || '',
        type: node.type || 'other',
        vendor: node.vendor || 'generic',
        location: node.location || '',
        description: node.description || ''
      })
    }
  }, [node])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(node.id, form)
    } finally {
      setSaving(false)
    }
  }

  // Shift this panel slightly to the right of NodeInfoPanel (w-72 = 288px)
  const modalStyle = position ? {
    top:  Math.max(20, Math.min(position.y + 15, window.innerHeight - 450)),
    // Shift right by 300px (288px width of info panel + 12px gap)
    left: Math.max(20, Math.min(position.x + 315, window.innerWidth - 320))
  } : {}

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={`edit-${node.id}`}
          initial={{ scale: 0.9, opacity: 0, x: -20 }}
          animate={{ scale: 1,   opacity: 1, x: 0 }}
          exit={{    scale: 0.9, opacity: 0, x: -20 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`absolute z-30 w-72 bg-white/95 backdrop-blur-md rounded-3xl border border-indigo-100 shadow-2xl overflow-y-auto max-h-[calc(100vh-140px)] ${
            !position ? 'bottom-24 right-[320px] lg:right-[350px]' : ''
          }`}
          style={modalStyle}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-indigo-50 bg-indigo-50/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Pencil size={15} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 truncate">Edit Device</p>
                <p className="text-[10px] text-slate-500 truncate">{node.ip_address}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition bg-slate-50"
                  >
                    <option value="router">Router</option>
                    <option value="switch">Switch</option>
                    <option value="server">Server</option>
                    <option value="ap">AP</option>
                    <option value="firewall">Firewall</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vendor</label>
                  <select
                    value={form.vendor}
                    onChange={e => setForm({ ...form, vendor: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition bg-slate-50"
                  >
                    <option value="mikrotik">Mikrotik</option>
                    <option value="cisco">Cisco</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 transition bg-slate-50 focus:bg-white resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl py-2.5 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
