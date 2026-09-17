import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * DataTable - generic table with search, loading skeleton, and pagination.
 *
 * Props:
 *   columns  - [{ key, label, render?, className? }]
 *   data     - array of row objects
 *   loading  - boolean
 *   searchable - boolean (default true)
 *   searchPlaceholder - string
 *   onSearch - optional external search handler (controlled mode)
 *   emptyMessage - string
 *   actions  - optional column (render per row)
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  emptyMessage = 'No data found.',
  pageSize = 15,
  disablePagination = false,
  maxHeight,
  onRowClick,
}) {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
    onSearch?.(val)
  }

  // Client-side filter (if no onSearch provided)
  let filtered = onSearch ? data : data.filter(row =>
    columns.some(col => {
      if (!col.key) return false
      const val = row[col.key]
      return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase())
    })
  )

  // Client-side sorting
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let valA = a[sortKey]
      let valB = b[sortKey]
      
      if (valA === valB) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortDir === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1)
    })
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paged = disablePagination ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
          />
        </div>
      )}

      {/* Table wrapper - horizontal scroll on small screens */}
      <div 
        className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm"
        style={{ maxHeight: maxHeight ? maxHeight : undefined }}
      >
        <table className="w-full text-sm min-w-[600px]">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
            <tr className="border-b border-slate-200">
              {columns.map(col => (
                <th
                  key={col.key || col.label}
                  onClick={() => col.key && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 ${col.className ?? ''} ${col.key ? 'cursor-pointer hover:bg-slate-100 select-none transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                       <span className="text-indigo-500 font-bold">
                         {sortDir === 'asc' ? '↑' : '↓'}
                       </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr 
                  key={row.id ?? i} 
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 text-slate-700 ${col.className ?? ''}`}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!disablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2">
          <div>
            Showing <span className="font-medium text-slate-700">{((page - 1) * pageSize) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-medium text-slate-700">{filtered.length}</span> entries
          </div>
          <div className="flex items-center gap-1">
            {[
              { icon: <ChevronsLeft size={14}/>, action: () => setPage(1),           disabled: page === 1          },
              { icon: <ChevronLeft  size={14}/>, action: () => setPage(p => p - 1), disabled: page === 1          },
              { icon: <ChevronRight size={14}/>, action: () => setPage(p => p + 1), disabled: page === totalPages },
              { icon: <ChevronsRight size={14}/>,action: () => setPage(totalPages), disabled: page === totalPages },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.disabled}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
