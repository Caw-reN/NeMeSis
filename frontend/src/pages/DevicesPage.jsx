import { useEffect, useState, useMemo } from 'react'
import { motion }    from 'framer-motion'
import { Plus, Pencil, Trash2, RefreshCw, ExternalLink, Server, Wifi, AlertCircle, Activity, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DataTable     from '../components/ui/DataTable'
import StatusBadge   from '../components/ui/StatusBadge'
import DeviceTypeIcon from '../components/ui/DeviceTypeIcon'
import Modal         from '../components/ui/Modal'
import DeviceModal   from '../components/ui/DeviceModal'
import { devicesService }  from '../services/devices.service'
import { toast }     from '../utils/toast'
import { formatLatency, timeAgo, vendorLabel, typeLabel } from '../utils/helpers'

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget]     = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'infrastructure', 'access_points'
  const [search, setSearch] = useState('')

  const fetchDevices = () => {
    setLoading(true)
    devicesService.getAll({ per_page: 500 }) // increase per_page if there are many
      .then(d => setDevices(d.data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchDevices, [])

  // Metrics calculation
  const metrics = useMemo(() => {
    return {
      total: devices.length,
      infrastructure: devices.filter(d => d.device_role === 'infrastructure').length,
      accessPoints: devices.filter(d => d.device_role === 'end_user' || d.type === 'ap').length, // Fallback for 'ap'
      down: devices.filter(d => d.status === 'down').length,
    }
  }, [devices])

  // Filtered Data for table
  const filteredDevices = useMemo(() => {
    let result = devices;
    if (activeTab === 'infrastructure') {
      result = result.filter(d => d.device_role === 'infrastructure')
    } else if (activeTab === 'access_points') {
      result = result.filter(d => d.device_role === 'end_user' || d.type === 'ap')
    }

    if (search.trim()) {
      const s = search.toLowerCase()
      result = result.filter(d => 
        (d.name && d.name.toLowerCase().includes(s)) ||
        (d.ip_address && d.ip_address.toLowerCase().includes(s)) ||
        (d.type && d.type.toLowerCase().includes(s)) ||
        (d.vendor && d.vendor.toLowerCase().includes(s))
      )
    }

    return result
  }, [devices, activeTab, search])

  // Group by type
  const groupedDevices = useMemo(() => {
    const groups = {}
    filteredDevices.forEach(d => {
      const t = d.type || 'other'
      if (!groups[t]) groups[t] = []
      groups[t].push(d)
    })
    
    // Define preferred order
    const TYPE_ORDER = ['router', 'switch', 'firewall', 'server', 'ap', 'other']

    // Sort keys based on preferred order, fallback to alphabetical
    return Object.keys(groups).sort((a, b) => {
      const indexA = TYPE_ORDER.indexOf(a)
      const indexB = TYPE_ORDER.indexOf(b)
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return a.localeCompare(b)
    }).reduce((acc, key) => {
      acc[key] = groups[key]
      return acc
    }, {})
  }, [filteredDevices])

  // Open Add modal
  const openAdd = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  // Open Edit modal
  const openEdit = (device) => {
    setEditTarget(device)
    setModalOpen(true)
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await devicesService.remove(deleteTarget.id)
      toast.success(`Device "${deleteTarget.name}" deleted.`)
      setDeleteTarget(null)
      fetchDevices()
    } catch {/* handled by interceptor */}
  }

  const columns = [
    {
      key: 'name', label: 'Device',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <DeviceTypeIcon type={row.type} size={15} className="text-slate-600" />
          </div>
          <div>
            <span
              className="font-semibold text-slate-900 text-sm group-hover:text-indigo-600 transition flex items-center gap-1 group cursor-pointer"
            >
              {row.name}
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition" />
            </span>
            <p className="text-xs text-slate-400 font-mono">{row.ip_address || 'No IP'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type / Vendor',
      render: (_, row) => (
        <div>
          <p className="text-sm text-slate-700 capitalize">{typeLabel(row.type)}</p>
          <p className="text-xs text-slate-400">{vendorLabel(row.vendor)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'latency_ms', label: 'Latency',
      render: (v) => <span className="text-sm font-mono text-slate-600">{formatLatency(v)}</span>,
    },
    {
      key: 'last_seen_at', label: 'Last Seen',
      render: (v) => <span className="text-sm text-slate-500">{timeAgo(v)}</span>,
    },
    {
      key: 'id', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button 
            onClick={(e) => { e.stopPropagation(); openEdit(row); }} 
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Pencil size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }} 
            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-16',
    },
  ]

  const TABS = [
    { id: 'all', label: 'All Devices', count: metrics.total },
    { id: 'infrastructure', label: 'Infrastructure', count: metrics.infrastructure },
    { id: 'access_points', label: 'Access Points', count: metrics.accessPoints },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-900">Device Management</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor and manage all network devices in your infrastructure.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchDevices} className="flex items-center gap-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-xl px-4 py-2 hover:bg-slate-50 transition shadow-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-500' : ''} /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl px-4 py-2 transition shadow-sm shadow-zinc-200">
            <Plus size={16} /> Add Device
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={<Server size={20} className="text-indigo-500" />} 
          title="Total Devices" 
          value={metrics.total} 
          bgClass="bg-indigo-50"
          loading={loading}
        />
        <MetricCard 
          icon={<Activity size={20} className="text-emerald-500" />} 
          title="Infrastructure" 
          value={metrics.infrastructure} 
          bgClass="bg-emerald-50"
          loading={loading}
        />
        <MetricCard 
          icon={<Wifi size={20} className="text-sky-500" />} 
          title="Access Points" 
          value={metrics.accessPoints} 
          bgClass="bg-sky-50"
          loading={loading}
        />
        <MetricCard 
          icon={<AlertCircle size={20} className="text-rose-500" />} 
          title="Offline" 
          value={metrics.down} 
          bgClass="bg-rose-50"
          loading={loading}
        />
      </div>

      {/* Tabs & Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Tabs Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-2 bg-slate-50/50">
          <div className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === tab.id ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-200/60"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {loading ? (
                      <span className={`block w-4 h-3.5 rounded-sm animate-pulse ${
                        activeTab === tab.id ? 'bg-indigo-300/50' : 'bg-slate-300/60'
                      }`} />
                    ) : tab.count}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-64 mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search all devices..." 
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table Content - Grouped by Type */}
        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          {loading ? (
             <>
               {[1, 2].map((i) => (
                 <div key={i} className="space-y-4">
                   <div className="flex items-center gap-2 px-1">
                     <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
                     <div className="h-5 w-24 bg-slate-200 animate-pulse rounded-md" />
                     <div className="h-5 w-6 bg-slate-200 animate-pulse rounded-md ml-2" />
                   </div>
                   <DataTable columns={columns} data={[]} loading={true} disablePagination={true} />
                 </div>
               ))}
             </>
          ) : filteredDevices.length === 0 ? (
             <div className="text-center py-12">
               <p className="text-slate-500 text-sm">No {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} found.</p>
             </div>
          ) : (
            Object.entries(groupedDevices).map(([type, devicesInGroup]) => (
              <div key={type} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                     <DeviceTypeIcon type={type} size={16} className="text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 capitalize text-lg">{typeLabel(type)}</h3>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md ml-2">
                    {devicesInGroup.length}
                  </span>
                </div>
                
                <DataTable
                  columns={columns}
                  data={devicesInGroup}
                  loading={false}
                  searchable={false}
                  disablePagination={true}
                  maxHeight="340px"
                  onRowClick={(row) => navigate(`/devices/${row.id}`)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <DeviceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
        onSuccess={fetchDevices}
      />

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Device?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete <strong className="text-slate-900">{deleteTarget?.name}</strong>?
          This will also remove all its logs and topology links.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 shadow-sm shadow-rose-200 transition">
            Delete
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}

function MetricCard({ icon, title, value, bgClass, loading }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-0.5">{title}</p>
        {loading ? (
          <div className="h-7 w-12 bg-slate-200 animate-pulse rounded-md mt-1"></div>
        ) : (
          <p className="text-2xl font-display font-bold text-slate-900 leading-none">{value}</p>
        )}
      </div>
    </div>
  )
}
