import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Map, Image as ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/ui/Modal'
import { areasService } from '../services/areas.service'
import { toast } from '../utils/toast'
// Let's rely on standard backend storage URL. The backend serves storage at /storage/...
const STORAGE_URL = 'http://localhost:8000/storage/'

export default function AreaPage() {
  const navigate = useNavigate()
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchAreas = () => {
    setLoading(true)
    areasService.getAll()
      .then(setAreas)
      .finally(() => setLoading(false))
  }

  useEffect(fetchAreas, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await areasService.create(form)
      toast.success(`Area "${form.name}" created.`)
      setModalOpen(false)
      fetchAreas()
    } catch {
      // Interceptor handles error
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await areasService.remove(deleteTarget.id)
      toast.success('Area deleted.')
      setDeleteTarget(null)
      fetchAreas()
    } catch {}
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900">Area Maps</h2>
          <p className="text-xs text-slate-500">Manage floor plans and physical zones.</p>
        </div>
        <div className="ml-auto">
          <button onClick={() => { setForm({ name: '', description: '' }); setModalOpen(true) }} className="flex items-center gap-2 text-sm text-white bg-zinc-900 hover:bg-zinc-700 rounded-xl px-4 py-2 transition">
            <Plus size={16} /> Create Area
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">Loading areas...</div>
      ) : areas.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 border-dashed rounded-2xl">
          <Map className="mx-auto text-slate-300 mb-3" size={32} />
          <p className="text-slate-500 text-sm">No areas defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {areas.map(area => (
            <div key={area.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition group flex flex-col">
              <div 
                className="h-40 bg-slate-100 flex items-center justify-center relative cursor-pointer"
                onClick={() => navigate(`/areas/${area.id}`)}
              >
                {area.image_path ? (
                  <img src={`${STORAGE_URL}${area.image_path}`} alt={area.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} className="text-slate-300" />
                )}
                <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all transform translate-y-2 group-hover:translate-y-0">
                    Open Editor
                  </span>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800">{area.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{area.description || 'No description.'}</p>
                  </div>
                  <button onClick={() => setDeleteTarget(area)} className="text-slate-400 hover:text-rose-500 p-1 rounded transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-auto pt-4 flex items-center gap-2">
                  <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    {area.devices_count} Devices
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Create Area" maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Floor 1 / Server Room"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Optional description..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50 transition">
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Area?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-500 mb-4">Are you sure you want to delete <b>{deleteTarget?.name}</b>? All drawings and map configurations will be permanently lost. Devices inside this area will NOT be deleted, but their map positions will be reset.</p>
        <div className="flex gap-2">
          <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition">Delete</button>
        </div>
      </Modal>
    </motion.div>
  )
}
