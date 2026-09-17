import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Clock, Activity, HardDrive, Network, RefreshCw, ArrowDown, ArrowUp, AlertTriangle, Download, Upload, Cpu, MemoryStick } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { metricsService } from '../../services/metrics.service'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes >= 1024 * 1024)        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024)               return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, children, color = 'indigo' }) {
  const iconColors = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    amber:  'text-amber-600  bg-amber-50',
    rose:   'text-rose-600   bg-rose-50',
    sky:    'text-sky-600    bg-sky-50',
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColors[color]}`}>
          <Icon size={18} />
        </div>
        <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  )
}

function GaugeBar({ value, max = 100, colorClass = 'bg-indigo-500', showValue = true }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const dangerClass = pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : colorClass
  return (
    <div className="space-y-1.5">
      {showValue && (
        <div className="flex justify-between text-xs font-mono text-slate-500">
          <span>{value.toFixed(1)}%</span>
          <span className={pct > 90 ? 'text-rose-600 font-semibold' : pct > 75 ? 'text-amber-600' : ''}>
            {pct > 90 ? '⚠ High' : pct > 75 ? 'Moderate' : 'Normal'}
          </span>
        </div>
      )}
      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${dangerClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function CircularProgress({ value, color = "indigo", size = 220, label = "used" }) {
  const radius = 50;
  const strokeWidth = 6;
  // Maximize radius inside the 100x100 viewBox
  const normalizedRadius = radius - strokeWidth / 2 - 1; 
  const circumference = normalizedRadius * 2 * Math.PI;
  const pct = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  
  const colors = {
    indigo: 'text-indigo-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    rose: 'text-rose-500',
  }
  
  const dangerColor = pct > 85 ? 'text-rose-500' : colors[color];

  // Calculate dot position (SVG is rotated -90deg, so 0 is right, which becomes top)
  const angle = (pct / 100) * 360;
  const angleRad = (angle * Math.PI) / 180;
  const dotX = 50 + normalizedRadius * Math.cos(angleRad);
  const dotY = 50 + normalizedRadius * Math.sin(angleRad);

  return (
    <div style={{ width: size, height: size }} className="relative flex items-center justify-center mx-auto my-6">
      <svg height={size} width={size} viewBox="0 0 100 100" className="rotate-[-90deg] overflow-visible">
        {/* Background track */}
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx="50"
          cy="50"
          className="text-slate-100"
        />
        {/* Progress arc */}
        <circle
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx="50"
          cy="50"
          className={dangerColor}
        />
        {/* Dot at the tip */}
        <circle
          cx={dotX}
          cy={dotY}
          r={strokeWidth}
          fill="currentColor"
          className={dangerColor}
          style={{ transition: 'cx 1s cubic-bezier(0.4, 0, 0.2, 1), cy 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      
      {/* Center text */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-sm uppercase font-bold tracking-wider text-slate-400 mb-0.5">{label}</span>
        <span className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
          {pct.toFixed(0)}<span className="text-lg text-slate-400 font-medium">%</span>
        </span>
      </div>
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export default function VpsMetricsPanel({ deviceId, deviceName }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchMetrics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await metricsService.getVpsMetrics(deviceId)
      setData(res)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.hint || err.message || 'Failed to load VPS metrics')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(() => fetchMetrics(true), 10_000) // auto-refresh every 10s
    return () => clearInterval(interval)
  }, [fetchMetrics])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm">Fetching server metrics…</p>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
          <AlertTriangle size={24} className="text-amber-500" />
        </div>
        <p className="text-sm font-medium text-slate-600">No metrics available yet</p>
        <p className="text-xs text-center max-w-xs text-slate-400">{error}</p>
        <button
          onClick={() => fetchMetrics()}
          className="mt-2 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <RefreshCw size={14} /> Try Again
        </button>
      </div>
    )
  }

  if (!data) return null

  const { system, cpu, memory, disks, network } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-base">{deviceName}</h3>
          {system?.os_descr && (
            <p className="text-xs text-slate-400 mt-0.5 font-mono truncate max-w-sm" title={system.os_descr}>
              {system.os_descr}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-slate-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchMetrics()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Info Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Hostname', value: system?.hostname || '—', icon: Server, color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Uptime',   value: system?.uptime_human || '—', icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'IP Address', value: data.ip_address, icon: Network, color: 'text-sky-500', bg: 'bg-sky-50' },
          { label: 'Total Download', value: formatBytes(network ? network.reduce((sum, net) => sum + (net.rx_bytes || 0), 0) : 0), icon: Download, color: 'text-sky-500', bg: 'bg-sky-50' },
          { label: 'Total Upload',   value: formatBytes(network ? network.reduce((sum, net) => sum + (net.tx_bytes || 0), 0) : 0), icon: Upload, color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Last Polled',   value: system ? new Date(data.polled_at).toLocaleTimeString() : '—', icon: RefreshCw, color: 'text-slate-500', bg: 'bg-slate-100' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={14} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-700 font-mono truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CPU + RAM + Disk */}
      <div className={data.disk && data.disk.total_gb > 0 ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {/* CPU */}
        <StatCard icon={Cpu} label="CPU Usage" color="indigo">
          <div className="space-y-3">
            <CircularProgress value={cpu?.used_pct ?? 0} color="indigo" label="CPU" />
            
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-100/50 mt-1">
              {[
                { label: 'User',   val: cpu?.user_pct,   color: 'text-indigo-600' },
                { label: 'System', val: cpu?.system_pct, color: 'text-purple-600' },
                { label: 'Idle',   val: cpu?.idle_pct,   color: 'text-slate-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-sm font-bold tabular-nums ${color}`}>{(val ?? 0).toFixed(1)}%</p>
                  <p className="text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </StatCard>

        {/* RAM */}
        <StatCard icon={MemoryStick} label="Memory" color="emerald">
          <div className="space-y-3">
            <CircularProgress value={memory?.used_pct ?? 0} color="emerald" label="RAM" />

            <div className="text-center mb-2 -mt-2 text-xs text-slate-500">
              {memory?.used_mb ?? 0} / {memory?.total_mb ?? 0} MB
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100/50 mt-1">
              {[
                { label: 'Used',   val: `${memory?.used_mb ?? 0}MB`,  color: 'text-emerald-700' },
                { label: 'Free',   val: `${Math.round((memory?.free_kb ?? 0) / 1024)}MB`, color: 'text-slate-500' },
                { label: 'Cached', val: `${Math.round((memory?.cached_kb ?? 0) / 1024)}MB`, color: 'text-sky-600' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-sm font-bold tabular-nums ${color}`}>{val}</p>
                  <p className="text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </StatCard>

        {/* Disk */}
        {data.disk && data.disk.total_gb > 0 && (
          <StatCard icon={HardDrive} label={`Disk (${data.disk.partitions} part)`} color="amber">
            <div className="space-y-3">
              <CircularProgress value={data.disk.used_pct ?? 0} color="amber" label="Disk" />

              <div className="text-center mb-2 -mt-2 text-xs text-slate-500">
                {data.disk.used_gb} / {data.disk.total_gb} GB
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-100/50 mt-1">
                {[
                  { label: 'Used',  val: `${data.disk.used_gb} GB`,  color: 'text-amber-700' },
                  { label: 'Free',  val: `${data.disk.free_gb} GB`,  color: 'text-slate-500' },
                  { label: 'Total', val: `${data.disk.total_gb} GB`, color: 'text-slate-700' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-sm font-bold tabular-nums ${color}`}>{val}</p>
                    <p className="text-[10px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </StatCard>
        )}
      </div>

      {/* 24 Hour History Charts */}
      {/* 24 Hour History Charts */}
      {data.history && data.history.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CPU Chart */}
          <StatCard icon={Clock} label="CPU History (24h)" color="indigo">
            <div className="h-48 mt-2 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGradientBottom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800 text-white text-xs px-2 py-1.5 rounded shadow-lg font-mono">
                            {payload[0].payload.time} — CPU {payload[0].value}%
                          </div>
                        )
                      }
                      return null
                    }}
                    isAnimationActive={false}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2} fill="url(#cpuGradientBottom)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>

          {/* RAM Chart */}
          <StatCard icon={Clock} label="Memory History (24h)" color="emerald">
            <div className="h-48 mt-2 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ramGradientBottom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800 text-white text-xs px-2 py-1.5 rounded shadow-lg font-mono">
                            {payload[0].payload.time} — RAM {payload[0].value}%
                          </div>
                        )
                      }
                      return null
                    }}
                    isAnimationActive={false}
                  />
                  <Area type="monotone" dataKey="ram" stroke="#10b981" strokeWidth={2} fill="url(#ramGradientBottom)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>

          {/* Network Chart */}
          <StatCard icon={Clock} label="Network Traffic (24h)" color="sky">
            <div className="h-48 mt-2 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => `${val} MB/s`}
                  />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-800 text-white text-xs px-2 py-1.5 rounded shadow-lg font-mono flex flex-col gap-1">
                            <span>{payload[0].payload.time}</span>
                            <span className="text-sky-300">RX: {payload[0].payload.rx} MB/s</span>
                            <span className="text-amber-300">TX: {payload[0].payload.tx} MB/s</span>
                          </div>
                        )
                      }
                      return null
                    }}
                    isAnimationActive={false}
                  />
                  <Area type="monotone" dataKey="rx" stroke="#0ea5e9" strokeWidth={2} fill="url(#rxGradient)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={2} fill="url(#txGradient)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </StatCard>
        </div>
      )}

      {/* No disk / network data fallback */}
      {(!data.disk || data.disk.total_gb === 0) && (!network || network.length === 0) && (
        <div className="text-center py-6 text-slate-400 text-sm">
          <p>Disk and network data not available.</p>
          <p className="text-xs mt-1">Make sure snmpd is configured with full HOST-RESOURCES-MIB and IF-MIB access.</p>
        </div>
      )}
    </div>
  )
}
