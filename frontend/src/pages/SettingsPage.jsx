import { useState, useEffect } from 'react'
import { Plus, Trash2, Upload, Edit2 } from 'lucide-react'
import api from '../services/api'
import { toast } from '../utils/toast'
import Spinner from '../components/ui/Spinner'
import Modal from '../components/ui/Modal'

export default function SettingsPage() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  // Form State
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState(null)

  // Telegram Settings State
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [isSavingTelegram, setIsSavingTelegram] = useState(false)

  useEffect(() => {
    fetchTypes()
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/settings')
      setTelegramToken(res.data.telegram_bot_token || '')
      setTelegramChatId(res.data.telegram_chat_id || '')
    } catch (err) {
      toast.error('Gagal mengambil pengaturan.')
    }
  }

  const saveTelegramSettings = async (e) => {
    e.preventDefault()
    setIsSavingTelegram(true)
    try {
      await api.post('/api/settings', {
        telegram_bot_token: telegramToken,
        telegram_chat_id: telegramChatId
      })
      toast.success('Pengaturan Telegram berhasil disimpan')
    } catch (err) {
      toast.error('Gagal menyimpan pengaturan')
    } finally {
      setIsSavingTelegram(false)
    }
  }

  const fetchTypes = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/device_types')
      setTypes(res.data)
    } catch (err) {
      toast.error('Gagal mengambil tipe perangkat.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (type) => {
    if (!type.is_custom) return
    if (!window.confirm(`Hapus tipe perangkat ${type.label}?`)) return

    try {
      await api.delete(`/api/device_types/${type.name}`)
      toast.success('Tipe perangkat berhasil dihapus.')
      fetchTypes()
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal menghapus tipe perangkat.'
      toast.error(msg)
    }
  }

  const openEditModal = (type) => {
    setEditTarget(type)
    setName(type.name)
    setLabel(type.label)
    setFile(null)
    setIsModalOpen(true)
  }

  const openAddModal = () => {
    setEditTarget(null)
    setName('')
    setLabel('')
    setFile(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    const payload = {
      name,
      label,
    }

    try {
      if (editTarget) {
        await api.put(`/api/device_types/${editTarget.name}`, payload)
        toast.success('Tipe perangkat berhasil diupdate')
      } else {
        await api.post('/api/device_types', payload)
        toast.success('Tipe perangkat berhasil ditambahkan')
      }
      setIsModalOpen(false)
      fetchTypes()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan tipe perangkat.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Konfigurasi sistem dan manajemen tipe perangkat.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Tipe Perangkat</h2>
            <p className="text-sm text-slate-500">Kelola ikon dan kategori perangkat kustom Anda.</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <Plus size={16} /> Tambah Tipe
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Spinner /></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {types.map((type) => (
              <div key={type.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                    {/* Render raw SVG or base64 embedded in SVG text */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                      <g dangerouslySetInnerHTML={{ __html: type.icon_svg }} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{type.label}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{type.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!type.is_custom && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg mr-2">Default</span>
                  )}
                  <button
                    onClick={() => openEditModal(type)}
                    className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                    title="Edit Tipe"
                  >
                    <Edit2 size={16} />
                  </button>
                  {type.is_custom && (
                    <button
                      onClick={() => handleDelete(type)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus Tipe"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {types.length === 0 && (
              <div className="p-8 text-center text-slate-500">Belum ada tipe perangkat.</div>
            )}
          </div>
        )}
      </div>

      {/* Telegram Notification Settings */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          Telegram Notifications
        </h2>
        <form onSubmit={saveTelegramSettings} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bot Token</label>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition"
              placeholder="e.g., 123456789:AA... (dari @BotFather)"
              value={telegramToken}
              onChange={e => setTelegramToken(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chat ID</label>
            <input
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition"
              placeholder="e.g., -100123456789"
              value={telegramChatId}
              onChange={e => setTelegramChatId(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Chat ID grup atau akun Anda yang akan menerima notifikasi.</p>
          </div>
          <button
            type="submit"
            disabled={isSavingTelegram}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {isSavingTelegram && <Spinner size="sm" />} Simpan Pengaturan
          </button>
        </form>
      </div>

      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title={editTarget ? 'Edit Tipe Perangkat' : 'Tambah Tipe Perangkat'}>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Internal (Tanpa Spasi)</label>
            <input
              required
              disabled={!!editTarget}
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="e.g., custom_sensor"
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label Tampilan</label>
            <input
              required
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition"
              placeholder="e.g., Sensor Suhu"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !label}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {isSubmitting && <Spinner size="sm" />} Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
