import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Square, Circle, Type, Trash2, X, Plus, Minus, Copy } from 'lucide-react'

const COLORS = [
  { label: 'Blue',   value: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.8)' },
  { label: 'Green',  value: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.8)' },
  { label: 'Red',    value: 'rgba(239, 68, 68, 0.15)',  border: 'rgba(239, 68, 68, 0.8)' },
  { label: 'Yellow', value: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.8)' },
  { label: 'Purple', value: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.8)' },
  { label: 'Gray',   value: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.8)' },
]

export default function ShapePanel({ 
  shapes = [], 
  onDeleteShape, 
  onClose,
  onDuplicateShape,
  onShapeUpdate,
  drawingMode,
  setDrawingMode, // { type, color, border } or null
}) {
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  
  const handleToggleDraw = (type) => {
    if (drawingMode?.type === type) {
      setDrawingMode(null)
    } else {
      setDrawingMode({ type, color: selectedColor.value, border: selectedColor.border })
    }
  }

  const handleColorChange = (c) => {
    setSelectedColor(c)
    if (drawingMode) {
      setDrawingMode({ ...drawingMode, color: c.value, border: c.border })
    }
  }

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute top-0 right-0 h-full w-72 bg-white/95 backdrop-blur-xl border-l border-slate-200/80 shadow-2xl flex flex-col z-40"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div>
          <h3 className="font-display font-semibold text-slate-900">Background Shapes</h3>
          <p className="text-xs text-slate-500 mt-0.5">Draw zones or areas</p>
          <p className="text-[11px] text-indigo-600 font-medium mt-1">
            Tip: Ctrl+C / Ctrl+V / Ctrl+D untuk copy-paste shape
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">
        
        {/* Draw Tools */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Draw Tool</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleToggleDraw('rect')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                drawingMode?.type === 'rect' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Square size={20} className="mb-2" />
              <span className="text-xs font-medium">Rectangle</span>
            </button>
            <button
              onClick={() => handleToggleDraw('ellipse')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                drawingMode?.type === 'ellipse' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Circle size={20} className="mb-2" />
              <span className="text-xs font-medium">Ellipse</span>
            </button>
            <button
              onClick={() => handleToggleDraw('text')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                drawingMode?.type === 'text' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Type size={20} className="mb-2" />
              <span className="text-xs font-medium">Text</span>
            </button>
          </div>

          <AnimatePresence>
            {drawingMode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-2 overflow-hidden">
                <p className="text-xs text-indigo-600 bg-indigo-50 p-2 rounded-lg text-center">
                  Click & drag on empty canvas space to draw.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Color Palette */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fill Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c.label}
                onClick={() => handleColorChange(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor.label === c.label ? 'ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'}`}
                style={{ backgroundColor: c.border }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Existing Shapes List */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Existing Shapes ({shapes.length})</label>
          <div className="space-y-2">
            {shapes.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">No shapes yet.</p>
            ) : (
              shapes.map((shape, idx) => (
                <div key={shape.id} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition group space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: shape.fill_color, borderColor: shape.border_color }} />
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {shape.type} {idx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <div className="flex items-center border-r border-slate-200 pr-1 mr-1">
                        <button
                          onClick={() => onShapeUpdate?.(shape.id, { font_size: Math.max(8, (shape.font_size || 14) - 2) })}
                          className="text-slate-400 hover:text-indigo-600 transition p-1 rounded-lg hover:bg-slate-200"
                          title="Perkecil teks (A-)"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-[10px] font-mono text-slate-400 w-4 text-center">{shape.font_size || 14}</span>
                        <button
                          onClick={() => onShapeUpdate?.(shape.id, { font_size: Math.min(72, (shape.font_size || 14) + 2) })}
                          className="text-slate-400 hover:text-indigo-600 transition p-1 rounded-lg hover:bg-slate-200"
                          title="Perbesar teks (A+)"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => onDuplicateShape?.(shape)}
                        className="text-slate-400 hover:text-indigo-600 transition p-1 rounded-lg hover:bg-slate-200"
                        title="Duplicate / Copy shape"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteShape(shape.id)}
                        className="text-slate-400 hover:text-rose-500 transition p-1 rounded-lg hover:bg-slate-200"
                        title="Delete shape"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {onShapeUpdate && (
                    <input
                      type="text"
                      placeholder="Add text label..."
                      defaultValue={shape.text_content || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (shape.text_content || '')) {
                          onShapeUpdate(shape.id, { ...shape, text_content: e.target.value })
                          shape.text_content = e.target.value // optimistic local update for canvas sync
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur()
                      }}
                      className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </motion.div>
  )
}
