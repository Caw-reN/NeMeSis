import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Server, Network, Tag, AlertTriangle } from 'lucide-react'
import InterfaceTable from './InterfaceTable'
import { metricsService } from '../../services/metrics.service'
import { toast } from '../../utils/toast'
import ConfigConfirmationModal from '../ui/ConfigConfirmationModal'
import VlanChangeModal from '../ui/VlanChangeModal'
import api from '../../services/api'

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
  
  const [portModal, setPortModal] = useState({ open: false, port: null, enable: false })
  const [portLoading, setPortLoading] = useState(false)

  const [vlanModal, setVlanModal] = useState({ open: false, port: null, currentVlan: '' })
  const [vlanLoading, setVlanLoading] = useState(false)

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await metricsService.getCiscoMetrics(deviceId)
      setMetrics(data)
      setLastAt(new Date())
    } catch (err) {
      const errorMsg = err?.response?.data?.error
      const detailsMsg = err?.response?.data?.details
      
      const msg = errorMsg
        ? `${errorMsg} ${detailsMsg ? `(${detailsMsg})` : ''}`
        : err?.message ?? 'Failed to fetch Cisco metrics.'
        
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

  const handleEditVlan = (port, currentVlan) => {
    setVlanModal({ open: true, port, currentVlan })
  }

  const confirmVlanChange = async (mode, newVlanId) => {
    setVlanLoading(true)
    try {
      await api.post(`/api/devices/${deviceId}/config/vlan`, {
        interface: vlanModal.port,
        mode: mode,
        vlan_id: mode === 'access' ? newVlanId : null
      })
      
      if (mode === 'trunk') {
        toast.success(`Port ${vlanModal.port} successfully changed to Trunk mode.`)
      } else {
        toast.success(`Port ${vlanModal.port} successfully assigned to VLAN ${newVlanId}.`)
      }
      
      setVlanModal({ open: false, port: null, currentVlan: '' })
      fetchMetrics(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to change port configuration')
    } finally {
      setVlanLoading(false)
    }
  }

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
                <InterfaceStatusTable 
                  interfaces={metrics.interface_status ?? []} 
                  onTogglePort={handleTogglePort}
                  onEditVlan={handleEditVlan}
                />
              )}
              {tab === 'counters' && (
                <InterfaceTable interfaces={metrics.interface_detail ?? []} vendor="cisco" />
              )}
              {tab === 'vlan' && (
                <VlanTable vlans={metrics.vlan_brief ?? []} />
              )}
            </motion.div>
          </AnimatePresence>
          
          <ConfigConfirmationModal
            open={portModal.open}
            onOpenChange={(open) => setPortModal(prev => ({ ...prev, open }))}
            deviceName={deviceName}
            actionTitle={`${portModal.enable ? 'Enable' : 'Disable'} Port ${portModal.port}`}
            actionDescription={`This will physically ${portModal.enable ? 'bring up' : 'shut down'} the interface ${portModal.port} on the switch.`}
            onConfirm={confirmPortToggle}
            loading={portLoading}
          />

          <VlanChangeModal
            open={vlanModal.open}
            onOpenChange={(open) => setVlanModal(prev => ({ ...prev, open }))}
            portName={vlanModal.port}
            currentVlan={vlanModal.currentVlan}
            vlans={metrics.vlan_brief ?? []}
            onConfirm={confirmVlanChange}
            loading={vlanLoading}
          />
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

function InterfaceStatusTable({ interfaces, onTogglePort, onEditVlan }) {
  if (!interfaces.length) return <p className="text-sm text-slate-400 py-4 text-center">No interface status data.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {['Port', 'Name', 'Status', 'VLAN', 'Duplex', 'Speed', 'Type', 'Action'].map(h => (
              <th key={h} className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
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
                <td className="px-4 py-2.5">
                  {iface.vlan && iface.vlan !== 'routed' ? (
                    <button
                      onClick={() => onEditVlan(iface.port, iface.vlan)}
                      className="font-mono text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition"
                      title="Change Port Mode/VLAN"
                    >
                      {iface.vlan}
                    </button>
                  ) : (
                    <span className="font-mono text-slate-600 px-2 py-1">{iface.vlan}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{iface.duplex}</td>
                <td className="px-4 py-2.5 text-slate-500">{iface.speed}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs">{iface.type}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => onTogglePort(iface.port, isErr ? true : !isUp)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isUp ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                    title={isUp ? 'Disable Port' : 'Enable Port'}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isUp ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </td>
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
