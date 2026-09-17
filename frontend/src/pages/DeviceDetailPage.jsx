import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Server, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import StatusBadge      from '../components/ui/StatusBadge'
import DeviceTypeIcon   from '../components/ui/DeviceTypeIcon'
import MikrotikMetricsPanel from '../components/metrics/MikrotikMetricsPanel'
import CiscoMetricsPanel    from '../components/metrics/CiscoMetricsPanel'
import VpsMetricsPanel      from '../components/metrics/VpsMetricsPanel'
import { devicesService }   from '../services/devices.service'
import { vendorLabel, typeLabel, timeAgo, formatLatency } from '../utils/helpers'
import { toast } from '../utils/toast'
import ConfigConfirmationModal from '../components/ui/ConfigConfirmationModal'
import TerminalPanel from '../components/metrics/TerminalPanel'
import api from '../services/api'

const TABS = [
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'logs',       label: 'Logs'       },
  { id: 'terminal',   label: 'Terminal'   },
]

export default function DeviceDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [device,  setDevice]  = useState(null)
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('monitoring')
  const [rebooting, setRebooting] = useState(false)
  const [rebootModalOpen, setRebootModalOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      devicesService.getOne(id),
      devicesService.getLogs(id, { per_page: 50 }),
    ])
      .then(([deviceRes, logsRes]) => {
        setDevice(deviceRes.device)
        setLogs(logsRes.data ?? [])
      })
      .catch(() => toast.error('Failed to load device details.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <AlertCircle size={32} />
        <p>Device not found.</p>
        <Link to="/devices" className="text-indigo-600 text-sm hover:underline">← Back to Devices</Link>
      </div>
    )
  }

  const hasMetrics = device.vendor === 'mikrotik' || device.vendor === 'cisco' || device.vendor === 'server'

  const handleReboot = async () => {
    setRebooting(true)
    try {
      await api.post(`/api/devices/${device.id}/config/reboot`)
      toast.success(`${device.name} is rebooting...`)
      setRebootModalOpen(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to initiate reboot')
    } finally {
      setRebooting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/devices')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft size={15} /> Back to Devices
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
            <DeviceTypeIcon type={device.type} size={26} className="text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display font-bold text-slate-900 text-2xl">{device.name}</h1>
              <StatusBadge status={device.status} size="lg" />
            </div>
            {device.ip_address ? (
              <a 
                href={`http://${device.ip_address}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline font-mono text-sm mt-0.5 transition-colors w-fit"
              >
                {device.ip_address}
                <ExternalLink size={12} className="opacity-70" />
              </a>
            ) : (
              <p className="text-slate-500 font-mono text-sm mt-0.5">No IP</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
              <Info label="Type"    value={typeLabel(device.type)} />
              <Info label="Vendor"  value={vendorLabel(device.vendor)} />
              {device.location  && <Info label="Location" value={device.location} />}
              <Info label="Latency" value={formatLatency(device.latency_ms)} />
              <Info label="Last Seen" value={timeAgo(device.last_seen_at)} />
            </div>
            {device.description && (
              <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-2 border border-slate-100">
                {device.description}
              </p>
            )}
          </div>
          {hasMetrics && device.vendor !== 'server' && (
            <div className="flex shrink-0">
              <button
                onClick={() => setRebootModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition border border-rose-100"
              >
                Reboot Device
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          if ((t.id === 'monitoring' || t.id === 'terminal') && !hasMetrics) return null
          // Terminal only works for Mikrotik/Cisco (SSH), not for Linux/VPS (SNMP)
          if (t.id === 'terminal' && device.vendor === 'server') return null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{   opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'monitoring' && hasMetrics && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              {device.vendor === 'mikrotik' && (
                <MikrotikMetricsPanel deviceId={device.id} deviceName={device.name} />
              )}
              {device.vendor === 'cisco' && (
                <CiscoMetricsPanel deviceId={device.id} deviceName={device.name} />
              )}
              {device.vendor === 'server' && (
                <VpsMetricsPanel deviceId={device.id} deviceName={device.name} />
              )}
            </div>
          )}

          {tab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <DeviceLogTable logs={logs} />
            </div>
          )}
          
          {tab === 'terminal' && hasMetrics && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-[600px] overflow-hidden">
              <TerminalPanel deviceId={device.id} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ConfigConfirmationModal
        open={rebootModalOpen}
        onOpenChange={setRebootModalOpen}
        deviceName={device.name}
        actionTitle="Reboot Device"
        actionDescription="This will restart the network device and cause temporary network disruption."
        onConfirm={handleReboot}
        loading={rebooting}
      />
    </motion.div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Info({ label, value }) {
  return (
    <span>
      <span className="text-slate-400">{label}:</span>{' '}
      <span className="font-medium text-slate-700">{value ?? '-'}</span>
    </span>
  )
}

function DeviceLogTable({ logs }) {
  const EVENT_COLOR = {
    discovery:    'bg-indigo-100 text-indigo-700',
    status_change:'bg-amber-100 text-amber-700',
    config_change:'bg-blue-100 text-blue-700',
    alert:        'bg-rose-100 text-rose-700',
    system:       'bg-slate-100 text-slate-600',
  }

  if (!logs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Clock size={28} className="mb-2" />
        <p className="text-sm">No activity logs yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {logs.map((log, i) => (
        <div key={log.id ?? i} className="flex items-start gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 shrink-0 ${EVENT_COLOR[log.event_type] ?? 'bg-slate-100 text-slate-600'}`}>
            {log.event_type}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800">{log.message}</p>
            {log.user && <p className="text-xs text-slate-400 mt-0.5">by {log.user.name}</p>}
          </div>
          <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{timeAgo(log.created_at)}</span>
        </div>
      ))}
    </div>
  )
}
