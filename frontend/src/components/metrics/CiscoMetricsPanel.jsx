import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Server, Network, Tag, AlertTriangle } from 'lucide-react'
import InterfaceTable from './InterfaceTable'
import { metricsService } from '../../services/metrics.service'
import { toast } from '../../utils/toast'

const REFRESH_INTERVAL_MS = 30_000

/**
 * CiscoMetricsPanel
 *
 * Displays:
 * - Device version info (IOS version, model, uptime, serial)
 * - Interface status table (from 'show interfaces status')
 * - Interface detail/counters (from 'show interfaces')
 * - VLAN table (from 'show vlan brief')
 *
 * Props:
 *   deviceId   — device DB id
 *   deviceName — display name
 */
export default function CiscoMetricsPanel({ deviceId, deviceName }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [lastAt,  setLastAt]  = useState(null)
  const [tab,     setTab]     = useState('status') // status | counters | vlan

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await metricsService.getCiscoMetrics(deviceId)
      setMetrics(data)
      setLastAt(new Date())
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to fetch Cisco metrics.'
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

  const ver = metrics?.version ?? {}

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-400">
          Cisco IOS SSH — Live metrics
          {lastAt && ` · last polled ${lastAt.toLocaleTimeString()}`}
        </p>
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

      {/* Version KPIs */}
      {!loading && metrics && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <InfoCard icon={<Server size={18} className="text-blue-500" />}   label="Model"       value={ver.model       ?? '—'} accent="bg-blue-50" />
          <InfoCard icon={<Network size={18} className="text-indigo-500" />} label="IOS Version" value={ver.ios_version ?? '—'} accent="bg-indigo-50" />
          <InfoCard icon={<Tag size={18} className="text-amber-500" />}      label="Serial"      value={ver.serial      ?? '—'} accent="bg-amber-50" />
          <InfoCard icon={<AlertTriangle size={18} className="text-slate-500" />} label="Uptime" value={ver.uptime      ?? '—'} accent="bg-slate-100" />
        </motion.div>
      )}

      {/* Tabs */}
      {metrics && !loading && (
        <>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {[
              { id: 'status',   label: `Port Status (${metrics.interface_status?.length ?? 0})` },
              { id: 'counters', label: `Counters (${metrics.interface_detail?.length ?? 0})` },
              { id: 'vlan',     label: `VLANs (${metrics.vlan_brief?.length ?? 0})` },
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
              {tab === 'status' && (
                <InterfaceStatusTable interfaces={metrics.interface_status ?? []} />
              )}
              {tab === 'counters' && (
                <InterfaceTable interfaces={metrics.interface_detail ?? []} vendor="cisco" />
              )}
              {tab === 'vlan' && (
                <VlanTable vlans={metrics.vlan_brief ?? []} />
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InfoCard({ icon, label, value, accent }) {
  return (
    <div className={`${accent} rounded-xl p-4 border border-white/60`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span></div>
      <p className="font-display font-bold text-base text-slate-900 leading-tight truncate" title={value}>{value}</p>
    </div>
  )
}

function InterfaceStatusTable({ interfaces }) {
  if (!interfaces.length) return <p className="text-sm text-slate-400 py-4 text-center">No interface status data.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {['Port', 'Name', 'Status', 'VLAN', 'Duplex', 'Speed', 'Type'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {interfaces.map((iface, i) => {
            const isUp = iface.status === 'connected'
            const isErr = iface.status === 'err-disabled'
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">{iface.port}</td>
                <td className="px-4 py-2.5 text-slate-500">{iface.name || <span className="italic text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isUp  ? 'bg-emerald-100 text-emerald-700' :
                    isErr ? 'bg-rose-100 text-rose-700' :
                             'bg-slate-100 text-slate-500'
                  }`}>
                    {iface.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-600">{iface.vlan}</td>
                <td className="px-4 py-2.5 text-slate-500">{iface.duplex}</td>
                <td className="px-4 py-2.5 text-slate-500">{iface.speed}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{iface.type}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function VlanTable({ vlans }) {
  if (!vlans.length) return <p className="text-sm text-slate-400 py-4 text-center">No VLAN data available.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {['VLAN ID', 'Name', 'Status', 'Ports'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vlans.map((v, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">{v.vlan_id}</td>
              <td className="px-4 py-2.5 text-slate-700">{v.name}</td>
              <td className="px-4 py-2.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  v.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{v.status}</span>
              </td>
              <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{v.ports || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
