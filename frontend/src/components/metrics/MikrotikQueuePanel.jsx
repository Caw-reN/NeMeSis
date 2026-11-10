import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Search, Sliders, Layers, ArrowDown, ArrowUp, ShieldAlert, Activity } from 'lucide-react'

export default function MikrotikQueuePanel({ queuesData, threshold = 90 }) {
  const [queueType, setQueueType] = useState('simple') // 'simple' | 'tree'
  const [search, setSearch]       = useState('')

  const simpleQueues = queuesData?.simple_queues ?? []
  const queueTrees   = queuesData?.queue_trees ?? []

  // Metrics summary
  const summary = useMemo(() => {
    const all = [...simpleQueues, ...queueTrees]
    const total = all.length
    const overloaded = all.filter(q => q.is_overloaded && !q.disabled).length
    const warning = all.filter(q => !q.disabled && !q.is_overloaded && (
      (q.download_usage_percent >= 80 && q.download_usage_percent < threshold) ||
      (q.upload_usage_percent >= 80 && q.upload_usage_percent < threshold) ||
      (q.usage_percent >= 80 && q.usage_percent < threshold)
    )).length
    const normal = total - overloaded - warning - all.filter(q => q.disabled).length

    return { total, overloaded, warning, normal }
  }, [simpleQueues, queueTrees, threshold])

  // Filtered lists
  const filteredSimple = useMemo(() => {
    return simpleQueues.filter(q => {
      const matchSearch = q.name.toLowerCase().includes(search.toLowerCase()) ||
                          (q.target && q.target.toLowerCase().includes(search.toLowerCase())) ||
                          (q.comment && q.comment.toLowerCase().includes(search.toLowerCase()))
      return matchSearch
    })
  }, [simpleQueues, search])

  const filteredTrees = useMemo(() => {
    return queueTrees.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          (t.parent && t.parent.toLowerCase().includes(search.toLowerCase())) ||
                          (t.packet_mark && t.packet_mark.toLowerCase().includes(search.toLowerCase()))
      return matchSearch
    })
  }, [queueTrees, search])

  const renderProgressBar = (percent, isOverloaded) => {
    let color = 'bg-emerald-500'
    let textColor = 'text-emerald-700'
    if (percent >= threshold || isOverloaded) {
      color = 'bg-rose-500'
      textColor = 'text-rose-700 font-bold'
    } else if (percent >= 80) {
      color = 'bg-amber-500'
      textColor = 'text-amber-700 font-semibold'
    }

    return (
      <div className="w-full space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-mono text-slate-500 text-[11px]">{Math.min(percent, 100)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percent, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${color} ${percent >= threshold ? 'animate-pulse' : ''}`}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Critical Overload Banner */}
      {summary.overloaded > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-800 shadow-sm"
        >
          <div className="p-2 rounded-lg bg-rose-100 text-rose-600 animate-bounce">
            <ShieldAlert size={20} />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-rose-900">
              Peringatan: {summary.overloaded} Antrean MikroTik Mengalami Overload / Buffer Penuh!
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              Trafik telah mencapai ambang batas $\ge {threshold}\%$ atau terdeteksi adanya paket yang dibuang (*packet drops*). Notifikasi otomatis dikirimkan ke Telegram Bot.
            </p>
          </div>
        </motion.div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
            <Layers size={14} /> Total Queues
          </div>
          <p className="text-2xl font-bold text-slate-900 font-display">{summary.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Simple ({simpleQueues.length}) + Tree ({queueTrees.length})</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium uppercase tracking-wider mb-1">
            <CheckCircle2 size={14} /> Normal
          </div>
          <p className="text-2xl font-bold text-emerald-900 font-display">{summary.normal}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Beban &lt; 80%</p>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3">
          <div className="flex items-center gap-2 text-amber-700 text-xs font-medium uppercase tracking-wider mb-1">
            <Activity size={14} /> Warning
          </div>
          <p className="text-2xl font-bold text-amber-900 font-display">{summary.warning}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">Beban 80% - {threshold - 1}%</p>
        </div>

        <div className={`rounded-xl p-3 border ${summary.overloaded > 0 ? 'bg-rose-100/80 border-rose-300' : 'bg-slate-50 border-slate-200/80'}`}>
          <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider mb-1 ${summary.overloaded > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            <AlertTriangle size={14} /> Overload
          </div>
          <p className={`text-2xl font-bold font-display ${summary.overloaded > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {summary.overloaded}
          </p>
          <p className={`text-[11px] mt-0.5 ${summary.overloaded > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
            Beban $\ge {threshold}\%$ / Drops
          </p>
        </div>
      </div>

      {/* Controls: Type Switcher + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setQueueType('simple')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              queueType === 'simple'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Simple Queues ({simpleQueues.length})
          </button>
          <button
            onClick={() => setQueueType('tree')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              queueType === 'tree'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Queue Tree ({queueTrees.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari antrean ${queueType === 'simple' ? 'atau IP...' : '...'}`}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
          />
        </div>
      </div>

      {/* Table: Simple Queue */}
      {queueType === 'simple' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Antrean</th>
                  <th className="py-3 px-4">Target IP / Subnet</th>
                  <th className="py-3 px-4 w-44">
                    <span className="flex items-center gap-1"><ArrowDown size={12} className="text-blue-500" /> Download Rate</span>
                  </th>
                  <th className="py-3 px-4 w-44">
                    <span className="flex items-center gap-1"><ArrowUp size={12} className="text-emerald-500" /> Upload Rate</span>
                  </th>
                  <th className="py-3 px-4 text-center">Drops</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSimple.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      Tidak ada Simple Queue yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredSimple.map((q) => {
                    const totalDrops = q.download_dropped + q.upload_dropped
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                        Normal
                      </span>
                    )

                    if (q.disabled) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                          Disabled
                        </span>
                      )
                    } else if (q.is_overloaded) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                          <AlertTriangle size={12} /> OVERLOAD
                        </span>
                      )
                    } else if (q.download_usage_percent >= 80 || q.upload_usage_percent >= 80) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                          Warning
                        </span>
                      )
                    }

                    return (
                      <tr
                        key={q.id || q.name}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          q.is_overloaded ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{q.name}</div>
                          {q.comment && <div className="text-[11px] text-slate-400 italic mt-0.5">{q.comment}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {q.target || <span className="text-slate-400">all</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[11px] font-medium text-slate-700 mb-1">
                            {q.download_rate_formatted} <span className="text-slate-400">/ {q.download_max_formatted}</span>
                          </div>
                          {renderProgressBar(q.download_usage_percent, q.is_download_overloaded)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[11px] font-medium text-slate-700 mb-1">
                            {q.upload_rate_formatted} <span className="text-slate-400">/ {q.upload_max_formatted}</span>
                          </div>
                          {renderProgressBar(q.upload_usage_percent, q.is_upload_overloaded)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {totalDrops > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                              {totalDrops}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {statusBadge}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table: Queue Tree */}
      {queueType === 'tree' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Tree</th>
                  <th className="py-3 px-4">Parent</th>
                  <th className="py-3 px-4">Packet Mark</th>
                  <th className="py-3 px-4 w-52">Trafik / Max Limit</th>
                  <th className="py-3 px-4 text-center">Drops</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      Tidak ada Queue Tree yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredTrees.map((t) => {
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                        Normal
                      </span>
                    )

                    if (t.disabled) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                          Disabled
                        </span>
                      )
                    } else if (t.is_overloaded) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 animate-pulse">
                          <AlertTriangle size={12} /> OVERLOAD
                        </span>
                      )
                    } else if (t.usage_percent >= 80) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                          Warning
                        </span>
                      )
                    }

                    return (
                      <tr
                        key={t.id || t.name}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          t.is_overloaded ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{t.name}</div>
                          {t.comment && <div className="text-[11px] text-slate-400 italic mt-0.5">{t.comment}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {t.parent}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {t.packet_mark || <span className="text-slate-400 italic">none</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-[11px] font-medium text-slate-700 mb-1">
                            {t.rate_formatted} <span className="text-slate-400">/ {t.max_limit_formatted}</span>
                          </div>
                          {renderProgressBar(t.usage_percent, t.is_overloaded)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {t.dropped > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                              {t.dropped}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {statusBadge}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

