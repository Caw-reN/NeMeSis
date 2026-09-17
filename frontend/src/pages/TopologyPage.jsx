import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Radar, Cable, X, Plug, Wifi, Zap, ArrowLeftRight, GitBranch, Radio, Plus, Network, Square, Save, Type } from 'lucide-react'
import TopologyCanvas  from '../components/topology/TopologyCanvas'
import NodeInfoPanel   from '../components/topology/NodeInfoPanel'
import NodeEditPanel   from '../components/topology/NodeEditPanel'
import EdgeActionPanel from '../components/topology/EdgeActionPanel'
import InterfaceSelect from '../components/topology/InterfaceSelect'
import DiscoveryModal  from '../components/ui/DiscoveryModal'
import DeviceModal     from '../components/ui/DeviceModal'
import Modal           from '../components/ui/Modal'
import ShapePanel      from '../components/topology/ShapePanel'
import { topologyService } from '../services/topology.service'
import { devicesService }  from '../services/devices.service'
import { toast } from '../utils/toast'

// Cable type definitions - maps to link_type values for the API
const CABLE_TYPES = [
  { value: 'ethernet',  icon: <Cable size={16} />,          name: 'Ethernet',   desc: 'UTP / RJ-45',       linkType: 'physical', label: 'Ethernet'   },
  { value: 'fiber',     icon: <Zap size={16} />,            name: 'Fiber',      desc: 'SFP / LC / SC',     linkType: 'physical', label: 'Fiber'      },
  { value: 'serial',    icon: <ArrowLeftRight size={16} />, name: 'Serial',     desc: 'WAN / DB60 / V.35', linkType: 'physical', label: 'Serial'     },
  { value: 'wireless',  icon: <Wifi size={16} />,           name: 'Wireless',   desc: 'Wi-Fi / PtP',       linkType: 'physical', label: 'Wireless'   },
  { value: 'logical',   icon: <GitBranch size={16} />,      name: 'Logical',    desc: 'VLAN / VPN',        linkType: 'logical',  label: 'Logical'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// TopologyPage
// ─────────────────────────────────────────────────────────────────────────────
import { ErrorBoundary } from '../components/ui/ErrorBoundary'

export default function TopologyPage() {
  const [graph, setGraph]               = useState({ nodes: [], edges: [], shapes: [] })
  const [loading, setLoading]           = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState(false)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)  // clicked cable
  const [edgeClickPos, setEdgeClickPos] = useState(null)
  const [nodeClickPos, setNodeClickPos] = useState(null)
  const [isEditingNode, setIsEditingNode] = useState(false)
  const [defaultCableType, setDefaultCableType] = useState('ethernet')
  const [clusterClients, setClusterClients] = useState(true)
  const [selectedNodeIds, setSelectedNodeIds] = useState([])
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [showConfirmBulkDelete, setShowConfirmBulkDelete] = useState(false)
  
  // Shape drawing state
  const canvasRef = useRef(null)
  const [isSavingPositions, setIsSavingPositions] = useState(false)
  const [shapePanelOpen, setShapePanelOpen] = useState(false)
  const [selectedShapeId, setSelectedShapeId] = useState(null)
  const [editingShapeId, setEditingShapeId] = useState(null)
  const copiedShapeRef = useRef(null)

  const handleCopyShape = (shapeId = selectedShapeId) => {
    if (!shapeId) return
    const shapeToCopy = graph.shapes.find(s => s.id === shapeId)
    if (shapeToCopy) {
      copiedShapeRef.current = { ...shapeToCopy }
      toast.info('Shape disalin ke clipboard.')
    }
  }

  const handleDuplicateShape = async (shape) => {
    if (!shape) return
    try {
      const newShapeData = {
        type: shape.type,
        x: Math.round(shape.x + 30),
        y: Math.round(shape.y + 30),
        width: Math.round(shape.width),
        height: Math.round(shape.height),
        fill_color: shape.fill_color,
        border_color: shape.border_color,
        text_content: shape.text_content || '',
      }
      const created = await topologyService.addShape(newShapeData)
      if (created?.id) {
        setGraph(prev => ({
          ...prev,
          shapes: [...(prev.shapes || []), created]
        }))
        setSelectedShapeId(created.id)
      }
      fetchGraph(true) // Silent refresh without triggering full-screen loading
      toast.success('Shape berhasil diduplikasi!')
    } catch {
      toast.error('Gagal menduplikasi shape.')
    }
  }

  const handlePasteShape = async () => {
    const src = copiedShapeRef.current
    if (!src) {
      toast.error('Tidak ada shape di clipboard untuk ditempel.')
      return
    }
    try {
      const newShapeData = {
        type: src.type,
        x: Math.round(src.x + 30),
        y: Math.round(src.y + 30),
        width: Math.round(src.width),
        height: Math.round(src.height),
        fill_color: src.fill_color,
        border_color: src.border_color,
        text_content: src.text_content || '',
      }

      // Update copiedShape position so subsequent pastes cascade (+30 each time)
      copiedShapeRef.current = {
        ...src,
        x: newShapeData.x,
        y: newShapeData.y
      }

      const created = await topologyService.addShape(newShapeData)
      if (created?.id) {
        setGraph(prev => ({
          ...prev,
          shapes: [...(prev.shapes || []), created]
        }))
        setSelectedShapeId(created.id)
      }
      fetchGraph(true) // Silent refresh without triggering full-screen loading
      toast.success('Shape berhasil ditempel!')
    } catch (err) {
      console.error('Failed to paste shape:', err)
      toast.error('Gagal menempel shape.')
    }
  }
  const [drawingMode, setDrawingMode]       = useState(null) // null or { type, color, border }

  const fetchGraph = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    return topologyService.getGraph()
      .then(setGraph)
      .catch(() => {
        if (!silent) toast.error('Failed to load topology data.')
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchGraph() // initial load

    // Auto-refresh every 10 seconds silently
    const intervalId = setInterval(() => {
      fetchGraph(true)
    }, 10000)

    return () => clearInterval(intervalId)
  }, [fetchGraph])

  // Open the discovery modal instead of running immediately
  const openDiscovery = () => setDiscoveryModalOpen(true)

  const handleDiscover = async (ipRanges = [], filterType = '') => {
    setIsDiscovering(true)
    const filterLabel = ipRanges.length > 0 ? ` (filter: ${ipRanges.join(', ')})` : ''
    const apLabel = filterType === 'ap' ? ' [AP Only]' : ''
    const tid = toast.loading(`Running Auto-Discovery${filterLabel}${apLabel}...`)
    try {
      const res = await topologyService.runDiscovery(ipRanges, filterType)
      const summary = res.summary
      toast.success(
        `Discovery selesai: ditemukan ${summary.neighbors_found} perangkat, ${summary.links_created} link baru.`,
        { id: tid }
      )
      fetchGraph()
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Auto-Discovery gagal.', { id: tid })
    } finally {
      setIsDiscovering(false)
      setDiscoveryModalOpen(false)
    }
  }

  // Normal mode: node click → load device detail
  const handleNodeClick = async (nodeId, position) => {
    if (!nodeId) {
      setSelectedId(null)
      setSelectedNode(null)
      setNodeClickPos(null)
      setIsEditingNode(false)
      return
    }
    setSelectedEdge(null) // close edge panel when node clicked
    setEdgeClickPos(null)
    setIsEditingNode(false)
    setSelectedId(nodeId)
    setNodeClickPos(position)
    try {
      const data = await devicesService.getOne(nodeId)
      setSelectedNode({ ...data.device, open_ports: data.open_ports })
    } catch {
      toast.error('Failed to load device details.')
    }
  }

  // Edge click → open EdgeActionPanel
  const handleEdgeClick = (edge, position) => {
    if (!edge) { 
      setSelectedEdge(null)
      setEdgeClickPos(null)
      return 
    }
    setSelectedId(null)
    setSelectedNode(null)
    setIsEditingNode(false)
    setSelectedEdge(edge)
    setEdgeClickPos(position)
  }

  /**
   * Called by TopologyCanvas connect mode when user picks source + target.
   * Returns a Promise so canvas can await it and reset state after.
   */
  const handleCreateLinkRequest = async (sourceId, targetId, cableType) => {
    try {
      const cableInfo = CABLE_TYPES.find(c => c.value === cableType) || CABLE_TYPES[0]
      await topologyService.createLink({
        source_device_id: sourceId,
        target_device_id: targetId,
        link_type:        cableInfo.linkType,
        cable_type:       cableType,
        label:            cableInfo.label,
      })
      toast.success('Link created successfully!')
      fetchGraph()
    } catch {
      toast.error('Failed to create link.')
      throw new Error('Create link failed')
    }
  }



  // Edge edit
  const handleEdgeSave = async (edgeId, data) => {
    try {
      await topologyService.updateLink(edgeId, data)
      toast.success('Link updated!')
      setSelectedEdge(null)
      fetchGraph()
    } catch {
      toast.error('Failed to update link.')
      throw new Error('update failed')
    }
  }

  // Edge delete
  const handleEdgeDelete = async (edgeId) => {
    try {
      await topologyService.deleteLink(edgeId)
      toast.success('Link deleted.')
      setSelectedEdge(null)
      fetchGraph()
    } catch {
      toast.error('Failed to delete link.')
      throw new Error('delete failed')
    }
  }

  const handleSelectionChange = (ids) => {
    setSelectedNodeIds(ids)
    if (ids.length > 1) {
      // If multi-selection, close individual panels
      setSelectedId(null)
      setSelectedNode(null)
      setNodeClickPos(null)
      setIsEditingNode(false)
      setSelectedEdge(null)
    }
  }

  const confirmBulkDelete = () => {
    setShowConfirmBulkDelete(true)
  }

  const executeBulkDelete = async () => {
    setIsDeletingBulk(true)
    try {
      await devicesService.removeBulk(selectedNodeIds)
      toast.success(`${selectedNodeIds.length} devices deleted.`)
      
      // Clear selected node if it was part of the deleted batch (or just clear it to be safe)
      if (selectedNodeIds.includes(String(selectedId)) || selectedNodeIds.includes(Number(selectedId))) {
        setSelectedId(null)
        setSelectedNode(null)
        setNodeClickPos(null)
        setIsEditingNode(false)
      }

      setSelectedNodeIds([])
      setShowConfirmBulkDelete(false)
      fetchGraph()
    } catch {
      toast.error('Failed to delete devices.')
    } finally {
      setIsDeletingBulk(false)
    }
  }

  // Keyboard shortcut for deleting selected nodes
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      
      const isCtrl = e.ctrlKey || e.metaKey

      // Copy: Ctrl + C
      if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedShapeId) {
          e.preventDefault()
          handleCopyShape(selectedShapeId)
        }
        return
      }

      // Cut: Ctrl + X
      if (isCtrl && e.key.toLowerCase() === 'x') {
        if (selectedShapeId) {
          e.preventDefault()
          handleCopyShape(selectedShapeId)
          handleDeleteShape(selectedShapeId)
          setSelectedShapeId(null)
        }
        return
      }

      // Paste: Ctrl + V
      if (isCtrl && e.key.toLowerCase() === 'v') {
        if (copiedShapeRef.current) {
          e.preventDefault()
          handlePasteShape()
        }
        return
      }

      // Duplicate: Ctrl + D
      if (isCtrl && e.key.toLowerCase() === 'd') {
        if (selectedShapeId) {
          e.preventDefault()
          handleCopyShape(selectedShapeId)
          handlePasteShape()
        }
        return
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShapeId) {
          e.preventDefault()
          handleDeleteShape(selectedShapeId)
          setSelectedShapeId(null)
        } else if (selectedNodeIds.length > 0) {
          e.preventDefault()
          confirmBulkDelete()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedShapeId, selectedNodeIds, isDeletingBulk, graph.shapes])

  // Save positions
  const handleSavePositions = async () => {
    if (!canvasRef.current) return
    try {
      setIsSavingPositions(true)
      const positions = canvasRef.current.getPositions()
      if (!positions || Object.keys(positions).length === 0) {
        toast.error('Tidak ada posisi node yang dapat disimpan.')
        return
      }
      try {
        localStorage.setItem('nms_topology_positions', JSON.stringify(positions))
      } catch {}

      await topologyService.savePositions(positions)
      toast.success('Posisi topologi berhasil disimpan permanen ke server!')
    } catch (err) {
      console.error('Failed to save topology positions:', err)
      toast.error('Gagal menyimpan posisi topologi ke server.')
    } finally {
      setIsSavingPositions(false)
    }
  }

  // Node edit
  const handleNodeSave = async (nodeId, data) => {
    try {
      await devicesService.update(nodeId, data)
      toast.success('Device updated successfully.')
      setIsEditingNode(false)
      fetchGraph()
      // Refresh the selected node details
      const freshData = await devicesService.getOne(nodeId)
      setSelectedNode({ ...freshData.device, open_ports: freshData.open_ports })
    } catch {
      toast.error('Failed to update device.')
    }
  }

  // Shapes
  const handleDeleteShape = async (shapeId) => {
    try {
      // Optimistic delete: remove instantly from UI
      setGraph(prev => ({
        ...prev,
        shapes: (prev.shapes || []).filter(s => s.id !== shapeId)
      }))
      setSelectedShapeId(null)
      await topologyService.deleteShape(shapeId)
      fetchGraph(true) // Silent refresh without full-screen loading
      toast.success('Shape berhasil dihapus.')
    } catch {
      toast.error('Gagal menghapus shape.')
      fetchGraph(true)
    }
  }

  const handleShapeDrawn = async (shapeData) => {
    try {
      const created = await topologyService.addShape(shapeData)
      if (created?.id) {
        setGraph(prev => ({
          ...prev,
          shapes: [...(prev.shapes || []), created]
        }))
      }
      toast.success('Shape added')
      setDrawingMode(null) // Turn off drawing mode after 1 shape drawn to prevent accidental drags
      fetchGraph(true) // Silent refresh without full-screen loading
      return created
    } catch {
      toast.error('Failed to save shape')
      return null
    }
  }

  const handleShapeUpdate = async (shapeId, shapeData) => {
    try {
      setGraph(prev => ({
        ...prev,
        shapes: (prev.shapes || []).map(s => s.id === shapeId ? { ...s, ...shapeData } : s)
      }))
      await topologyService.updateShape(shapeId, shapeData)
    } catch {
      toast.error('Failed to update shape')
      fetchGraph(true)
    }
  }

  return (
    <ErrorBoundary>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className="w-full h-full relative overflow-hidden bg-white"
      >
      {/* Canvas area (Background) */}
      <div className="absolute inset-0 w-full h-full">
        {loading ? (
          <div className="absolute inset-0 topology-bg flex items-center justify-center border-t border-slate-200">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm">Loading topology…</p>
            </div>
          </div>
        ) : (
          <TopologyCanvas
            ref={canvasRef}
            nodes={graph.nodes}
            edges={graph.edges}
            shapes={graph.shapes}
            positions={graph.positions}
            selectedShapeId={selectedShapeId}
            onSelectShape={setSelectedShapeId}
            editingShapeId={editingShapeId}
            setEditingShapeId={setEditingShapeId}
            drawingMode={drawingMode}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onCreateLink={handleCreateLinkRequest}
            onShapeDrawn={handleShapeDrawn}
            onShapeUpdate={handleShapeUpdate}
            onSelectionChange={handleSelectionChange}
            selectedNode={selectedId}
            cableTypes={CABLE_TYPES}
            disableKeyboard={discoveryModalOpen}
            clusterClients={clusterClients}
          />
        )}
      </div>

      {/* Floating Bulk Action Panel */}
      <AnimatePresence>
        {selectedNodeIds.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="absolute bottom-28 left-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl"
          >
            <span className="text-sm font-semibold">
              {selectedNodeIds.length} Devices Selected
            </span>
            <div className="w-px h-4 bg-slate-700" />
            <button
              onClick={confirmBulkDelete}
              disabled={isDeletingBulk}
              className="text-sm font-semibold text-rose-400 hover:text-rose-300 transition flex items-center gap-2"
            >
              <X size={16} />
              {isDeletingBulk ? 'Deleting...' : 'Delete Selected'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Bulk Delete Modal */}
      <Modal
        open={showConfirmBulkDelete}
        onOpenChange={setShowConfirmBulkDelete}
        title="Konfirmasi Penghapusan"
        description={`Apakah Anda yakin ingin menghapus ${selectedNodeIds.length} perangkat sekaligus? Tindakan ini tidak dapat dibatalkan.`}
        maxWidth="max-w-md"
      >
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setShowConfirmBulkDelete(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            Batal
          </button>
          <button
            onClick={executeBulkDelete}
            disabled={isDeletingBulk}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition disabled:opacity-50"
          >
            {isDeletingBulk ? 'Menghapus...' : 'Ya, Hapus Semua'}
          </button>
        </div>
      </Modal>

      {/* Stats Badge (Floating) */}
      <div className="absolute top-20 left-4 lg:left-6 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md shadow-sm border border-slate-200/80 rounded-2xl px-4 py-2 pointer-events-auto">
          <p className="text-xs font-semibold text-slate-600">
            {graph.nodes.length} <span className="text-slate-400 font-normal">nodes</span> � {graph.edges.length} <span className="text-slate-400 font-normal">links</span>
            {loading && <span className="text-indigo-500 animate-pulse ml-1">� Loading…</span>}
          </p>
        </div>
      </div>

      {/* Toolbar (Floating top-right) */}
      <div className="absolute top-20 right-4 lg:right-6 flex items-center gap-2 z-10">
        {/* Save Positions Button */}
        <button
          onClick={handleSavePositions}
          disabled={loading || isSavingPositions}
          className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-2xl px-4 py-2 shadow-sm transition disabled:opacity-50"
          title="Simpan posisi tata letak topologi permanen ke database server"
        >
          <Save size={16} className={isSavingPositions ? 'animate-spin' : ''} />
          {isSavingPositions ? 'Menyimpan...' : 'Simpan Posisi'}
        </button>
        {/* View Options Toggle */}
        <button
          onClick={() => setClusterClients(prev => !prev)}
          className={`flex items-center gap-2 text-sm font-semibold rounded-2xl px-4 py-2 shadow-sm transition ${
            clusterClients 
              ? 'text-emerald-700 bg-emerald-100 border border-emerald-200 hover:bg-emerald-200' 
              : 'text-slate-600 border border-slate-200 bg-white/90 backdrop-blur-md hover:bg-slate-50'
          }`}
          title="Toggle End-User Clustering"
        >
          <Network size={16} />
          {clusterClients ? 'Uncluster Clients' : 'Cluster Clients'}
        </button>

        <button
          onClick={() => setShapePanelOpen(true)}
          className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-sm hover:bg-slate-50 transition"
          title="Draw shapes and areas"
        >
          <Square size={16} />
          Shapes
        </button>

        <button
          onClick={async () => {
            const pos = canvasRef.current?.getViewPosition() || { x: 0, y: 0 }
            const created = await handleShapeDrawn({
              type: 'text',
              x: Math.round(pos.x - 50),
              y: Math.round(pos.y - 20),
              width: 100,
              height: 40,
              fill_color: null,
              border_color: '#334155',
              text_content: 'New Text'
            })
            if (created?.id) {
              setEditingShapeId(created.id)
            }
          }}
          className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-sm hover:bg-slate-50 transition"
          title="Add free text label"
        >
          <Type size={16} />
          Add Text
        </button>

        <button
          onClick={() => setDeviceModalOpen(true)}
          disabled={loading || isDiscovering}
          className="flex items-center gap-2 text-sm text-white bg-zinc-900 rounded-2xl px-4 py-2 shadow-sm hover:bg-zinc-700 disabled:opacity-50 transition"
        >
          <Plus size={16} />
          Add Device
        </button>
        <button
          onClick={openDiscovery}
          disabled={isDiscovering || loading}
          className="flex items-center gap-2 text-sm text-indigo-600 font-semibold border border-indigo-200 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-sm hover:bg-indigo-50 disabled:opacity-50 transition"
        >
          <Radar size={16} className={isDiscovering ? 'animate-spin' : ''} />
          {isDiscovering ? 'Scanning...' : 'Auto-Discovery'}
        </button>
        <button
          onClick={fetchGraph}
          disabled={loading || isDiscovering}
          className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white/90 backdrop-blur-md rounded-2xl px-4 py-2 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Node Info Panel */}
      <NodeInfoPanel
        node={selectedNode}
        position={nodeClickPos}
        onEdit={() => setIsEditingNode(true)}
        onClose={() => { setSelectedId(null); setSelectedNode(null); setNodeClickPos(null); setIsEditingNode(false) }}
      />

      {/* Node Edit Panel */}
      {isEditingNode && selectedNode && (
        <NodeEditPanel
          node={selectedNode}
          position={nodeClickPos}
          onSave={handleNodeSave}
          onClose={() => setIsEditingNode(false)}
        />
      )}

      {/* Edge Action Panel (edit/delete cable) */}
      <EdgeActionPanel
        edge={selectedEdge}
        position={edgeClickPos}
        nodes={graph.nodes}
        onSave={handleEdgeSave}
        onDelete={handleEdgeDelete}
        onClose={() => { setSelectedEdge(null); setEdgeClickPos(null) }}
      />
      <DiscoveryModal 
        open={discoveryModalOpen}
        onClose={() => setDiscoveryModalOpen(false)}
        onConfirm={handleDiscover}
        loading={isDiscovering}
      />
      
      {/* Add Device Modal */}
      <DeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        editTarget={null}
        onSuccess={fetchGraph}
      />

      {/* Shape Panel (Right Sidebar) */}
      <AnimatePresence>
        {shapePanelOpen && (
          <ShapePanel
            shapes={graph.shapes}
            onClose={() => {
              setShapePanelOpen(false)
              setDrawingMode(null)
            }}
            onDeleteShape={handleDeleteShape}
            onDuplicateShape={handleDuplicateShape}
            onShapeUpdate={handleShapeUpdate}
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
          />
        )}
      </AnimatePresence>

      </motion.div>
    </ErrorBoundary>
  )
}
