import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Radar, Cable, X, Plug, Wifi, Zap, ArrowLeftRight, GitBranch, Radio } from 'lucide-react'
import TopologyCanvas  from '../components/topology/TopologyCanvas'
import NodeInfoPanel   from '../components/topology/NodeInfoPanel'
import NodeEditPanel   from '../components/topology/NodeEditPanel'
import EdgeActionPanel from '../components/topology/EdgeActionPanel'
import InterfaceSelect from '../components/topology/InterfaceSelect'
import { topologyService } from '../services/topology.service'
import { devicesService }  from '../services/devices.service'
import { toast } from '../utils/toast'

// Cable type definitions — maps to link_type values for the API
const CABLE_TYPES = [
  { value: 'ethernet',  icon: <Cable size={16} />,          name: 'Ethernet',   desc: 'UTP / RJ-45',       linkType: 'physical', label: 'Ethernet'   },
  { value: 'fiber',     icon: <Zap size={16} />,            name: 'Fiber',      desc: 'SFP / LC / SC',     linkType: 'physical', label: 'Fiber'      },
  { value: 'serial',    icon: <ArrowLeftRight size={16} />, name: 'Serial',     desc: 'WAN / DB60 / V.35', linkType: 'physical', label: 'Serial'     },
  { value: 'wireless',  icon: <Wifi size={16} />,           name: 'Wireless',   desc: 'Wi-Fi / Radio',     linkType: 'logical',  label: 'Wireless'   },
  { value: 'trunk',     icon: <GitBranch size={16} />,      name: 'Trunk',      desc: '802.1Q VLAN Trunk', linkType: 'logical',  label: 'Trunk'      },
  { value: 'crossover', icon: <Radio size={16} />,          name: 'Crossover',  desc: 'Direct PC–PC',      linkType: 'physical', label: 'Crossover'  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TopologyPage
// ─────────────────────────────────────────────────────────────────────────────
export default function TopologyPage() {
  const [graph, setGraph]               = useState({ nodes: [], edges: [] })
  const [loading, setLoading]           = useState(true)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)  // clicked cable
  const [edgeClickPos, setEdgeClickPos] = useState(null)
  const [nodeClickPos, setNodeClickPos] = useState(null)
  const [isEditingNode, setIsEditingNode] = useState(false)
  const [defaultCableType, setDefaultCableType] = useState('ethernet')



  const fetchGraph = useCallback(() => {
    setLoading(true)
    topologyService.getGraph()
      .then(setGraph)
      .catch(() => toast.error('Failed to load topology data.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(fetchGraph, [fetchGraph])

  const handleDiscover = async () => {
    setIsDiscovering(true)
    const tid = toast.loading('Running Auto-Discovery (CDP/LLDP)...')
    try {
      const res = await topologyService.runDiscovery()
      const summary = res.summary
      toast.success(
        `Discovery complete: found ${summary.neighbors_found} neighbors, created ${summary.links_created} new links.`,
        { id: tid }
      )
      fetchGraph()
    } catch (err) {
      toast.error(err?.response?.data?.error ?? 'Auto-Discovery failed.', { id: tid })
    } finally {
      setIsDiscovering(false)
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

  return (
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
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onCreateLink={handleCreateLinkRequest}
            selectedNode={selectedId}
            cableTypes={CABLE_TYPES}
          />
        )}
      </div>

      {/* Stats Badge (Floating) */}
      <div className="absolute top-20 left-4 lg:left-6 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md shadow-sm border border-slate-200/80 rounded-2xl px-4 py-2 pointer-events-auto">
          <p className="text-xs font-semibold text-slate-600">
            {graph.nodes.length} <span className="text-slate-400 font-normal">nodes</span> · {graph.edges.length} <span className="text-slate-400 font-normal">links</span>
            {loading && <span className="text-indigo-500 animate-pulse ml-1">· Loading…</span>}
          </p>
        </div>
      </div>

      {/* Toolbar (Floating top-right) */}
      <div className="absolute top-20 right-4 lg:right-6 flex items-center gap-2 z-10">
        <button
          onClick={handleDiscover}
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


    </motion.div>
  )
}
