import { useEffect, useRef, useState } from 'react'
import { Network, DataSet } from 'vis-network/standalone'
import { Cable, Link2Off } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const STATUS_COLORS = {
  up:      { border: '#10b981', background: '#ffffff', highlight: { border: '#059669', background: '#f0fdf4' } },
  down:    { border: '#f43f5e', background: '#ffffff', highlight: { border: '#e11d48', background: '#fff1f2' } },
  unknown: { border: '#94a3b8', background: '#ffffff', highlight: { border: '#64748b', background: '#f8fafc' } },
}

const CONNECT_SOURCE_COLOR = {
  border: '#6366f1', background: '#eef2ff',
  highlight: { border: '#4f46e5', background: '#e0e7ff' },
}

const VENDOR_ICONS = {
  mikrotik: '🔴',
  cisco:    '🔵',
  generic:  '⚪',
}

const TYPE_ICONS = {
  router:   '🌐',
  switch:   '🖧',
  server:   '🖥️',
  ap:       '📡',
  firewall: '🧱',
  other:    '💻',
}

// Generates an SVG Data URI to mimic "The Dude" gradient nodes
const generateNodeSvg = (node) => {
  const isUp = node.status === 'up'
  const isDown = node.status === 'down'

  let gradTop = '#64748b', gradBottom = '#94a3b8' // Slate / Unknown
  let textColor = '#ffffff'

  if (isUp) {
    if (node.data?.type === 'router' || node.data?.type === 'server') {
      // Blue gradient for gateways/servers
      gradTop = '#2563eb'
      gradBottom = '#60a5fa'
    } else {
      // Green gradient for switches/AP/etc
      gradTop = '#059669'
      gradBottom = '#4ade80'
    }
  } else if (isDown) {
    // Red gradient for Down
    gradTop = '#be123c'
    gradBottom = '#f43f5e'
  }

  const icon = TYPE_ICONS[node.data?.type] || (VENDOR_ICONS[node.data?.vendor] ?? '💻')
  const ip = node.data?.ip_address ?? 'No IP'
  const name = node.label || 'Unknown'
  
  // Calculate dynamic width based on text length
  const maxLen = Math.max(name.length, ip.length)
  const width = Math.max(130, maxLen * 8.5)
  const height = 75
  const cx = width / 2

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${gradTop}" />
          <stop offset="100%" stop-color="${gradBottom}" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect x="2" y="2" width="${width-4}" height="${height-4}" rx="6" fill="url(#grad)" filter="url(#shadow)" stroke="#ffffff" stroke-width="1.5" />
      <text x="${cx}" y="28" font-family="sans-serif" font-size="22" text-anchor="middle">${icon}</text>
      <text x="${cx}" y="48" font-family="Inter, sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="${textColor}">${name}</text>
      <text x="${cx}" y="62" font-family="Inter, sans-serif" font-size="10" text-anchor="middle" fill="${textColor}">${ip}</text>
    </svg>
  `
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.trim())
}

const STORAGE_KEY = 'nms_topology_positions'

/**
 * TopologyCanvas — Vis.js network visualization with position persistence
 * and "connect mode" for drawing links between nodes (like Cisco Packet Tracer).
 *
 * Props:
 *   nodes         — array of Vis.js node objects from TopologyResource
 *   edges         — array of Vis.js edge objects
 *   onNodeClick   — callback (nodeId) when a node is clicked (in normal mode)
 *   onCreateLink  — async callback (sourceId, targetId, cableType) => Promise when user completes a connection
 *   selectedNode  — currently selected node id
 *   cableTypes    — array of {name, value, icon} for the connection dropdown
 */
export default function TopologyCanvas({ nodes = [], edges = [], onNodeClick, onEdgeClick, onCreateLink, selectedNode, cableTypes = [] }) {
  const containerRef = useRef(null)
  const networkRef   = useRef(null)
  const visNodesRef  = useRef(null)

  // Connect mode state
  const [connectMode, setConnectMode]   = useState(false)
  const [sourceNodeId, setSourceNodeId] = useState(null)
  const [sourceLabel, setSourceLabel]   = useState('')
  const [isCreating, setIsCreating]     = useState(false)
  const [selectedCableType, setSelectedCableType] = useState('ethernet')

  // Keep ref in sync so event handlers inside useEffect can read latest value
  const connectModeRef  = useRef(false)
  const sourceNodeIdRef = useRef(null)

  useEffect(() => { connectModeRef.current  = connectMode  }, [connectMode])
  useEffect(() => { sourceNodeIdRef.current = sourceNodeId }, [sourceNodeId])

  useEffect(() => {
    if (!containerRef.current) return

    // Load saved positions from localStorage
    let savedPositions = {}
    try {
      savedPositions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      savedPositions = {}
    }

    const hasSavedPositions = Object.keys(savedPositions).length > 0

    const visNodes = new DataSet(
      nodes.map(n => {
        const pos = savedPositions[n.id]
        return {
          id:    n.id,
          label: '', // Label is baked into the SVG
          title: n.title,
          shape: 'image',
          image: generateNodeSvg(n),
          x: pos ? pos.x : undefined,
          y: pos ? pos.y : undefined,
          // Use scaling constraints to prevent SVG from stretching weirdly
          size: 40, 
          shapeProperties: { useImageSize: true },
        }
      })
    )

    visNodesRef.current = visNodes

    const getCableStyle = (e) => {
      let type = 'ethernet'
      if (e.cable_type) {
        type = e.cable_type.toLowerCase()
      } else {
        const label = (e.label || '').toLowerCase()
        if (label.includes('fiber')) type = 'fiber'
        else if (label.includes('serial')) type = 'serial'
        else if (label.includes('wireless') || label.includes('wi-fi')) type = 'wireless'
        else if (label.includes('trunk')) type = 'trunk'
        else if (label.includes('crossover')) type = 'crossover'
      }

      switch (type) {
        case 'fiber':
          return { color: '#f59e0b', width: 3, dashes: false } // amber/orange
        case 'serial':
          return { color: '#ef4444', width: 2, dashes: false } // red
        case 'wireless':
          return { color: '#3b82f6', width: 2, dashes: [5, 5] } // dashed blue
        case 'trunk':
          return { color: '#8b5cf6', width: 5, dashes: false } // thick purple
        case 'crossover':
          return { color: '#10b981', width: 3, dashes: [10, 5] } // dashed green
        default: // ethernet
          return { color: '#000000', width: 3, dashes: false } // solid black
      }
    }

    const visEdges = new DataSet(
      edges.map(e => {
        // Mock a traffic label if one isn't provided natively, to mimic The Dude
        const edgeLabel = e.label || 'Rx: 0 kbps\nTx: 0 kbps'
        const style = getCableStyle(e)
        return {
          id:     e.id,
          from:   e.from,
          to:     e.to,
          label:  edgeLabel,
          dashes: style.dashes,
          color:  { color: style.color, highlight: style.color, hover: '#475569' },
          width:  style.width,
          font:   { 
            size: 11, 
            color: '#000000', 
            background: 'rgba(250,250,250,0.85)', // Slight white background like The Dude
            strokeWidth: 0,
            align: 'middle',
            face: 'sans-serif'
          },
          arrows: { to: { enabled: false } },
          smooth: { type: 'curvedCW', roundness: 0.1 },
        }
      })
    )

    const options = {
      layout:     { improvedLayout: !hasSavedPositions },
      interaction: {
        hover:        true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: true,
        dragNodes: true,
      },
      physics: {
        enabled: !hasSavedPositions,
        barnesHut: {
          gravitationalConstant: -5000,
          centralGravity:        0.3,
          springLength:          160,
          springConstant:        0.04,
          damping:               0.09,
        },
        stabilization: { iterations: 150 },
      },
    }

    const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options)
    networkRef.current = network

    // Save positions of all nodes
    const saveAllPositions = () => {
      const allIds = visNodes.getIds()
      const positions = network.getPositions(allIds)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
      } catch {
        // Ignore localStorage errors
      }
    }

    // Save positions when dragging ends
    network.on('dragEnd', (params) => {
      if (params.nodes.length > 0) {
        saveAllPositions()
      }
    })

    network.on('click', (params) => {
      const { nodes: clickedNodes, edges: clickedEdges, pointer } = params
      const nodeId = clickedNodes[0]
      const edgeId = clickedEdges[0]

      // ── Connect Mode ──────────────────────────────────────────────────────
      if (connectModeRef.current) {
        if (!nodeId) return // clicked on canvas, not a node

        const src = sourceNodeIdRef.current

        if (!src) {
          // Step 1: pick source node
          setSourceNodeId(nodeId)
          const nodeData = visNodes.get(nodeId)
          setSourceLabel(nodeData?.label ?? String(nodeId))
          // Highlight source with distinct color (using a special SVG)
          const highlightNode = JSON.parse(JSON.stringify(nodeData)) // deep copy
          highlightNode.status = 'connecting' // custom status for SVG generator
          
          const svgHighlight = `
            <svg xmlns="http://www.w3.org/2000/svg" width="130" height="75">
              <rect x="2" y="2" width="126" height="71" rx="6" fill="#e0e7ff" stroke="#4f46e5" stroke-width="3" stroke-dasharray="4" />
              <text x="65" y="42" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#4f46e5">Select Target</text>
            </svg>
          `
          visNodes.update({ 
            id: nodeId, 
            image: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgHighlight.trim()) 
          })
        } else if (nodeId === src) {
          // Clicked source again → deselect
          resetSourceNode(visNodes, src, nodes)
          setSourceNodeId(null)
          setSourceLabel('')
        } else {
          // Step 2: pick target → trigger link creation
          setIsCreating(true)
          onCreateLink?.(src, nodeId, selectedCableType).finally(() => {
            resetSourceNode(visNodes, src, nodes)
            setSourceNodeId(null)
            setSourceLabel('')
            setIsCreating(false)
          })
        }
        return
      }

      // ── Normal Mode ───────────────────────────────────────────────────────
      if (nodeId) {
        onEdgeClick?.(null)   // deselect edge when node clicked
        onNodeClick?.(nodeId, pointer.DOM)
      } else if (edgeId) {
        onNodeClick?.(null, null)   // deselect node when edge clicked
        // Find full edge data from raw edges array
        const edgeData = edges.find(e => e.id === edgeId)
        onEdgeClick?.(edgeData ?? { id: edgeId }, pointer.DOM)
      } else {
        onNodeClick?.(null, null)
        onEdgeClick?.(null)
      }
    })

    if (!hasSavedPositions) {
      network.once('stabilizationIterationsDone', () => {
        network.setOptions({ physics: { enabled: false } })
        saveAllPositions()
      })
    }

    // Custom drawing for interface labels near the nodes
    network.on("afterDrawing", (ctx) => {
      const nodePositions = network.getPositions()
      
      edges.forEach(edge => {
        const p1 = nodePositions[edge.from]
        const p2 = nodePositions[edge.to]
        if (!p1 || !p2) return
        
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        // Don't draw if nodes are too close
        if (dist < 130) return 
        
        const drawLabel = (text, isSource) => {
          if (!text) return
          // distance from center of node (node is 130x75, so ~75px radius is edge of node)
          const offset = 85 
          // if distance is very small, fallback to a ratio that keeps it on line
          const actualOffset = Math.min(offset, dist / 2 - 10)
          const ratio = isSource ? (actualOffset / dist) : (1 - (actualOffset / dist))
          
          const lx = p1.x + dx * ratio
          const ly = p1.y + dy * ratio
          
          ctx.font = "bold 10px sans-serif"
          const metrics = ctx.measureText(text)
          const padding = 3
          const w = metrics.width + padding * 2
          const h = 14
          
          // Background
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
          ctx.beginPath()
          ctx.roundRect(lx - w/2, ly - h/2, w, h, 4)
          ctx.fill()
          
          // Text
          ctx.fillStyle = "#334155" // slate-700
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(text, lx, ly + 0.5) // slight vertical tweak
        }
        
        if (edge.data?.source_interface) {
          drawLabel(edge.data.source_interface, true)
        }
        if (edge.data?.target_interface) {
          drawLabel(edge.data.target_interface, false)
        }
      })
    })

    return () => {
      network.destroy()
      networkRef.current  = null
      visNodesRef.current = null
    }
  }, [nodes, edges]) // Re-init when data changes

  // Helper: restore node to its original state (e.g. after connection mode)
  const resetSourceNode = (visNodes, nodeId, rawNodes) => {
    const original = rawNodes.find(n => n.id === nodeId)
    if (original) {
      visNodes.update({
        id:    nodeId,
        image: generateNodeSvg(original),
        shape: 'image'
      })
    }
  }

  // Highlight selected node
  useEffect(() => {
    if (!networkRef.current) return
    if (selectedNode) {
      networkRef.current.selectNodes([selectedNode])
    } else {
      networkRef.current.unselectAll()
    }
  }, [selectedNode])

  const activateConnectMode = (cType) => {
    setSelectedCableType(cType)
    setConnectMode(true)
  }

  const exitConnectMode = () => {
    if (sourceNodeId && visNodesRef.current) {
      resetSourceNode(visNodesRef.current, sourceNodeId, nodes)
      setSourceNodeId(null)
      setSourceLabel('')
    }
    setConnectMode(false)
  }

  const fitToScreen = () => networkRef.current?.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } })
  const zoomIn  = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() ?? 1) * 1.3, animation: { duration: 250 } })
  const zoomOut = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() ?? 1) / 1.3, animation: { duration: 250 } })

  const resetLayout = () => {
    localStorage.removeItem(STORAGE_KEY)
    if (networkRef.current) {
      networkRef.current.setOptions({ physics: { enabled: true } })
      networkRef.current.stabilize()
    }
  }

  return (
    <div
      className={`relative w-full h-full topology-bg transition-all${
        connectMode ? ' cursor-crosshair' : ''
      }`}
    >
      {/* Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Connect Mode Banner */}
      {connectMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3
                        bg-indigo-600 text-white text-sm font-semibold rounded-2xl px-5 py-2.5
                        shadow-xl shadow-indigo-500/30 pointer-events-none select-none
                        animate-in fade-in slide-in-from-top-2 duration-200">
          <Cable size={16} className="shrink-0 animate-pulse" />
          {isCreating ? (
            <span>Creating link…</span>
          ) : sourceNodeId ? (
            <span>
              <span className="opacity-70">Source:</span>
              {' '}<span className="font-bold">{sourceLabel}</span>
              {' '}→ click a target node
            </span>
          ) : (
            <span>Connect Mode — click a source node</span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute bottom-28 right-4 lg:right-6 flex flex-col gap-1.5 z-10">
        {[
          { label: '+', action: zoomIn,      title: 'Zoom In'      },
          { label: '−', action: zoomOut,     title: 'Zoom Out'     },
          { label: '⊞', action: fitToScreen, title: 'Fit to Screen' },
          { label: '↺', action: resetLayout, title: 'Reset Saved Layout' },
        ].map(btn => (
          <button
            key={btn.title}
            onClick={btn.action}
            title={btn.title}
            className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-slate-600 font-mono text-sm shadow-sm hover:bg-slate-50 hover:shadow transition flex items-center justify-center"
          >
            {btn.label}
          </button>
        ))}

        {/* Divider */}
        <div className="w-8 h-px bg-slate-200 my-0.5" />

        {/* Connect Mode Toggle */}
        {connectMode ? (
          <button
            onClick={exitConnectMode}
            title="Exit Connect Mode"
            className="w-8 h-8 rounded-lg text-sm shadow-sm transition flex items-center justify-center border bg-indigo-600 border-indigo-700 text-white shadow-indigo-200"
          >
            <Link2Off size={14} />
          </button>
        ) : (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="Connect Two Nodes"
                className="w-8 h-8 rounded-lg text-sm shadow-sm transition flex items-center justify-center border bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Cable size={14} />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="left"
                align="end"
                sideOffset={12}
                className="z-50 min-w-[160px] bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 animate-in fade-in zoom-in-95"
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-slate-900 text-xs">Select Cable</p>
                </div>
                {cableTypes.map((cable) => (
                  <DropdownMenu.Item
                    key={cable.value}
                    onClick={() => activateConnectMode(cable.value)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer outline-none transition text-xs font-medium"
                  >
                    <span className="text-slate-400 group-hover:text-indigo-500">{cable.icon}</span>
                    {cable.name}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
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
