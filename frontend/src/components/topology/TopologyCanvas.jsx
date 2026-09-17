import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
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

const TYPE_ICONS = {
  router:   `<path d="M5 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"></path><path d="M9 11v-3"></path><path d="M15 11v-3"></path><circle cx="12" cy="16" r="2"></circle>`,
  switch:   `<rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path>`,
  server:   `<rect width="20" height="8" x="2" y="2" rx="2" ry="2"></rect><rect width="20" height="8" x="2" y="14" rx="2" ry="2"></rect><line x1="6" x2="6.01" y1="6" y2="6"></line><line x1="6" x2="6.01" y1="18" y2="18"></line>`,
  ap:       `<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>`,
  firewall: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>`,
  passive:  `<path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path>`,
  other:    `<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line>`,
}

// Generates an SVG Data URI for transparent, icon-centric nodes
const generateNodeSvg = (node) => {
  const isUp = node.status === 'up'
  const isDown = node.status === 'down'

  let statusColor = '#94a3b8' // Slate / Unknown
  if (isUp) {
    statusColor = '#10b981' // Emerald Green for UP
  } else if (isDown) {
    statusColor = '#e11d48' // Rose Red for DOWN
  }

  const iconPath = node.data?.icon_svg || TYPE_ICONS[node.data?.type] || TYPE_ICONS.other
  const ip = node.data?.ip_address ?? 'No IP'
  const name = node.label || 'Unknown'
  
  // Raster images don't respect SVG strokes, so we draw a small status dot
  const hasRasterImage = iconPath.includes('<image')

  let customWidth = 24;
  if (hasRasterImage) {
    const match = iconPath.match(/width="([0-9.]+)"/);
    if (match) customWidth = parseFloat(match[1]);
  }

  const renderedIconWidth = customWidth * 3.5;
  const minCanvasWidth = Math.max(120, renderedIconWidth + 40); // with padding

  // Calculate dynamic width based on text length
  const maxLen = Math.max(name.length, ip.length)
  const width = Math.max(minCanvasWidth, maxLen * 8.5)
  const height = 125
  const cx = width / 2

  const indicatorX = cx + (renderedIconWidth / 2) - 18;

  let statusIndicator = ''
  if (hasRasterImage) {
    if (isUp) {
      statusIndicator = `
        <g transform="translate(${indicatorX}, 10)">
          <path d="M8 12V4M5 7l3-3 3 3" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)" />
          <path d="M8 12V4M5 7l3-3 3 3" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      `
    } else if (isDown) {
      statusIndicator = `
        <g transform="translate(${indicatorX}, 10)">
          <path d="M8 4v8M5 9l3 3 3-3" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)" />
          <path d="M8 4v8M5 9l3 3 3-3" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      `
    } else {
      statusIndicator = `
        <g transform="translate(${indicatorX}, 10)">
          <path d="M4 8h8" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)" />
          <path d="M4 8h8" fill="none" stroke="${statusColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      `
    }
  }

  const escapeXml = (unsafe) => {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }

  const safeName = escapeXml(name)
  const safeIp = escapeXml(ip)

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
        </filter>
        <filter id="grayscale">
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
        </filter>
      </defs>
      
      <!-- Solid Card Background (Opaque to hide edges underneath) -->
      <rect x="4" y="60" width="${width-8}" height="60" rx="14" fill="#ffffff" stroke="${statusColor}" stroke-width="2.5" filter="url(#shadow)" />
      
      <!-- Icon Container -->
      <g transform="translate(${cx - 42}, 0) scale(3.5)" fill="none" stroke="${statusColor}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" ${isDown ? 'filter="url(#grayscale)"' : ''}>
        ${iconPath}
      </g>
      
      <!-- Status Indicator for Raster Images -->
      ${statusIndicator}

      <!-- Text Labels -->
      <text x="${cx}" y="98" font-family="Inter, sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="#1e293b">${safeName}</text>
      <text x="${cx}" y="114" font-family="Inter, sans-serif" font-size="10" text-anchor="middle" fill="#64748b">${safeIp}</text>
    </svg>
  `
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.trim())
}

const STORAGE_KEY = 'nms_topology_positions'

/**
 * TopologyCanvas - Vis.js network visualization with position persistence
 * and "connect mode" for drawing links between nodes (like Cisco Packet Tracer).
 *
 * Props:
 *   nodes         - array of Vis.js node objects from TopologyResource
 *   edges         - array of Vis.js edge objects
 *   onNodeClick   - callback (nodeId) when a node is clicked (in normal mode)
 *   onCreateLink  - async callback (sourceId, targetId, cableType) => Promise when user completes a connection
 *   selectedNode  - currently selected node id
 *   cableTypes    - array of {name, value, icon} for the connection dropdown
 */
const TopologyCanvas = forwardRef(function TopologyCanvas({ 
  nodes = [], 
  edges = [], 
  shapes = [], 
  positions: backendPositions = null,
  selectedShapeId = null,
  onSelectShape,
  editingShapeId = null,
  setEditingShapeId,
  drawingMode = null, 
  onShapeDrawn, 
  onShapeUpdate, 
  onNodeClick, 
  onEdgeClick, 
  onCreateLink, 
  selectedNode, 
  onSelectionChange, 
  cableTypes = [], 
  disableKeyboard = false, 
  clusterClients = true 
}, ref) {
  const containerRef = useRef(null)
  const networkRef   = useRef(null)
  const visNodesRef  = useRef(null)
  const visEdgesRef  = useRef(null)

  useImperativeHandle(ref, () => ({
    getPositions: () => {
      if (!networkRef.current || !visNodesRef.current) return {}
      const allIds = visNodesRef.current.getIds()
      return networkRef.current.getPositions(allIds)
    },
    getViewPosition: () => {
      if (!networkRef.current) return { x: 0, y: 0 }
      return networkRef.current.getViewPosition()
    }
  }))

  // Connect mode state
  const [connectMode, setConnectMode]   = useState(false)
  const [sourceNodeId, setSourceNodeId] = useState(null)
  const [sourceLabel, setSourceLabel]   = useState('')
  const [isCreating, setIsCreating]     = useState(false)
  const [selectedCableType, setSelectedCableType] = useState('ethernet')

  // Inline edit state
  const [inlineText, setInlineText] = useState('')

  useEffect(() => {
    if (editingShapeId) {
      const editingShape = shapesRef.current?.find(s => s.id === editingShapeId)
      if (editingShape) {
        setInlineText(editingShape.text_content || '')
      }
    }
  }, [editingShapeId])

  // Keep ref in sync so event handlers inside useEffect can read latest value
  const connectModeRef  = useRef(false)
  const sourceNodeIdRef = useRef(null)
  const selectedCableTypeRef = useRef('ethernet')
  
  const drawingModeRef  = useRef(null)
  const shapesRef       = useRef([])
  const onShapeDrawnRef = useRef(onShapeDrawn)
  const onShapeUpdateRef = useRef(onShapeUpdate)
  const selectedShapeIdRef = useRef(selectedShapeId)
  const onSelectShapeRef   = useRef(onSelectShape)

  useEffect(() => { 
    selectedShapeIdRef.current = selectedShapeId
    if (networkRef.current) {
      networkRef.current.redraw()
    }
  }, [selectedShapeId])
  useEffect(() => { onSelectShapeRef.current = onSelectShape }, [onSelectShape])

  useEffect(() => { connectModeRef.current  = connectMode  }, [connectMode])
  useEffect(() => { sourceNodeIdRef.current = sourceNodeId }, [sourceNodeId])
  useEffect(() => { selectedCableTypeRef.current = selectedCableType }, [selectedCableType])
  useEffect(() => { drawingModeRef.current  = drawingMode  }, [drawingMode])
  useEffect(() => { shapesRef.current       = shapes       }, [shapes])
  useEffect(() => { onShapeDrawnRef.current = onShapeDrawn }, [onShapeDrawn])
  useEffect(() => { onShapeUpdateRef.current = onShapeUpdate }, [onShapeUpdate])

  // Custom DOM interaction state
  const interactionRef = useRef({
    isDrawing: false,
    isPanning: false,
    isMovingShape: false,
    movingShapeId: null,
    initialShapeX: 0,
    initialShapeY: 0,
    startX: 0,
    startY: 0,
    boxDiv: null,
  })

  // Dynamically enable/disable keyboard shortcuts when a modal opens/closes
  useEffect(() => {
    if (!networkRef.current) return
    networkRef.current.setOptions({ interaction: { keyboard: !disableKeyboard } })
  }, [disableKeyboard])

  const prevClusterClientsRef = useRef(clusterClients)



  useEffect(() => {
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy()
        networkRef.current = null
        visNodesRef.current = null
        visEdgesRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    // Load saved positions: prioritize backend positions if available, fallback to localStorage
    let savedPositions = {}
    if (backendPositions && typeof backendPositions === 'object' && Object.keys(backendPositions).length > 0) {
      savedPositions = backendPositions
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backendPositions))
      } catch {
        // Ignore localStorage error
      }
    } else {
      try {
        savedPositions = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      } catch {
        savedPositions = {}
      }
    }

    const hasSavedPositions = Object.keys(savedPositions).length > 0
    // Only force global hierarchical layout on the very first load when no positions exist
    const useHierarchical = !hasSavedPositions

    let unsavedIndex = 0

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

    // Reset unsaved children count on every render so they don't drift away on re-renders
    window.__unsavedChildrenCount = {};

    // Clone nodes so we can safely mutate status for cascading offline states
    const displayNodes = nodes.map(n => ({ ...n }));
    const nodeMap = new Map();
    displayNodes.forEach(n => nodeMap.set(n.id, n));

    // Build adjacency list to propagate 'down' status through passive devices
    const adj = new Map();
    edges.forEach(e => {
      if (!adj.has(e.from)) adj.set(e.from, []);
      if (!adj.has(e.to)) adj.set(e.to, []);
      adj.get(e.from).push(e.to);
      adj.get(e.to).push(e.from);
    });

    // BFS Queue starting with explicitly 'down' nodes
    const queue = displayNodes.filter(n => n.status === 'down').map(n => n.id);
    const visited = new Set(queue);

    while (queue.length > 0) {
      const currId = queue.shift();
      const neighbors = adj.get(currId) || [];
      
      for (const neighborId of neighbors) {
        const neighborNode = nodeMap.get(neighborId);
        if (!neighborNode) continue;
        
        // Passive devices propagate the 'down' state
        const isPassive = neighborNode.data?.type === 'passive' || !neighborNode.data?.ip_address;
        if (isPassive && !visited.has(neighborId)) {
          neighborNode.status = 'down'; // Cascade visually
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    
    const formattedNodes = displayNodes.map(n => {
      let pos = savedPositions[n.id]

      if (hasSavedPositions && !pos) {
        const parentEdge = edges.find(e => e.to === n.id || e.from === n.id)
        let parentPos = { x: 0, y: 0 }
        let parentIdStr = 'root'
        
        if (parentEdge) {
          const parentId = parentEdge.to === n.id ? parentEdge.from : parentEdge.to
          if (savedPositions[parentId]) {
            parentPos = savedPositions[parentId]
            parentIdStr = String(parentId)
          }
        } else if (networkRef.current) {
          // If it has no links, spawn it near the current camera view instead of (0,0)
          parentPos = networkRef.current.getViewPosition()
        }
        
        // Initialize if not exists
        if (!window.__unsavedChildrenCount) window.__unsavedChildrenCount = {};
        window.__unsavedChildrenCount[parentIdStr] = (window.__unsavedChildrenCount[parentIdStr] || 0) + 1;
        
        const childIndex = window.__unsavedChildrenCount[parentIdStr] - 1;
        const cols = 4; // 4 columns max
        const col = childIndex % cols;
        const row = Math.floor(childIndex / cols);
        
        pos = {
          x: parentPos.x + (parentEdge ? 250 : 0) + (col * 160),
          y: parentPos.y + (row * 100) - (parentEdge ? 50 : 0)
        }
      }

      return {
        id:    n.id,
        label: '', 
        title: n.title,
        shape: 'image',
        image: generateNodeSvg(n),
        x: pos ? pos.x : undefined,
        y: pos ? pos.y : undefined,
        size: 40, 
        shapeProperties: { useImageSize: true },
        data: n.data,
      }
    })

    const formattedEdges = edges.map(e => {
      let edgeLabel = e.label || 'Rx: 0 kbps\nTx: 0 kbps'
      let style = getCableStyle(e)

      const nodeFrom = displayNodes.find(n => n.id === e.from)
      const nodeTo = displayNodes.find(n => n.id === e.to)
      const isDead = (nodeFrom && nodeFrom.status === 'down') || (nodeTo && nodeTo.status === 'down')

      if (isDead) {
        edgeLabel = '❌ OFFLINE'
        style = { color: '#ef4444', width: 2, dashes: [5, 5] } // Red dashed line
      }

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
          background: 'rgba(250,250,250,0.85)',
          strokeWidth: 0,
          align: 'middle',
          face: 'sans-serif'
        },
        arrows: { to: { enabled: false } },
        smooth: { type: 'curvedCW', roundness: 0.1 },
      }
    })

    // Convert shapes to invisible Vis.js nodes so they can be multi-selected and dragged
    const shapeDummyNodes = (shapes || []).map(s => ({
      id: `shape_${s.id}`,
      shape: 'box',
      x: s.x + s.width / 2,
      y: s.y + s.height / 2,
      widthConstraint: { minimum: 0, maximum: 0 },
      heightConstraint: { minimum: 0, maximum: 0 },
      color: {
        background: 'rgba(0,0,0,0)',
        border: 'rgba(0,0,0,0)',
        highlight: {
          background: 'rgba(0,0,0,0)',
          border: '#3b82f6'
        },
        hover: {
          background: 'rgba(0,0,0,0)',
          border: 'rgba(0,0,0,0)'
        }
      },
      font: { color: 'rgba(0,0,0,0)' },
      label: ' ', // non-empty to force box size
      isShape: true,
    }))

    const allFormattedNodes = [...shapeDummyNodes, ...formattedNodes]

    // If network exists, just smart-update the datasets
    if (networkRef.current && visNodesRef.current && visEdgesRef.current && prevClusterClientsRef.current === clusterClients) {
      const vNodes = visNodesRef.current
      const vEdges = visEdgesRef.current

      const existingNodeIds = vNodes.getIds()
      const newNodeIds = allFormattedNodes.map(n => n.id)
      const toRemoveNodes = existingNodeIds.filter(id => !newNodeIds.includes(id) && !String(id).startsWith('cluster_'))
      vNodes.remove(toRemoveNodes)
      
      // Update nodes, explicitly grabbing their actual current positions from the canvas
      // so they don't snap back to stale dataset coordinates
      const currentPositions = networkRef.current.getPositions()
      const updateNodes = allFormattedNodes.map(fn => {
        const existing = vNodes.get(fn.id)
        if (existing) {
          const currentPos = currentPositions[fn.id] || {}
          return { 
            ...existing, 
            image: fn.image, 
            title: fn.title, 
            data: fn.data,
            x: currentPos.x ?? existing.x,
            y: currentPos.y ?? existing.y
          }
        }
        return fn
      })
      vNodes.update(updateNodes)

      const existingEdgeIds = vEdges.getIds()
      const newEdgeIds = formattedEdges.map(e => e.id)
      const toRemoveEdges = existingEdgeIds.filter(id => !newEdgeIds.includes(id))
      vEdges.remove(toRemoveEdges)
      vEdges.update(formattedEdges)
      
      return // Skip recreation!
    }

    prevClusterClientsRef.current = clusterClients

    const visNodes = new DataSet(allFormattedNodes)
    const visEdges = new DataSet(formattedEdges)
    visNodesRef.current = visNodes
    visEdgesRef.current = visEdges

    const options = {
      layout: {
        improvedLayout: useHierarchical,
        hierarchical: useHierarchical ? {
          enabled: true,
          direction: 'LR', // Left-Right (stacks nodes vertically like a list)
          sortMethod: 'directed', // Places nodes based on link directions
          nodeSpacing: 100, // Vertical spacing between nodes in the same column
          levelSeparation: 350, // Horizontal distance between router and its clients
        } : false,
      },
      interaction: {
        hover:        true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: !disableKeyboard,
        dragNodes: true,
        multiselect: true,
        dragView: false, // Permanently disable native left-click panning
      },
      physics: {
        enabled: useHierarchical || !hasSavedPositions,
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

    // No need for VisJS drag listeners anymore, we handle them via DOM events to avoid VisJS limitations
    network.on("dragEnd", (params) => {
      if (params.nodes.length > 0) {
        saveAllPositions()
      }
    })




    network.on("selectNode", (params) => {
      onSelectionChange?.(params.nodes.filter(id => !String(id).startsWith('cluster_') && !String(id).startsWith('shape_')))
    })

    network.on("deselectNode", (params) => {
      onSelectionChange?.(params.nodes.filter(id => !String(id).startsWith('cluster_') && !String(id).startsWith('shape_')))
    })

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

        const movedShapes = params.nodes.filter(id => String(id).startsWith('shape_'))
        if (movedShapes.length > 0) {
          const positions = network.getPositions(movedShapes)
          movedShapes.forEach(id => {
            const originalId = String(id).replace('shape_', '')
            const s = shapesRef.current?.find(shape => String(shape.id) === originalId)
            if (s) {
              const pos = positions[id]
              const newX = Math.round(pos.x - s.width / 2)
              const newY = Math.round(pos.y - s.height / 2)
              // Update shape state and backend if it moved
              if (s.x !== newX || s.y !== newY) {
                s.x = newX
                s.y = newY
                onShapeUpdate?.(s.id, s)
              }
            }
          })
        }
      }
    })

    network.on('click', (params) => {
      const { nodes: clickedNodes, edges: clickedEdges, pointer } = params
      let nodeId = clickedNodes[0]
      const edgeId = clickedEdges[0]

      // Fix click on device if there is a shape behind/in front of it
      if (!nodeId || String(nodeId).startsWith('shape_')) {
        const { x, y } = pointer.canvas
        const allNodes = visNodes.get()
        for (const node of allNodes) {
          if (!String(node.id).startsWith('shape_')) {
            const bbox = network.getBoundingBox(node.id)
            if (bbox && x >= bbox.left && x <= bbox.right && y >= bbox.top && y <= bbox.bottom) {
              nodeId = node.id
              network.selectNodes([nodeId]) // Force vis-network to select the device
              onSelectionChange?.([nodeId]) // Inform parent of the new selection
              break
            }
          }
        }
      }

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
          onCreateLink?.(src, nodeId, selectedCableTypeRef.current).finally(() => {
            resetSourceNode(visNodes, src, nodes)
            setSourceNodeId(null)
            setSourceLabel('')
            setIsCreating(false)
          })
        }
        return
      }

      // ── Check Shape Selection ───────────────────────────────────────────
      const canvasPos = pointer.canvas
      const currentShapes = shapesRef.current || []
      const clickedShape = [...currentShapes].reverse().find(s => {
        const minX = Math.min(s.x, s.x + s.width)
        const maxX = Math.max(s.x, s.x + s.width)
        const minY = Math.min(s.y, s.y + s.height)
        const maxY = Math.max(s.y, s.y + s.height)
        return canvasPos.x >= minX && canvasPos.x <= maxX && canvasPos.y >= minY && canvasPos.y <= maxY
      })

      if (clickedShape && (!nodeId || String(nodeId).startsWith('shape_'))) {
        onSelectShapeRef.current?.(clickedShape.id)
      } else {
        onSelectShapeRef.current?.(null)
      }

      // ── Normal Mode ───────────────────────────────────────────────────────
      if (nodeId) {
        onEdgeClick?.(null)   // deselect edge when node clicked
        if (!String(nodeId).startsWith('shape_')) {
          onNodeClick?.(nodeId, pointer.DOM)
        } else {
          onNodeClick?.(null, null)
        }
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

    // Draw background shapes
    network.on("beforeDrawing", (ctx) => {
      const currentShapes = shapesRef.current || []
      
      // Get real-time positions of the dummy shape nodes (if they exist) so shapes move smoothly while dragging
      const shapeNodeIds = currentShapes.map(s => `shape_${s.id}`)
      const positions = network.getPositions(shapeNodeIds)

      currentShapes.forEach(shape => {
        let sx = shape.x
        let sy = shape.y
        const pos = positions[`shape_${shape.id}`]
        if (pos) {
          sx = pos.x - shape.width / 2
          sy = pos.y - shape.height / 2
        }

        ctx.beginPath()
        if (shape.fill_color) {
          ctx.fillStyle = shape.fill_color
        }
        if (shape.border_color) {
          ctx.strokeStyle = shape.border_color
          ctx.lineWidth = 2
        }

        if (shape.type === 'rect') {
          ctx.roundRect(sx, sy, shape.width, shape.height, 8)
        } else if (shape.type === 'ellipse') {
          ctx.ellipse(sx + shape.width/2, sy + shape.height/2, Math.abs(shape.width/2), Math.abs(shape.height/2), 0, 0, 2 * Math.PI)
        }

        if (shape.fill_color) ctx.fill()
        if (shape.border_color) ctx.stroke()

        if (shape.text_content) {
          ctx.save()
          ctx.fillStyle = shape.border_color || '#334155'
          const fontSize = shape.font_size || 14
          ctx.font = `600 ${fontSize}px Inter, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const lines = shape.text_content.split('\n')
          const lineHeight = Math.round(fontSize * 1.3)
          const totalHeight = lines.length * lineHeight
          const startY = sy + shape.height / 2 - totalHeight / 2 + lineHeight / 2
          lines.forEach((line, i) => {
            ctx.fillText(line, sx + shape.width / 2, startY + i * lineHeight)
          })
          ctx.restore()
        }

        // Highlight shape if selected
        if (selectedShapeIdRef.current && shape.id === selectedShapeIdRef.current) {
          ctx.save()
          ctx.strokeStyle = '#4f46e5'
          ctx.lineWidth = 2.5
          ctx.setLineDash([6, 4])
          if (shape.type === 'rect') {
            ctx.strokeRect(sx - 3, sy - 3, shape.width + 6, shape.height + 6)
            ctx.fillStyle = '#ffffff'
            ctx.strokeStyle = '#4f46e5'
            ctx.setLineDash([])
            const handleSize = 6
            const corners = [
              [sx - 3, sy - 3],
              [sx + shape.width + 3, sy - 3],
              [sx - 3, sy + shape.height + 3],
              [sx + shape.width + 3, sy + shape.height + 3],
            ]
            corners.forEach(([cx, cy]) => {
              ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize)
              ctx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize)
            })
          } else if (shape.type === 'ellipse') {
            ctx.beginPath()
            ctx.ellipse(sx + shape.width/2, sy + shape.height/2, Math.abs(shape.width/2) + 4, Math.abs(shape.height/2) + 4, 0, 0, 2 * Math.PI)
            ctx.stroke()
          }
          ctx.restore()
        }
      })
    })

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

    // Cleanup is now handled by the unmount useEffect above
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
    if (!networkRef.current || !visNodesRef.current) return
    if (selectedNode && visNodesRef.current.get(selectedNode)) {
      try {
        networkRef.current.selectNodes([selectedNode])
      } catch (err) {
        console.warn("Failed to select node:", selectedNode, err)
      }
    } else {
      networkRef.current.unselectAll()
    }
  }, [selectedNode])

  // Clustering logic
  useEffect(() => {
    if (!networkRef.current) return
    const network = networkRef.current

    // Uncluster everything first
    const currentClusters = network.body.nodeIndices.filter(id => network.isCluster(id))
    currentClusters.forEach(clusterId => {
      try { network.openCluster(clusterId) } catch (e) {}
    })

    if (clusterClients) {
      // Find all hubs (infrastructure nodes)
      const hubs = nodes.filter(n => n.data?.device_role === 'infrastructure')
      
      hubs.forEach(hub => {
        network.cluster({
          joinCondition: function (childOptions) {
            if (!childOptions.data || childOptions.data.device_role !== 'end_user') return false
            // Check if this end_user is connected to this specific hub
            const isConnected = edges.some(e => 
              (e.from === hub.id && e.to === childOptions.id) || 
              (e.to === hub.id && e.from === childOptions.id)
            )
            return isConnected
          },
          processProperties: function (clusterOptions, childNodes, childEdges) {
            let totalChildren = 0;
            childNodes.forEach(function (childNode) {
              if (childNode.isCluster) {
                totalChildren += childNode.clusterSize || 1;
              } else {
                totalChildren += 1;
              }
            });
            
            clusterOptions.clusterSize = totalChildren;
            
            const svgCluster = `
              <svg xmlns="http://www.w3.org/2000/svg" width="130" height="75">
                <defs>
                  <linearGradient id="cgrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#f59e0b" />
                    <stop offset="100%" stop-color="#d97706" />
                  </linearGradient>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                  </filter>
                </defs>
                <rect x="2" y="2" width="126" height="71" rx="6" fill="url(#cgrad)" filter="url(#shadow)" stroke="#ffffff" stroke-width="1.5" />
                <text x="65" y="35" font-family="sans-serif" font-size="24" text-anchor="middle">👥</text>
                <text x="65" y="55" font-family="Inter, sans-serif" font-size="12" font-weight="600" text-anchor="middle" fill="#ffffff">+ ${totalChildren} Clients</text>
              </svg>
            `
            
            clusterOptions.image = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgCluster.trim())
            clusterOptions.shape = 'image'
            clusterOptions.size = 40
            clusterOptions.shapeProperties = { useImageSize: true }
            return clusterOptions;
          },
          clusterNodeProperties: {
            id: 'cluster_' + hub.id,
            allowSingleNodeCluster: true,
            // When opened, release nodes
          }
        })
      })
    }

    // Handle double click to open clusters or edit shape text
    const handleDoubleClick = (params) => {
      const { pointer } = params
      
      // Check shape hit test first
      const canvasPos = pointer.canvas
      const currentShapes = shapesRef.current || []
      const clickedShape = [...currentShapes].reverse().find(s => {
        const minX = Math.min(s.x, s.x + s.width)
        const maxX = Math.max(s.x, s.x + s.width)
        const minY = Math.min(s.y, s.y + s.height)
        const maxY = Math.max(s.y, s.y + s.height)
        return canvasPos.x >= minX && canvasPos.x <= maxX && canvasPos.y >= minY && canvasPos.y <= maxY
      })

      if (clickedShape) {
        if (setEditingShapeId) {
          setEditingShapeId(clickedShape.id)
        }
        return
      }

      if (params.nodes.length == 1) {
        if (network.isCluster(params.nodes[0])) {
          network.openCluster(params.nodes[0], {
            releaseFunction: function (clusterPosition, containedNodesPositions) {
              return containedNodesPositions; // Keep original physics layout positions
            }
          })
        }
      }
    }
    
    network.on('doubleClick', handleDoubleClick)
    
    return () => {
      network.off('doubleClick', handleDoubleClick)
    }
  }, [clusterClients, nodes, edges])

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

  const handlePointerDown = (e) => {
    if (!networkRef.current) return
    const network = networkRef.current

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if we clicked on a node or edge
    const nodeId = network.getNodeAt({x, y})
    const edgeId = network.getEdgeAt({x, y})

    if (e.button === 0) { // Left click
      if (!nodeId && !edgeId) {
        
        // 1. Check if we clicked on an existing shape FIRST
        const canvasPos = network.DOMtoCanvas({x, y})
        const currentShapes = shapesRef.current || []
        // Search backwards to pick the shape on top
        const clickedShape = [...currentShapes].reverse().find(s => {
          const minX = Math.min(s.x, s.x + s.width)
          const maxX = Math.max(s.x, s.x + s.width)
          const minY = Math.min(s.y, s.y + s.height)
          const maxY = Math.max(s.y, s.y + s.height)
          return canvasPos.x >= minX && canvasPos.x <= maxX && canvasPos.y >= minY && canvasPos.y <= maxY
        })

        if (clickedShape && !drawingModeRef.current) {
          // Enter shape moving mode
          const state = interactionRef.current
          state.isMovingShape = true
          state.movingShapeId = clickedShape.id
          state.startX = canvasPos.x
          state.startY = canvasPos.y
          state.initialShapeX = clickedShape.x
          state.initialShapeY = clickedShape.y
          // Prevent other interactions
          return
        }

        // 2. Start drawing box or marquee
        const state = interactionRef.current
        state.isDrawing = true
        state.startX = x
        state.startY = y

        const box = document.createElement('div')
        const currentMode = drawingModeRef.current
        if (currentMode) {
          box.style.border = `2px solid ${currentMode.border}`
          box.style.backgroundColor = currentMode.color
          box.style.position = 'absolute'
          if (currentMode.type === 'ellipse') box.style.borderRadius = '50%'
        } else {
          box.className = 'absolute border border-indigo-500 bg-indigo-500/20 pointer-events-none z-50'
        }
        
        box.classList.add('absolute', 'pointer-events-none', 'z-50')
        containerRef.current.appendChild(box)
        state.boxDiv = box
      }
    } else if (e.button === 2) { // Right click
      const state = interactionRef.current
      state.isPanning = true
      state.startX = x
      state.startY = y
      
      // Stop VisJS from doing anything else by changing selection state
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }

  const handlePointerMove = (e) => {
    if (!networkRef.current) return
    const state = interactionRef.current
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (state.isMovingShape) {
      const canvasPos = networkRef.current.DOMtoCanvas({x, y})
      const dx = canvasPos.x - state.startX
      const dy = canvasPos.y - state.startY
      
      const currentShapes = shapesRef.current || []
      const shapeToMove = currentShapes.find(s => s.id === state.movingShapeId)
      if (shapeToMove) {
        shapeToMove.x = state.initialShapeX + dx
        shapeToMove.y = state.initialShapeY + dy
        if (visNodesRef.current) {
          visNodesRef.current.update({
            id: `shape_${shapeToMove.id}`,
            x: shapeToMove.x + shapeToMove.width / 2,
            y: shapeToMove.y + shapeToMove.height / 2
          })
        }
        networkRef.current.redraw()
      }
    } else if (state.isDrawing && state.boxDiv) {
      const left   = Math.min(state.startX, x)
      const top    = Math.min(state.startY, y)
      const width  = Math.abs(x - state.startX)
      const height = Math.abs(y - state.startY)

      state.boxDiv.style.left   = left + 'px'
      state.boxDiv.style.top    = top + 'px'
      state.boxDiv.style.width  = width + 'px'
      state.boxDiv.style.height = height + 'px'
    } else if (state.isPanning) {
      const network = networkRef.current
      const dx = state.startX - x
      const dy = state.startY - y
      
      const currentPos = network.getViewPosition()
      const scale = network.getScale()
      network.moveTo({
        position: { x: currentPos.x + dx / scale, y: currentPos.y + dy / scale },
        scale: scale,
        animation: false
      })
      
      state.startX = x
      state.startY = y
    }
  }

  const handlePointerUp = (e) => {
    if (!networkRef.current) return
    const state = interactionRef.current
    const network = networkRef.current
    
    if (state.isPanning) {
      state.isPanning = false
    }

    if (state.isMovingShape) {
      state.isMovingShape = false
      const currentShapes = shapesRef.current || []
      const shapeToMove = currentShapes.find(s => s.id === state.movingShapeId)
      if (shapeToMove && onShapeUpdateRef.current) {
        onShapeUpdateRef.current(shapeToMove.id, {
          x: Math.round(shapeToMove.x),
          y: Math.round(shapeToMove.y)
        })
      }
      state.movingShapeId = null
      return
    }

    if (state.isDrawing && state.boxDiv) {
      state.isDrawing = false
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (state.boxDiv.parentNode) {
        containerRef.current.removeChild(state.boxDiv)
      }
      state.boxDiv = null

      const width  = Math.abs(x - state.startX)
      const height = Math.abs(y - state.startY)

      if (width > 20 && height > 20) {
        const currentMode = drawingModeRef.current
        const left   = Math.min(state.startX, x)
        const top    = Math.min(state.startY, y)

        if (currentMode) {
          const topLeft = network.DOMtoCanvas({ x: left, y: top })
          const botRight = network.DOMtoCanvas({ x: left + width, y: top + height })
          
          const shapeData = {
            type: currentMode.type,
            x: Math.round(topLeft.x),
            y: Math.round(topLeft.y),
            width: Math.round(botRight.x - topLeft.x),
            height: Math.round(botRight.y - topLeft.y),
            fill_color: currentMode.type === 'text' ? null : currentMode.color,
            border_color: currentMode.type === 'text' ? '#334155' : currentMode.border, // text color uses border_color
            text_content: currentMode.type === 'text' ? 'New Text' : undefined
          }
          if (onShapeDrawnRef.current) onShapeDrawnRef.current(shapeData)
        } else {
          // Marquee selection mode
          const nodePositions = network.getPositions()
          const selectedIds = []
          Object.keys(nodePositions).forEach(nodeId => {
            const posCanvas = nodePositions[nodeId]
            const posDOM = network.canvasToDOM(posCanvas)
            if (posDOM.x >= left && posDOM.x <= left + width && posDOM.y >= top && posDOM.y <= top + height) {
              if (!String(nodeId).startsWith('cluster_')) {
                selectedIds.push(nodeId)
              }
            }
          })

          if (selectedIds.length > 0) {
            network.selectNodes(selectedIds)
            onSelectionChange?.(selectedIds)
          }
        }
      }
    }
  }

  return (
    <div
      className={`relative w-full h-full topology-bg transition-all${
        connectMode ? ' cursor-crosshair' : ''
      }`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Canvas */}
      <div ref={containerRef} className="relative w-full h-full" />

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
            <span>Connect Mode - click a source node</span>
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

      {/* Inline Text Editor */}
      {editingShapeId && networkRef.current && (() => {
        const editingShape = shapes.find(s => s.id === editingShapeId)
        if (!editingShape) return null
        
        const posCanvas = { x: editingShape.x + editingShape.width / 2, y: editingShape.y + editingShape.height / 2 }
        const posDOM = networkRef.current.canvasToDOM(posCanvas)
        return (
          <textarea
            autoFocus
            value={inlineText}
            onChange={(e) => setInlineText(e.target.value)}
            onBlur={() => {
              if (onShapeUpdate && inlineText !== (editingShape.text_content || '')) {
                onShapeUpdate(editingShape.id, { ...editingShape, text_content: inlineText })
                editingShape.text_content = inlineText
              }
              if (setEditingShapeId) setEditingShapeId(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (setEditingShapeId) setEditingShapeId(null)
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.target.blur() // trigger onBlur
              }
            }}
            style={{
              position: 'absolute',
              left: posDOM.x,
              top: posDOM.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 100,
              minWidth: Math.max(editingShape.width, 150),
              minHeight: Math.max(editingShape.height, 40),
              textAlign: 'center',
              resize: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #4f46e5',
              borderRadius: '8px',
              padding: '8px',
              outline: 'none',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              fontFamily: 'Inter, sans-serif',
              fontSize: `${editingShape.font_size || 14}px`,
              fontWeight: 600,
              color: '#334155'
            }}
          />
        )
      })()}
    </div>
  )
})

export default TopologyCanvas
