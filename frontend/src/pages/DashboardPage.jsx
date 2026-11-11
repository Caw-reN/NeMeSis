import { useEffect, useState } from 'react'
import { motion }  from 'framer-motion'
import { Monitor, CheckCircle2, XCircle, HelpCircle, TrendingUp, AlertTriangle, Clock, Server, Globe } from 'lucide-react'
import StatCard    from '../components/ui/StatCard'
import { dashboardService } from '../services/dashboard.service'
import { timeAgo }  from '../utils/helpers'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardService.getSummary()
      .then(setData)
      .finally(() => setLoading(false))

    // Auto-refresh every 60s
    const id = setInterval(() => dashboardService.getSummary().then(setData), 60_000)
    return () => clearInterval(id)
  }, [])

  const s = data?.summary

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* Internet Down Alert Banner */}
      {s?.internet?.status === 'down' && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-rose-900">Peringatan: Koneksi Internet / Uplink Terputus!</h3>
            <p className="text-xs text-rose-700 mt-0.5">
              Server NMS mendeteksi 100% packet loss ke target publik ({s.internet.target || '8.8.8.8'}). Periksa uplink ISP atau modem gateway Anda.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            index={0}
            label="Total Devices"
            value={s?.total_devices ?? 0}
            icon={<Monitor size={22} />}
            accent="bg-indigo-50"
            iconColor="text-indigo-500"
            loading={loading}
          />
          <StatCard
            index={1}
            label="Devices UP"
            value={s?.up_devices ?? 0}
            icon={<CheckCircle2 size={22} />}
            accent="bg-emerald-50"
            iconColor="text-emerald-500"
            sub="Reachable & responding"
            loading={loading}
          />
          <StatCard
            index={2}
            label="Devices DOWN"
            value={s?.down_devices ?? 0}
            icon={<XCircle size={22} />}
            accent="bg-rose-50"
            iconColor="text-rose-500"
            sub="No ICMP response"
            loading={loading}
          />
          <StatCard
            index={3}
            label="Uptime"
            value={`${s?.uptime_percent ?? 0}%`}
            icon={<TrendingUp size={22} />}
            accent="bg-amber-50"
            iconColor="text-amber-500"
            sub={s?.unknown_devices ? `${s.unknown_devices} unknown` : undefined}
            loading={loading}
          />
          <StatCard
            index={4}
            label="Internet / WAN"
            value={
              s?.internet?.status === 'up'
                ? 'ONLINE'
                : s?.internet?.status === 'down'
                ? 'OFFLINE'
                : 'CHECKING'
            }
            icon={<Globe size={22} />}
            accent={
              s?.internet?.status === 'up'
                ? 'bg-sky-50'
                : s?.internet?.status === 'down'
                ? 'bg-rose-50'
                : 'bg-slate-50'
            }
            iconColor={
              s?.internet?.status === 'up'
                ? 'text-sky-500'
                : s?.internet?.status === 'down'
                ? 'text-rose-500'
                : 'text-slate-400'
            }
            sub={
              s?.internet?.status === 'up'
                ? `${s.internet.latency_ms} ms (${s.internet.target})`
                : s?.internet?.status === 'down'
                ? '100% loss / RTO'
                : 'Menunggu scan'
            }
            loading={loading}
          />
        </div>
      </section>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-rose-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">Recent Alerts</h2>
            <span className="ml-auto text-xs text-slate-400">Last 24 hours</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (data?.recent_alerts?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mb-2 text-emerald-400" />
              <p className="text-sm font-medium">All clear - no alerts in the last 24 hours.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.recent_alerts.map((alert, i) => (
                <li key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${alert.is_queue ? 'bg-amber-50/70 border-amber-200' : 'bg-rose-50 border-rose-100'}`}>
                  {alert.is_queue ? (
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                      <span>{alert.device_name}</span>
                      <span className="font-normal text-slate-500 text-xs">({alert.ip_address})</span>
                      {alert.is_queue && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
                          QUEUE
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{alert.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-auto">{alert.time}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Devices by Type */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Server size={18} className="text-blue-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">Devices by Type</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {data?.devices_by_type?.map((item, idx) => {
                const colors = [
                  { bg: 'bg-blue-100', text: 'text-blue-600', blob: 'bg-blue-400' },
                  { bg: 'bg-emerald-100', text: 'text-emerald-600', blob: 'bg-emerald-400' },
                  { bg: 'bg-purple-100', text: 'text-purple-600', blob: 'bg-purple-400' },
                  { bg: 'bg-amber-100', text: 'text-amber-600', blob: 'bg-amber-400' },
                  { bg: 'bg-rose-100', text: 'text-rose-600', blob: 'bg-rose-400' },
                  { bg: 'bg-cyan-100', text: 'text-cyan-600', blob: 'bg-cyan-400' },
                ];
                const color = colors[idx % colors.length];

                return (
                  <motion.div
                    key={item.type}
                    whileHover={{ scale: 1.03, y: -2 }}
                    className="relative group flex flex-col p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-default"
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm border border-slate-100/50 ${color.bg}`}>
                        {item.icon_svg ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={color.text}>
                            <g dangerouslySetInnerHTML={{ __html: item.icon_svg }} />
                          </svg>
                        ) : (
                          <Server size={20} className={color.text} />
                        )}
                      </div>
                      <span className="font-display text-2xl font-black text-slate-800">
                        {item.count}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors" title={item.label}>{item.label}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* System Info */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-indigo-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">System Status</h2>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Last Scan',          value: s?.last_scan_at ? timeAgo(s.last_scan_at) : 'Never' },
              { label: 'SNMP Devices',        value: loading ? '…' : s?.snmp_devices ?? 0 },
              { label: 'Unknown Devices',     value: loading ? '…' : s?.unknown_devices ?? 0 },
              { label: 'Scanner',             value: 'Go Worker - Active' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="text-sm font-semibold text-slate-800">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  )
}
