import { motion, AnimatePresence } from 'framer-motion'
import { X, Wifi, Clock, Zap, MapPin, Info, Pencil } from 'lucide-react'
import StatusBadge   from '../ui/StatusBadge'
import DeviceTypeIcon from '../ui/DeviceTypeIcon'
import { formatLatency, timeAgo, vendorLabel, typeLabel } from '../../utils/helpers'

/**
 * NodeInfoPanel - appears near the cursor when a topology node is selected.
 *
 * Props:
 *   node     - device object (from API /api/devices/{id})
 *   position - { x, y } click coordinates from Vis.js pointer.DOM
 *   onEdit   - callback to enter edit mode
 *   onClose  - callback to deselect
 */
export default function NodeInfoPanel({ node, position, onEdit, onClose }) {
  // Calculate constrained position to prevent modal from going off-screen
  const modalStyle = position ? {
    top:  Math.max(20, Math.min(position.y + 15, window.innerHeight - 400)),
    left: Math.max(20, Math.min(position.x + 15, window.innerWidth - 320))
  } : {}
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          exit={{    scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={`absolute z-20 w-72 max-h-[calc(100vh-140px)] bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-y-auto ${
            !position ? 'bottom-24 right-4 lg:right-6' : ''
          }`}
          style={modalStyle}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <DeviceTypeIcon type={node.type} size={20} className="text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-slate-900 text-sm leading-tight truncate">{node.name}</p>
                <p className="text-xs text-slate-400 font-mono">{node.ip_address}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onEdit} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-xl hover:bg-indigo-50 transition" title="Edit Device">
                <Pencil size={15} />
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition" title="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="px-4 py-3 border-b border-slate-100">
            <StatusBadge status={node.status} size="lg" />
          </div>

          {/* Details */}
          <div className="flex-1 p-4 space-y-4">
            <Section title="Device Info">
              <Row icon={<Info size={14}/>}   label="Type"    value={typeLabel(node.type)} />
              <Row icon={<Info size={14}/>}   label="Vendor"  value={vendorLabel(node.vendor)} />
              {node.location && <Row icon={<MapPin size={14}/>} label="Location" value={node.location} />}
              {node.description && <Row icon={<Info size={14}/>} label="Note" value={node.description} />}
            </Section>

            <Section title="Performance">
              <Row icon={<Zap  size={14}/>}  label="Latency"   value={formatLatency(node.latency_ms)} />
              <Row icon={<Clock size={14}/>} label="Last Seen" value={timeAgo(node.last_seen_at)} />
              <Row icon={<Wifi size={14}/>}  label="SNMP"      value={node.snmp_enabled ? `Enabled (${node.snmp_version})` : 'Disabled'} />
            </Section>

            {/* Open ports */}
            {node.open_ports?.length > 0 && (
              <Section title={`Open Ports (${node.open_ports.length})`}>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {node.open_ports.map(p => (
                    <span
                      key={`${p.port}/${p.protocol}`}
                      className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md border ${
                        p.is_dangerous
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                      title={p.service_name}
                    >
                      {p.is_dangerous && '⚠️ '}
                      {p.port}/{p.protocol}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-slate-500 shrink-0 w-16">{label}</span>
      <span className="text-slate-800 font-medium truncate">{value ?? '-'}</span>
    </div>
  )
}
