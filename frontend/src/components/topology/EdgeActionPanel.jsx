import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Pencil, Cable, Save, Loader2 } from 'lucide-react'
import InterfaceSelect from './InterfaceSelect'

const CABLE_TYPES = [
  { value: 'ethernet',  name: 'Ethernet',  linkType: 'physical' },
  { value: 'fiber',     name: 'Fiber',     linkType: 'physical' },
  { value: 'serial',    name: 'Serial',    linkType: 'physical' },
  { value: 'wireless',  name: 'Wireless',  linkType: 'logical'  },
  { value: 'trunk',     name: 'Trunk',     linkType: 'logical'  },
  { value: 'crossover', name: 'Crossover', linkType: 'physical' },
]

// Helper to determine the cable type for older links that didn't have one
function getInitialCableType(edge) {
  if (!edge) return 'ethernet'
  if (edge.cable_type) return edge.cable_type
  
  const label = (edge.label ?? '').toLowerCase()
  if (label.includes('fiber'))      return 'fiber'
  if (label.includes('serial'))     return 'serial'
  if (label.includes('wireless') || label.includes('wi-fi')) return 'wireless'
  if (label.includes('trunk'))      return 'trunk'
  if (label.includes('crossover'))  return 'crossover'
  return 'ethernet'
}

/**
 * EdgeActionPanel — slides in from the bottom-right when an edge is selected.
 * Provides Edit and Delete actions for topology links.
 *
 * Props:
 *   edge      — edge object { id, from, to, label, type, data }
 *   position  — { x, y } click coordinates from Vis.js pointer.DOM
 *   nodes     — full node list for resolving device names
 *   onSave    — async (edgeId, { link_type, label, source_interface, target_interface }) => void
 *   onDelete  — async (edgeId) => void
 *   onClose   — callback to close the panel
 */
export default function EdgeActionPanel({ edge, nodes, position, onSave, onDelete, onClose }) {
  const [editing, setEditing]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving]     = useState(false)

  // Edit form state — initialized from the edge when edit mode opens
  const [cableType, setCableType]         = useState(() => getInitialCableType(edge))
  const [label, setLabel]                 = useState(edge?.label ?? '')
  const [sourceIface, setSourceIface]     = useState(edge?.data?.source_interface ?? '')
  const [targetIface, setTargetIface]     = useState(edge?.data?.target_interface ?? '')
  const [srcCustom, setSrcCustom]         = useState(false)
  const [tgtCustom, setTgtCustom]         = useState(false)

  // Sync state when a new edge is selected
  useEffect(() => {
    if (edge) {
      setCableType(getInitialCableType(edge))
      setLabel(edge.label ?? '')
      setSourceIface(edge.data?.source_interface ?? '')
      setTargetIface(edge.data?.target_interface ?? '')
      setSrcCustom(false)
      setTgtCustom(false)
      setEditing(false)
    }
  }, [edge])

  const srcNode = nodes.find(n => n.id === edge?.from)
  const tgtNode = nodes.find(n => n.id === edge?.to)

  const srcName = srcNode?.label?.replace(/^[^ ]+ /, '') ?? `Device #${edge?.from}`
  const tgtName = tgtNode?.label?.replace(/^[^ ]+ /, '') ?? `Device #${edge?.to}`

  // Detect when user picks "Custom…" option
  const handleSrcChange = (val) => {
    if (val === '__custom__') { setSrcCustom(true); setSourceIface('') }
    else { setSrcCustom(false); setSourceIface(val) }
  }
  const handleTgtChange = (val) => {
    if (val === '__custom__') { setTgtCustom(true); setTargetIface('') }
    else { setTgtCustom(false); setTargetIface(val) }
  }

  const handleSave = async () => {
    setSaving(true)
    const cableInfo = CABLE_TYPES.find(c => c.value === cableType)
    try {
      await onSave(edge.id, {
        link_type:        cableInfo?.linkType ?? 'physical',
        cable_type:       cableType,
        label:            label || undefined,
        source_interface: sourceIface || undefined,
        target_interface: targetIface || undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(edge.id)
    } finally {
      setDeleting(false)
    }
  }

  // Calculate constrained position to prevent modal from going off-screen
  // We assume modal width is ~288px (w-72) and height is ~350px.
  // Add a 20px offset from the cursor so it doesn't appear directly under the mouse.
  const modalStyle = position ? {
    top:  Math.max(20, Math.min(position.y + 15, window.innerHeight - 400)),
    left: Math.max(20, Math.min(position.x + 15, window.innerWidth - 320))
  } : {}

  return (
    <AnimatePresence>
      {edge && (
        <motion.div
          key={edge.id}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          exit={{    scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`absolute z-20 w-72 max-h-[calc(100vh-140px)] bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl overflow-y-auto ${
            !position ? 'bottom-24 right-4 lg:right-6' : ''
          }`}
          style={modalStyle}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <Cable size={15} className="text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {srcName} ↔ {tgtName}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {edge.label || edge.type || 'Link'}
                  {edge.data?.source_interface && ` · ${edge.data.source_interface}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition shrink-0"
            >
              <X size={13} />
            </button>
          </div>

          {/* Edit Form */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 space-y-3 border-b border-slate-100">
                  {/* Cable Type */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Cable Type</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CABLE_TYPES.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            const oldCable = CABLE_TYPES.find(ct => ct.value === cableType)
                            setCableType(c.value)
                            // Auto-update label if it was empty or matched the old cable type name
                            if (!label || (oldCable && label.toLowerCase() === oldCable.name.toLowerCase())) {
                              setLabel(c.name)
                            }
                          }}
                          className={`text-[11px] font-semibold py-1.5 rounded-xl border transition ${
                            cableType === c.value
                              ? 'bg-indigo-600 border-indigo-700 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Label</label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="e.g. Trunk Link"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>

                  {/* Interfaces */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Src Port</label>
                      {srcCustom ? (
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={sourceIface}
                            onChange={e => setSourceIface(e.target.value)}
                            placeholder="e.g. ether1"
                            className="flex-1 text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition min-w-0"
                          />
                          <button type="button" onClick={() => { setSrcCustom(false); setSourceIface('') }}
                            className="text-slate-400 hover:text-slate-600 px-1.5 rounded-xl hover:bg-slate-100 transition text-[10px]">✕</button>
                        </div>
                      ) : (
                        <InterfaceSelect deviceId={edge?.from} value={sourceIface} onChange={handleSrcChange} placeholder="e.g. ether1" size="sm" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dst Port</label>
                      {tgtCustom ? (
                        <div className="flex gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={targetIface}
                            onChange={e => setTargetIface(e.target.value)}
                            placeholder="e.g. ether2"
                            className="flex-1 text-xs border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition min-w-0"
                          />
                          <button type="button" onClick={() => { setTgtCustom(false); setTargetIface('') }}
                            className="text-slate-400 hover:text-slate-600 px-1.5 rounded-xl hover:bg-slate-100 transition text-[10px]">✕</button>
                        </div>
                      ) : (
                        <InterfaceSelect deviceId={edge?.to} value={targetIface} onChange={handleTgtChange} placeholder="e.g. ether2" size="sm" />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="p-3 flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-2xl py-2 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 text-xs font-semibold text-white bg-indigo-600 rounded-2xl py-2 hover:bg-indigo-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                {/* Edit */}
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 border border-slate-200 bg-white rounded-2xl py-2 hover:bg-slate-50 transition"
                >
                  <Pencil size={12} />
                  Edit
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50 rounded-2xl py-2 hover:bg-rose-100 disabled:opacity-60 transition"
                >
                  {deleting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />
                  }
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
