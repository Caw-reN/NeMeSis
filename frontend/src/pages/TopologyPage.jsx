import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Maximize2 } from 'lucide-react'
import TopologyCanvas from '../components/topology/TopologyCanvas'
import NodeInfoPanel  from '../components/topology/NodeInfoPanel'
import { topologyService } from '../services/topology.service'
import { devicesService }  from '../services/devices.service'
import { toast } from '../utils/toast'

export default function TopologyPage() {
  const [graph, setGraph]           = useState({ nodes: [], edges: [] })
  const [loading, setLoading]       = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)

  const fetchGraph = useCallback(() => {
    setLoading(true)
    topologyService.getGraph()
      .then(setGraph)
      .catch(() => toast.error('Failed to load topology data.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(fetchGraph, [fetchGraph])

  // When a node is clicked, load full device detail
  const handleNodeClick = async (nodeId) => {
    if (!nodeId) {
      setSelectedId(null)
      setSelectedNode(null)
      return
    }
    setSelectedId(nodeId)
    try {
      const data = await devicesService.getOne(nodeId)
      setSelectedNode({ ...data.device, open_ports: data.open_ports })
    } catch {
      toast.error('Failed to load device details.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-3 h-[calc(100vh-8rem)]"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <div>
          <h2 className="font-display font-bold text-slate-900">Topology Map</h2>
          <p className="text-xs text-slate-400">
            {graph.nodes.length} nodes · {graph.edges.length} links
            {loading && ' · Loading…'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchGraph}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-xl px-3 py-2 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative rounded-2xl overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 topology-bg flex items-center justify-center rounded-2xl border border-slate-200">
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
            selectedNode={selectedId}
          />
        )}

        {/* Node Info Panel */}
        <NodeInfoPanel
          node={selectedNode}
          onClose={() => { setSelectedId(null); setSelectedNode(null) }}
        />
      </div>
    </motion.div>
  )
}
