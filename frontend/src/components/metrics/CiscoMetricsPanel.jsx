import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Server, Network, Tag, AlertTriangle, ArrowUp, ArrowDown, Activity, Settings2, List, Plus, Trash2 } from 'lucide-react'
import InterfaceTable from './InterfaceTable'
import { metricsService } from '../../services/metrics.service'
import { toast } from '../../utils/toast'
import ConfigConfirmationModal from '../ui/ConfigConfirmationModal'
import PortConfigModal from '../ui/PortConfigModal'
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
 *   deviceId   - device DB id
 *   deviceName - display name
 */
export default function CiscoMetricsPanel({ deviceId, deviceName }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [lastAt,  setLastAt]  = useState(null)
  const [tab,     setTab]     = useState('status') // status | counters
  
  const [portModal, setPortModal] = useState({ open: false, port: null, enable: false })
  const [portLoading, setPortLoading] = useState(false)

  const [configModal, setConfigModal] = useState({ open: false, port: null, currentName: '', currentVlan: '' })
  const [configLoading, setConfigLoading] = useState(false)

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
    // NOTE: Auto-polling disabled - Cisco metrics use SSH which can block the
    // PHP dev server (single-threaded on Windows). Use the Refresh button instead.
    // const interval = setInterval(() => fetchMetrics(true), REFRESH_INTERVAL_MS)
    // return () => clearInterval(interval)
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

  const handleEditConfig = (port, currentVlan, currentName) => {
    setConfigModal({ open: true, port, currentVlan: currentVlan || '', currentName: currentName || '' })
  }

  const confirmPortConfig = async ({ mode, vlanId, name }) => {
    setConfigLoading(true)
    try {
      await api.post(`/api/devices/${deviceId}/config/port-config`, {
        interface: configModal.port,
        mode,
        vlan_id: mode === 'access' ? vlanId : null,
        name
      })
      toast.success(`Port ${configModal.port} configured successfully.`)
      setConfigModal({ open: false, port: null, currentVlan: '', currentName: '' })
      fetchMetrics(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to configure port')
    } finally {
      setConfigLoading(false)
    }
  }

  const ver = metrics?.version ?? {}

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-400">
          Cisco IOS SSH - Live metrics
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
          <InfoCard icon={<Server size={18} className="text-blue-500" />}   label="Model"       value={ver.model       ?? '-'} accent="bg-blue-50" />
          <InfoCard icon={<Network size={18} className="text-indigo-500" />} label="IOS Version" value={ver.ios_version ?? '-'} accent="bg-indigo-50" />
          <InfoCard icon={<Tag size={18} className="text-amber-500" />}      label="Serial"      value={ver.serial      ?? '-'} accent="bg-amber-50" />
          <InfoCard icon={<AlertTriangle size={18} className="text-slate-500" />} label="Uptime" value={ver.uptime      ?? '-'} accent="bg-slate-100" />
        </motion.div>
      )}

      {/* Tabs */}
      {metrics && !loading && (
        <>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {[
              { id: 'status',   label: `Port Status (${metrics.interface_status?.length ?? 0})` },
              { id: 'counters', label: `Counters (${metrics.interface_detail?.length ?? 0})` },
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
                <div className="space-y-6">
                  <SwitchFrontPanel 
                    interfaces={metrics.interface_status ?? []} 
                    onTogglePort={handleTogglePort}
                    onEditConfig={handleEditConfig}
                  />
                  
                  <div className="pt-6 border-t border-slate-200">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <div className="xl:col-span-2 space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <List size={20} className="text-indigo-500" />
                          Interface Details
                        </h3>
                        <InterfaceStatusTable 
                          interfaces={metrics.interface_status ?? []}
                          onTogglePort={handleTogglePort}
                          onEditConfig={handleEditConfig}
                        />
                      </div>
                      <div className="xl:col-span-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Tag size={20} className="text-indigo-500" />
                            VLANs
                          </h3>
                          <VlanCreateButton deviceId={deviceId} onRefresh={() => fetchMetrics(true)} />
                        </div>
                        <VlanTable vlans={metrics.vlan_brief ?? []} deviceId={deviceId} onRefresh={() => fetchMetrics(true)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {tab === 'counters' && (
                <InterfaceTable interfaces={metrics.interface_detail ?? []} vendor="cisco" />
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

          <PortConfigModal
            open={configModal.open}
            onOpenChange={(open) => setConfigModal(prev => ({ ...prev, open }))}
            portName={configModal.port}
            currentName={configModal.currentName}
            currentVlan={configModal.currentVlan}
            vlans={metrics.vlan_brief ?? []}
            onConfirm={confirmPortConfig}
            loading={configLoading}
          />
        </>
      )}
    </div>
  )
}

// -- Sub-components --

function InfoCard({ icon, label, value, accent }) {
  return (
    <div className={`${accent} rounded-xl p-4 border border-slate-100`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span></div>
      <p className="text-sm font-bold text-slate-800 truncate" title={value}>{value}</p>
    </div>
  )
}

/**
 * SwitchFrontPanel - Physical switch visualization
 */
function SwitchFrontPanel({ interfaces, onTogglePort, onEditConfig }) {
  if (!Array.isArray(interfaces) || !interfaces.length) return null

  // Separate ethernet ports from other types
  const sortedEth = interfaces.filter(p => {
    const port = p?.port?.toLowerCase() || ''
    return port.startsWith('gi') || port.startsWith('fa') || port.startsWith('te')
  })

  const otherPorts = interfaces.filter(p => {
    const port = p?.port?.toLowerCase() || ''
    return !(port.startsWith('gi') || port.startsWith('fa') || port.startsWith('te'))
  })

  // Auto-detect the main port prefix (the one with the most ports)
  const prefixCounts = {}
  sortedEth.forEach(p => {
    const match = p?.port?.match(/^([A-Za-z]+\d+\/\d+\/)/)
    if (match) {
      prefixCounts[match[1]] = (prefixCounts[match[1]] || 0) + 1
    }
  })

  let mainPrefix = null
  let maxCount = 0
  for (const [prefix, count] of Object.entries(prefixCounts)) {
    if (count > maxCount) {
      maxCount = count
      mainPrefix = prefix
    }
  }

  // Separate main access ports (to be rendered in RJ45 blocks) from uplinks (SFP slots)
  const mainPorts = mainPrefix ? sortedEth.filter(p => p?.port?.startsWith(mainPrefix)) : sortedEth
  const uplinkPorts = mainPrefix ? sortedEth.filter(p => p?.port && !p.port.startsWith(mainPrefix)) : []

  const topRow = []
  const bottomRow = []

  mainPorts.forEach((iface, index) => {
    if (index % 2 === 0) {
      topRow.push(iface)
    } else {
      bottomRow.push(iface)
    }
  })

  // Group columns into chunks of 6 (6 top, 6 bottom = 12 ports per block)
  const columns = []
  for (let i = 0; i < Math.max(topRow.length, bottomRow.length); i++) {
    columns.push({
      top: topRow[i],
      bottom: bottomRow[i]
    })
  }

  const chunks = []
  for (let i = 0; i < columns.length; i += 6) {
    chunks.push(columns.slice(i, i + 6))
  }

  return (
    <div className="space-y-6">
      {/* Physical Switch Representation */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto border border-slate-200">
        <div className="min-w-max flex justify-center py-32 px-12">
          
          {/* Switch Chassis (Silver) */}
          <div className="bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 rounded-sm p-3 shadow-xl border-y border-slate-400 flex items-center gap-6 relative">
            
            {/* Left side LEDs / Logo placeholder */}
            <div className="w-16 h-12 border border-slate-400/50 rounded flex flex-col justify-around px-1 opacity-60">
              <div className="h-1 w-full bg-slate-400 rounded-full"></div>
              <div className="h-1 w-full bg-slate-400 rounded-full"></div>
              <div className="h-1 w-full bg-slate-400 rounded-full"></div>
            </div>

            {/* Port Bay (Dark background) */}
            <div className="bg-slate-900 p-2 rounded-sm border-[3px] border-slate-600 shadow-inner inline-flex gap-5">
              {chunks.map((chunk, chunkIdx) => (
                <div key={chunkIdx} className="flex flex-col gap-1.5">
                  {/* Top Row for this chunk */}
                  <div className="flex gap-1">
                    {chunk.map((col, i) => (
                      col.top ? <PhysicalPort key={`t-${i}`} iface={col.top} position="top" onEditConfig={onEditConfig} /> : <div key={`t-empty-${i}`} className="w-10"></div>
                    ))}
                  </div>
                  {/* Bottom Row for this chunk */}
                  <div className="flex gap-1">
                    {chunk.map((col, i) => (
                      col.bottom ? <PhysicalPort key={`b-${i}`} iface={col.bottom} position="bottom" onEditConfig={onEditConfig} /> : <div key={`b-empty-${i}`} className="w-10"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* SFP / Uplink area */}
            <div className="min-w-[6rem] h-16 bg-slate-800 rounded border-[2px] border-slate-500 shadow-inner flex flex-wrap p-1 gap-1">
                {uplinkPorts.length > 0 ? (
                  uplinkPorts.map((iface, i) => (
                    <SfpPort key={i} iface={iface} onEditConfig={onEditConfig} />
                  ))
                ) : (
                  <>
                    <div className="w-10 h-6 bg-black border border-slate-700 rounded-sm"></div>
                    <div className="w-10 h-6 bg-black border border-slate-700 rounded-sm"></div>
                    <div className="w-10 h-6 bg-black border border-slate-700 rounded-sm"></div>
                    <div className="w-10 h-6 bg-black border border-slate-700 rounded-sm"></div>
                  </>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Other interfaces */}
      {otherPorts.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3">Logical Interfaces</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {otherPorts.map((iface, i) => (
              <LogicalPortCard key={i} iface={iface} onEditConfig={onEditConfig} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PhysicalPort({ iface, position, onEditConfig }) {
  const isUp = iface.status === 'connected'
  const isErr = iface.status === 'err-disabled'
  
  const ledClass = isUp ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,1)]' 
                 : isErr ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,1)]' 
                 : 'bg-slate-700 opacity-60'

  const portNum = iface?.port?.match(/\d+$/)?.[0] || '?'

  return (
    <div 
      className="group relative flex flex-col items-center hover:z-[60]"
      onClick={() => onEditConfig(iface.port, iface.vlan, iface.name)}
      role="button"
    >
      {/* RJ45 Port Container (Metal shield look) */}
      <div className={`bg-slate-300 rounded-[3px] p-[2px] w-10 flex flex-col items-center border border-slate-400 transition-colors group-hover:bg-indigo-300 cursor-pointer shadow-sm ${position === 'bottom' ? 'flex-col-reverse' : ''}`}>
        
        {/* LED */}
        <div className="w-full flex justify-center items-center py-[1px]">
          <div className={`w-2 h-1.5 rounded-sm ${ledClass}`}></div>
        </div>

        {/* RJ45 visual (Black hole) */}
        <div className={`w-full h-7 rounded-sm flex flex-col justify-between p-0.5 bg-black border-b-[3px] ${isUp ? 'border-emerald-900/60' : 'border-slate-800/80'} ${position === 'bottom' ? 'rotate-180' : ''}`}>
          <div className="flex justify-center gap-[1px]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-[1px] h-2 bg-amber-500/90"></div>
            ))}
          </div>
          <div className="w-4 h-1.5 mx-auto rounded-t-sm bg-slate-900 border-t border-x border-slate-800"></div>
        </div>
      </div>
      
      {/* Port Number outside the metal shield, on the black bay */}
      <span className={`absolute text-[8px] text-slate-400 font-mono font-bold leading-none ${position === 'top' ? 'bottom-[-10px]' : 'top-[-10px]'}`}>{portNum}</span>

      {/* Tooltip on Hover */}
      <div className={`absolute z-50 ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 border border-slate-700 pointer-events-none`}>
        <p className="font-bold text-indigo-400 mb-1">{iface.port}</p>
        <p className="font-medium text-slate-300 mb-2">{iface.name || <span className="italic text-slate-500">No Description</span>}</p>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className={isUp ? 'text-emerald-400 font-bold' : isErr ? 'text-rose-400 font-bold' : 'text-slate-500'}>{iface.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">VLAN/Mode:</span>
            <span className="text-slate-300 font-mono">{iface.vlan || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Speed:</span>
            <span className="text-slate-300">{iface.speed === 'auto' ? 'Auto' : iface.speed}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SfpPort({ iface, onEditConfig }) {
  const isUp = iface.status === 'connected'
  const isErr = iface.status === 'err-disabled'
  
  return (
    <div 
      className="group relative w-10 h-6 bg-black border border-slate-700 rounded-sm cursor-pointer hover:border-indigo-500 transition-colors flex items-center justify-center"
      onClick={() => onEditConfig(iface.port, iface.vlan, iface.name)}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,1)]' : isErr ? 'bg-rose-500' : 'bg-slate-700'}`}></div>
      
      {/* Tooltip */}
      <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-44 bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 border border-slate-700 pointer-events-none">
        <p className="font-bold text-indigo-400 mb-1">{iface.port}</p>
        <p className="font-medium text-slate-300 mb-2">{iface.name || <span className="italic text-slate-500">No Description</span>}</p>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span className={isUp ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{iface.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">VLAN/Mode:</span>
            <span className="text-slate-300 font-mono">{iface.vlan || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogicalPortCard({ iface, onEditConfig }) {
  const isUp = iface.status === 'connected' || iface.status === 'up'
  return (
    <div 
      className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onEditConfig(iface.port, iface.vlan, iface.name)}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
        <span className="font-mono text-xs font-bold text-slate-800">{iface.port}</span>
      </div>
      <p className="text-[10px] text-slate-500 truncate">{iface.name || 'No description'}</p>
    </div>
  )
}

function VlanCreateButton({ deviceId, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [newVlanId, setNewVlanId] = useState('')
  const [newVlanName, setNewVlanName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newVlanId) return
    setCreating(true)
    try {
      await api.post(`/api/devices/${deviceId}/config/vlan/create`, {
        vlan_id: parseInt(newVlanId, 10),
        name: newVlanName || null,
      })
      toast.success(`VLAN ${newVlanId} berhasil dibuat.`)
      setNewVlanId('')
      setNewVlanName('')
      setShowForm(false)
      onRefresh?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal membuat VLAN.')
    } finally {
      setCreating(false)
    }
  }

  if (!deviceId) return null

  return (
    <div className="relative">
      <button
        onClick={() => setShowForm(prev => !prev)}
        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-1.5 shadow-sm transition"
      >
        <Plus size={14} />
        Tambah VLAN
      </button>

      {/* Dropdown Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="absolute right-0 top-full mt-2 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700">Buat VLAN Baru</p>
          <input
            type="number"
            min="2"
            max="4094"
            placeholder="VLAN ID (2-4094)"
            value={newVlanId}
            onChange={(e) => setNewVlanId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            required
            autoFocus
          />
          <input
            type="text"
            maxLength="32"
            placeholder="Nama VLAN (opsional)"
            value={newVlanName}
            onChange={(e) => setNewVlanName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {creating ? 'Membuat...' : 'Buat VLAN'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewVlanId(''); setNewVlanName('') }}
              className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function VlanTable({ vlans, deviceId, onRefresh }) {
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (vlanId) => {
    if (!confirm(`Yakin ingin menghapus VLAN ${vlanId}?`)) return
    setDeletingId(vlanId)
    try {
      await api.post(`/api/devices/${deviceId}/config/vlan/delete`, { vlan_id: vlanId })
      toast.success(`VLAN ${vlanId} berhasil dihapus.`)
      onRefresh?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus VLAN.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!vlans.length) return <p className="text-sm text-slate-400 py-4 text-center">No VLAN data available.</p>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {['VLAN ID', 'Name', 'Status', 'Ports', ...(deviceId ? [''] : [])].map((h, idx) => (
              <th key={h || `col-${idx}`} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
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
              <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{v.ports || '-'}</td>
              {deviceId && (
                <td className="px-4 py-2.5 text-right">
                  {v.vlan_id > 1 && v.vlan_id < 1002 && (
                    <button
                      onClick={() => handleDelete(v.vlan_id)}
                      disabled={deletingId === v.vlan_id}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                      title={`Hapus VLAN ${v.vlan_id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InterfaceStatusTable({ interfaces, onTogglePort, onEditConfig }) {
  if (!Array.isArray(interfaces) || !interfaces.length) return <p className="text-sm text-slate-400 py-4 text-center">No interface data available.</p>

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
          <tr>
            <th className="px-4 py-3">Port</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">VLAN/Mode</th>
            <th className="px-4 py-3">Duplex</th>
            <th className="px-4 py-3">Speed</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {interfaces.map((iface, i) => {
            if (!iface) return null
            const isUp = iface?.status === 'connected' || iface?.status === 'up'
            const isErr = iface?.status === 'err-disabled'
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-slate-800">{iface?.port}</td>
                <td className="px-4 py-3 max-w-[200px] truncate" title={iface?.name}>{iface?.name || <span className="text-slate-400 italic">No description</span>}</td>
                <td className="px-4 py-3">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                    isUp ? 'bg-emerald-50 text-emerald-600' : isErr ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isUp ? <ArrowUp size={12} strokeWidth={3} /> : isErr ? <AlertTriangle size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
                    {String(iface?.status || 'unknown')}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{iface?.vlan || '-'}</td>
                <td className="px-4 py-3">{iface?.duplex}</td>
                <td className="px-4 py-3">{iface?.speed === 'auto' ? 'Auto' : iface?.speed}</td>
                <td className="px-4 py-3 text-slate-500">{iface?.type}</td>
                <td className="px-4 py-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEditConfig(iface?.port, iface?.vlan, iface?.name)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Edit Port Config"
                  >
                    <Settings2 size={16} />
                  </button>
                  <button
                    onClick={() => onTogglePort(iface?.port, isErr ? true : !isUp)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
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
