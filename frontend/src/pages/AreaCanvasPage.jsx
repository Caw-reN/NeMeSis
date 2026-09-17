import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Save, Upload, Trash2, Square, Circle as CircleIcon, Hexagon, PenTool, MousePointer2 } from 'lucide-react'
import { areasService } from '../services/areas.service'
import { devicesService } from '../services/devices.service'
import { toast } from '../utils/toast'
import * as fabric from 'fabric'

const STORAGE_URL = 'http://localhost:8000/storage/'

export default function AreaCanvasPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [area, setArea] = useState(null)
  const [unassignedDevices, setUnassignedDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [currentMode, setCurrentMode] = useState('select') // select, pen, rect, circle, polygon
  const currentModeRef = useRef('select')
  
  const canvasRef = useRef(null)
  const fabricRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Initialization
  const fetchInitialData = useCallback(async () => {
    try {
      const areaData = await areasService.getOne(id)
      setArea(areaData)

      // Fetch all devices to find unassigned ones (area_id = null or different area? Actually area_id = null)
      const res = await devicesService.getAll()
      const devices = res.data || res // Depending on API response structure. The devices API usually returns the array directly.
      setUnassignedDevices(devices.filter(d => !d.area_id && d.type !== 'passive')) // Wait, passive devices can be on map too.
      // Let's just filter by area_id != id. Devices on other maps should probably stay there unless moved.
      setUnassignedDevices(devices.filter(d => d.area_id !== Number(id)))
      
      initFabric(areaData)
    } catch (err) {
      toast.error('Failed to load area data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchInitialData()
    
    // Cleanup fabric instance on unmount
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [fetchInitialData])

  const initFabric = (areaData) => {
    if (!canvasRef.current || !containerRef.current) return
    if (fabricRef.current) fabricRef.current.dispose()

    const { clientWidth, clientHeight } = containerRef.current
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: clientWidth,
      height: clientHeight,
      backgroundColor: '#f8fafc',
      selection: true,
      preserveObjectStacking: true, // Keep selected objects at their z-index
    })
    fabricRef.current = canvas

    // Load canvas data if exists
    if (areaData.canvas_data) {
      try {
        canvas.loadFromJSON(areaData.canvas_data, () => {
          canvas.renderAll()
          // Ensure all NMS devices have custom property tracked
        })
      } catch (e) {
        console.error('Error loading canvas data:', e)
      }
    } else {
       // If no canvas data but has image, load image
       if (areaData.image_path) {
         fabric.Image.fromURL(`${STORAGE_URL}${areaData.image_path}`, (img) => {
           // Scale image to fit canvas or set as background
           img.set({
             originX: 'center',
             originY: 'center',
             left: canvas.width / 2,
             top: canvas.height / 2,
             selectable: false,
             evented: false,
             id: 'background_image' // custom id
           })
           // Optionally scale
           const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9
           img.scale(scale)
           canvas.add(img)
           canvas.sendToBack(img)
         })
       }
    }

    // Setup events
    setupFabricEvents(canvas)
  }

  const setupFabricEvents = (canvas) => {
    canvas.on('mouse:down', (o) => {
      const mode = currentModeRef.current
      if (mode === 'select' || mode === 'pen') return
      
      const pointer = canvas.getPointer(o.e)
      if (mode === 'rect') {
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 50,
          height: 50,
          fill: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
          stroke: '#6366f1',
          strokeWidth: 2,
          cornerColor: '#6366f1',
          transparentCorners: false,
        })
        canvas.add(rect)
        canvas.setActiveObject(rect)
        setMode('select')
      } else if (mode === 'circle') {
        const circle = new fabric.Circle({
          left: pointer.x,
          top: pointer.y,
          radius: 30,
          fill: 'rgba(34, 197, 94, 0.2)', // green-500/20
          stroke: '#22c55e',
          strokeWidth: 2,
          cornerColor: '#22c55e',
          transparentCorners: false,
        })
        canvas.add(circle)
        canvas.setActiveObject(circle)
        setMode('select')
      }
    })
  }

  const setMode = (mode) => {
    setCurrentMode(mode)
    currentModeRef.current = mode
    if (!fabricRef.current) return
    const canvas = fabricRef.current
    
    if (mode === 'pen') {
      canvas.isDrawingMode = true
      canvas.freeDrawingBrush.color = '#6366f1' // indigo
      canvas.freeDrawingBrush.width = 3
    } else {
      canvas.isDrawingMode = false
    }
  }

  const deleteSelected = () => {
    if (!fabricRef.current) return
    const canvas = fabricRef.current
    const activeObjects = canvas.getActiveObjects()
    if (activeObjects.length) {
      canvas.discardActiveObject()
      activeObjects.forEach(obj => {
        // If it's a device node, we might want to unassign it
        if (obj.nms_device_id) {
          // Find device and put it back in unassigned list? 
          // For now, let the user hit "Save" to persist changes.
          // The device will stay in DB with area_id until saved. But wait, saving just saves canvas_data.
          // We need to also sync device positions!
          // Actually, saving syncs both.
        }
        canvas.remove(obj)
      })
    }
  }

  // Handle Drag & Drop of devices onto canvas
  const handleDragOver = (e) => e.preventDefault()
  
  const handleDrop = (e) => {
    e.preventDefault()
    if (!fabricRef.current) return
    const deviceId = e.dataTransfer.getData('text/plain')
    if (!deviceId) return
    
    const device = unassignedDevices.find(d => d.id === Number(deviceId))
    if (!device) return

    const canvas = fabricRef.current
    // Get mouse coords relative to canvas
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Create a group for the device icon
    fabric.Image.fromURL('/vite.svg', (img) => { // Placeholder icon
      img.scale(0.5)
      img.set({ originX: 'center', originY: 'center' })
      
      const text = new fabric.Text(device.name, {
        fontSize: 14,
        originX: 'center',
        originY: 'center',
        top: 20,
        fill: '#1e293b',
        fontWeight: 'bold',
      })

      const group = new fabric.Group([img, text], {
        left: x,
        top: y,
        nms_device_id: device.id,
        hasControls: false, // Don't let users resize the device icon
      })

      canvas.add(group)
      canvas.renderAll()

      // Remove from unassigned list visually
      setUnassignedDevices(prev => prev.filter(d => d.id !== device.id))
    })
  }

  const handleSave = async () => {
    if (!fabricRef.current) return
    setSaving(true)
    const canvas = fabricRef.current
    const canvasData = JSON.stringify(canvas.toJSON(['nms_device_id', 'id'])) // serialize custom props
    
    try {
      // 1. Save canvas data to area
      await areasService.update(id, { canvas_data: canvasData })
      
      // 2. Sync device positions
      const objects = canvas.getObjects()
      const deviceUpdates = []
      
      objects.forEach(obj => {
        if (obj.nms_device_id) {
          deviceUpdates.push(
            devicesService.update(obj.nms_device_id, {
              area_id: id,
              map_x: obj.left,
              map_y: obj.top
            })
          )
        }
      })
      
      await Promise.all(deviceUpdates)
      
      toast.success('Area map saved successfully.')
    } catch (err) {
      toast.error('Failed to save map.')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await areasService.uploadImage(id, file)
      // Reload the area to get new image
      toast.success('Floor plan uploaded.')
      fetchInitialData() // re-init canvas
    } catch (err) {
      toast.error('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-500">Loading editor...</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-6rem)] flex flex-col -m-6" // negative margin to span full width if inside layout with padding
    >
      {/* Header Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/areas')} className="text-slate-400 hover:text-slate-700 transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-slate-900">{area?.name}</h2>
            <p className="text-xs text-slate-500">Interactive Editor</p>
          </div>
        </div>
        
        <div className="flex flex-1 items-center justify-center gap-2">
          {/* Drawing Tools */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <ToolButton icon={<MousePointer2 size={16} />} active={currentMode === 'select'} onClick={() => setMode('select')} title="Select" />
            <ToolButton icon={<PenTool size={16} />} active={currentMode === 'pen'} onClick={() => setMode('pen')} title="Freehand Pen" />
            <ToolButton icon={<Square size={16} />} active={currentMode === 'rect'} onClick={() => setMode('rect')} title="Draw Box" />
            <ToolButton icon={<CircleIcon size={16} />} active={currentMode === 'circle'} onClick={() => setMode('circle')} title="Draw Circle" />
            <div className="w-px bg-slate-200 mx-1 my-1"></div>
            <button onClick={deleteSelected} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-white rounded-lg transition" title="Delete Selected">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition"
          >
            <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
            {uploading ? 'Uploading...' : 'Background'}
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Map'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-slate-50">
        {/* Sidebar: Unassigned Devices */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">Devices</h3>
            <p className="text-xs text-slate-500 mt-1">Drag and drop onto map</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {unassignedDevices.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No unassigned devices.</p>
            ) : (
              unassignedDevices.map(device => (
                <div
                  key={device.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', device.id)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-sm transition"
                >
                  <div className="font-semibold text-sm text-slate-700">{device.name}</div>
                  <div className="text-xs text-slate-500 uppercase">{device.type} • {device.ip_address || 'Passive'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          className="flex-1 relative overflow-hidden" 
          ref={containerRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Note: Fabric creates an upper-canvas absolute positioned over the lower-canvas. */}
          <canvas ref={canvasRef} />
        </div>
      </div>
    </motion.div>
  )
}

function ToolButton({ icon, active, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition ${active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'}`}
    >
      {icon}
    </button>
  )
}
