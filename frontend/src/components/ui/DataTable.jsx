import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * DataTable — generic table with search, loading skeleton, and pagination.
 *
 * Props:
 *   columns  — [{ key, label, render?, className? }]
 *   data     — array of row objects
 *   loading  — boolean
 *   searchable — boolean (default true)
 *   searchPlaceholder — string
 *   onSearch — optional external search handler (controlled mode)
 *   emptyMessage — string
 *   actions  — optional column (render per row)
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
}) {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)

  const handleSearch = (val) => {
    setSearch(val)
    setPage(1)
    onSearch?.(val)
  }

  // Client-side filter (if no onSearch provided)
  const filtered = onSearch ? data : data.filter(row =>
    columns.some(col => {
      const val = row[col.key]
      return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase())
    })
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

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

      {/* Table wrapper — horizontal scroll on small screens */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide ${col.className ?? ''}`}
                >
                  {col.label}
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
                <tr key={row.id ?? i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 text-slate-700 ${col.className ?? ''}`}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{filtered.length} results — page {page} of {totalPages}</span>
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
