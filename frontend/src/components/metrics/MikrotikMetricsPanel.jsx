import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Cpu, MemoryStick, Wifi, Network, Users, Clock } from 'lucide-react'
import InterfaceTable from './InterfaceTable'
import { metricsService } from '../../services/metrics.service'
import { toast } from '../../utils/toast'
import ConfigConfirmationModal from '../ui/ConfigConfirmationModal'
import DataTable from '../ui/DataTable'
import api from '../../services/api'

const REFRESH_INTERVAL_MS = 30_000

/**
 * MikrotikMetricsPanel
 *
 * Displays:
 * - System resources: CPU load, memory, uptime, version
 * - IP Addresses assigned to interfaces
 * - Interfaces with Rx/Tx counters
 * - DHCP leases table
 *
 * Props:
 *   deviceId   - device DB id
 *   deviceName - display name for the header
 */
export default function MikrotikMetricsPanel({ deviceId, deviceName }) {
  const [metrics, setMetrics]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)
  const [lastAt,  setLastAt]    = useState(null)
  const [tab,     setTab]       = useState('interfaces') // interfaces | dhcp | routing

  const [portModal, setPortModal] = useState({ open: false, port: null, enable: false })
  const [portLoading, setPortLoading] = useState(false)

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await metricsService.getMikrotikMetrics(deviceId)
      setMetrics(data)
      setLastAt(new Date())
    } catch (err) {
      const errorMsg = err?.response?.data?.error
      const detailsMsg = err?.response?.data?.details
      
      const msg = errorMsg
        ? `${errorMsg} ${detailsMsg ? `(${detailsMsg})` : ''}`
        : err?.message ?? 'Failed to fetch Mikrotik metrics.'
        
      setError(msg)
      if (!silent) toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(() => fetchMetrics(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const handleTogglePort = (port, enable) => {
    setPortModal({ open: true, port, enable })
  }

  const confirmPortToggle = async () => {
    setPortLoading(true)
    try {
      await api.post(`/api/devices/${deviceId}/config/port`, {
        interface: portModal.port, enable: portModal.enable
      })
      toast.success(`Port ${portModal.port} successfully ${portModal.enable ? 'enabled' : 'disabled'}.`)
      setPortModal({ open: false, port: null, enable: false })
      fetchMetrics(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to change port state')
    } finally {
      setPortLoading(false)
    }
  }

  const res = metrics?.system_resources

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs text-slate-400">
            Mikrotik RouterOS API - Live metrics
            {lastAt && ` � last polled ${lastAt.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={() => fetchMetrics()}
          disabled={loading}
          className="ml-auto flex items-center gap-2 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <strong>Connection Error:</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* System Resource KPIs */}
      {res && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <ResourceCard
            icon={<Cpu size={18} className="text-indigo-500" />}
            label="CPU Load"
            value={`${res['cpu-load'] ?? '?'}%`}
            sub={res['cpu-count'] ? `${res['cpu-count']} cores` : undefined}
            accent="bg-indigo-50"
          />
          <ResourceCard
            icon={<MemoryStick size={18} className="text-emerald-500" />}
            label="Free Memory"
            value={fmtBytes(res['free-memory'])}
            sub={`of ${fmtBytes(res['total-memory'])}`}
            accent="bg-emerald-50"
          />
          <ResourceCard
            icon={<Clock size={18} className="text-amber-500" />}
            label="Uptime"
            value={formatUptime(res['uptime'])}
            accent="bg-amber-50"
          />
          <ResourceCard
            icon={<Network size={18} className="text-slate-500" />}
            label="RouterOS"
            value={res['version']?.split(' ')[0] ?? '?'}
            sub={res['board-name']}
            accent="bg-slate-100"
          />
        </motion.div>
      )}

      {/* Tab navigation */}
      {metrics && !loading && (
        <>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {[
              { id: 'interfaces', label: `Interfaces (${metrics.interfaces?.length ?? 0})` },
              { id: 'dhcp',       label: `DHCP Leases (${metrics.dhcp_leases?.length ?? 0})` },
              { id: 'routing',    label: `Routes (${metrics.routing_table?.length ?? 0})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{   opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'interfaces' && (
                <InterfaceTable interfaces={metrics.interfaces ?? []} vendor="mikrotik" onTogglePort={handleTogglePort} />
              )}
              {tab === 'dhcp' && (
                <DhcpLeasesTable leases={metrics.dhcp_leases ?? []} />
              )}
              {tab === 'routing' && (
                <RoutingTable routes={metrics.routing_table ?? []} />
              )}
            </motion.div>
          </AnimatePresence>

          <ConfigConfirmationModal
            open={portModal.open}
            onOpenChange={(open) => setPortModal(prev => ({ ...prev, open }))}
            deviceName={deviceName}
            actionTitle={`${portModal.enable ? 'Enable' : 'Disable'} Port ${portModal.port}`}
            actionDescription={`This will physically ${portModal.enable ? 'bring up' : 'shut down'} the interface ${portModal.port} on the router.`}
            onConfirm={confirmPortToggle}
            loading={portLoading}
          />
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ResourceCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`${accent} rounded-xl p-4 border border-white/60`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span></div>
      <p className="font-display font-bold text-xl text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function DhcpLeasesTable({ leases }) {
  const columns = [
    { key: 'address', label: 'IP Address', className: 'font-mono font-medium text-slate-800' },
    { key: 'mac-address', label: 'MAC Address', className: 'font-mono text-slate-500' },
    { key: 'host-name', label: 'Host Name', render: (v) => v || <span className="text-slate-400 italic">unknown</span> },
    { key: 'status', label: 'Status', render: (v) => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        v === 'bound' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
      }`}>{v ?? '-'}</span>
    ) },
    { key: 'expires-after', label: 'Expires In', className: 'text-slate-500 text-xs font-mono' }
  ]

  return (
    <DataTable
      columns={columns}
      data={leases}
      emptyMessage="No DHCP leases (or DHCP server not configured)."
      searchPlaceholder="Search leases..."
    />
  )
}

function RoutingTable({ routes }) {
  const columns = [
    { key: 'dst-address', label: 'Destination', className: 'font-mono font-medium text-slate-800' },
    { key: 'gateway', label: 'Gateway', render: (v, r) => v ?? r['pref-src'] ?? '-', className: 'font-mono text-slate-600' },
    { key: 'interface', label: 'Interface', render: (v, r) => r['routing-mark'] || r.interface || '-', className: 'text-slate-600' },
    { key: 'distance', label: 'Distance', className: 'text-slate-500' },
    { key: 'active', label: 'Active', render: (v) => (
      <span className={`text-xs font-bold ${v === 'true' ? 'text-emerald-600' : 'text-slate-400'}`}>
        {v === 'true' ? '✓' : '-'}
      </span>
    ) }
  ]

  return (
    <DataTable
      columns={columns}
      data={routes}
      emptyMessage="No routes found."
      searchPlaceholder="Search routes..."
    />
  )
}

// ── Formatters ───────────────────────────────────────────────────────────────
function fmtBytes(val) {
  if (!val) return '?'
  const n = typeof val === 'string' ? parseInt(val, 10) : val
  if (isNaN(n)) return '?'
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB'
  if (n >= 1_048_576)     return (n / 1_048_576).toFixed(1) + ' MB'
  if (n >= 1_024)         return (n / 1_024).toFixed(0) + ' KB'
  return n + ' B'
}

function formatUptime(val) {
  // RouterOS format: "1w2d3h4m5s" or "1d2h3m4s"
  if (!val) return '?'
  return val.replace(/(\d+)w/, '$1w ').replace(/(\d+)d/, '$1d ').replace(/(\d+)h/, '$1h ').trim()
}
