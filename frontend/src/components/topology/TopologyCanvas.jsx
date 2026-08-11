import { useEffect, useRef } from 'react'
import { Network, DataSet } from 'vis-network/standalone'

const STATUS_COLORS = {
  up:      { border: '#10b981', background: '#ffffff', highlight: { border: '#059669', background: '#f0fdf4' } },
  down:    { border: '#f43f5e', background: '#ffffff', highlight: { border: '#e11d48', background: '#fff1f2' } },
  unknown: { border: '#94a3b8', background: '#ffffff', highlight: { border: '#64748b', background: '#f8fafc' } },
}

const VENDOR_ICONS = {
  mikrotik: '🔴',
  cisco:    '🔵',
  generic:  '⚪',
}

/**
 * TopologyCanvas — Vis.js network visualization.
 *
 * Props:
 *   nodes         — array of Vis.js node objects from TopologyResource
 *   edges         — array of Vis.js edge objects
 *   onNodeClick   — callback (nodeId) when a node is clicked
 *   selectedNode  — currently selected node id
 */
export default function TopologyCanvas({ nodes = [], edges = [], onNodeClick, selectedNode }) {
  const containerRef = useRef(null)
  const networkRef   = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const visNodes = new DataSet(
      nodes.map(n => ({
        id:    n.id,
        label: `${VENDOR_ICONS[n.data?.vendor] ?? '⚪'} ${n.label}`,
        title: n.title,
        color: STATUS_COLORS[n.status] ?? STATUS_COLORS.unknown,
        shape: 'box',
        font:  {
          face:  'Inter, system-ui, sans-serif',
          size:  13,
          color: '#0f172a',
          bold:  { color: '#0f172a', size: 13 },
        },
        borderWidth:         2,
        borderWidthSelected: 3,
        shapeProperties:     { borderRadius: 10 },
        shadow:              { enabled: true, color: 'rgba(0,0,0,0.06)', size: 8, x: 0, y: 2 },
        margin:              { top: 10, bottom: 10, left: 14, right: 14 },
      }))
    )

    const visEdges = new DataSet(
      edges.map(e => ({
        id:     e.id,
        from:   e.from,
        to:     e.to,
        label:  e.label ?? '',
        dashes: e.type === 'manual',
        color:  { color: '#cbd5e1', highlight: '#6366f1', hover: '#94a3b8' },
        width:  1.5,
        font:   { size: 10, color: '#94a3b8', align: 'middle' },
        arrows: { to: { enabled: false } },
        smooth: { type: 'curvedCW', roundness: 0.1 },
      }))
    )

    const options = {
      layout:     { improvedLayout: true },
      interaction: {
        hover:        true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: true,
      },
      physics: {
        enabled: true,
        barnesHut: {
          gravitationalConstant: -5000,
          centralGravity:        0.3,
          springLength:          160,
          springConstant:        0.04,
          damping:               0.09,
        },
        stabilization: { iterations: 200 },
      },
    }

    const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
    networkRef.current = network

    network.on('click', ({ nodes: clickedNodes }) => {
      if (clickedNodes.length > 0) {
        onNodeClick?.(clickedNodes[0])
      } else {
        onNodeClick?.(null)
      }
    })

    network.once('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } })
    })

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [nodes, edges]) // Re-init when data changes

  // Highlight selected node
  useEffect(() => {
    if (!networkRef.current) return
    if (selectedNode) {
      networkRef.current.selectNodes([selectedNode])
    } else {
      networkRef.current.unselectAll()
    }
  }, [selectedNode])

  const fitToScreen = () => networkRef.current?.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } })
  const zoomIn  = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() ?? 1) * 1.3, animation: { duration: 250 } })
  const zoomOut = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() ?? 1) / 1.3, animation: { duration: 250 } })

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm topology-bg">
      {/* Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 flex flex-col gap-1.5">
        {[
          { label: '+', action: zoomIn,      title: 'Zoom In'      },
          { label: '−', action: zoomOut,     title: 'Zoom Out'     },
          { label: '⊞', action: fitToScreen, title: 'Fit to Screen' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            title={btn.title}
            className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 font-mono text-base shadow-sm hover:bg-slate-50 hover:shadow transition flex items-center justify-center"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
          <p className="text-4xl mb-2">🗺️</p>
          <p className="text-sm font-medium">No devices in topology yet.</p>
          <p className="text-xs">Add devices and links via the Devices page.</p>
        </div>
      )}
    </div>
  )
}
