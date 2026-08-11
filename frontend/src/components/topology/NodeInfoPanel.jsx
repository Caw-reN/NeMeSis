import { motion, AnimatePresence } from 'framer-motion'
import { X, Wifi, Clock, Zap, MapPin, Info } from 'lucide-react'
import StatusBadge   from '../ui/StatusBadge'
import DeviceTypeIcon from '../ui/DeviceTypeIcon'
import { formatLatency, timeAgo, vendorLabel, typeLabel } from '../../utils/helpers'

/**
 * NodeInfoPanel — slides in from the right when a topology node is selected.
 *
 * Props:
 *   node     — device object (from API /api/devices/{id})
 *   onClose  — callback to deselect
 */
export default function NodeInfoPanel({ node, onClose }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0,      opacity: 1   }}
          exit={{    x: '100%', opacity: 0   }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute top-0 right-0 h-full w-72 bg-white border-l border-slate-200 shadow-xl z-10 flex flex-col overflow-y-auto"
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
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition shrink-0">
              <X size={16} />
            </button>
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
        </motion.aside>
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
      <span className="text-slate-800 font-medium truncate">{value ?? '—'}</span>
    </div>
  )
}
