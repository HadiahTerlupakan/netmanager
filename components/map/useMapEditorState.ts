"use client"

import { useCallback, useMemo, useState } from 'react'
import type { LeafletMouseEvent, Marker } from 'leaflet'

import { determineFiberType } from '@/components/map/map-utils'
import type { FiberFormData, MappingNode } from '@/components/map/map-types'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type NodeActionMode = 'idle' | 'adding' | 'editing'
type FiberLineMode = 'idle' | 'drawing'
type NodeTool = 'server' | 'odc' | 'odp' | 'ont' | 'pole' | 'joinbox'
type Position = [number, number]
type DeleteConfirmation = { type: 'node' | 'edge'; id: string } | null

const NODE_TOOL_CONFIG: Record<NodeTool, { formType: string; capacity: number; addMessage: string }> = {
  server: { formType: 'olt', capacity: 16, addMessage: 'Click on map to place Server/OLT' },
  odc: { formType: 'odc', capacity: 8, addMessage: 'Click on map to place ODC' },
  odp: { formType: 'odp', capacity: 8, addMessage: 'Click on map to place ODP' },
  ont: { formType: 'ont', capacity: 1, addMessage: 'Click on map to place ONT' },
  pole: { formType: 'pole', capacity: 0, addMessage: 'Click on map to place Pole' },
  joinbox: { formType: 'joinbox', capacity: 24, addMessage: 'Click on map to place Joinbox' },
}

interface UseMapEditorStateParams {
  showToast: (type: ToastType, message: string, duration?: number) => void
  updateNodePosition: (nodeId: string, position: Position) => Promise<void>
}

export function useMapEditorState({ showToast, updateNodePosition }: UseMapEditorStateParams) {
  const [serverActionMode, setServerActionMode] = useState<NodeActionMode>('idle')
  const [odcActionMode, setOdcActionMode] = useState<NodeActionMode>('idle')
  const [odpActionMode, setOdpActionMode] = useState<NodeActionMode>('idle')
  const [ontActionMode, setOntActionMode] = useState<NodeActionMode>('idle')
  const [poleActionMode, setPoleActionMode] = useState<NodeActionMode>('idle')
  const [joinboxActionMode, setJoinboxActionMode] = useState<NodeActionMode>('idle')

  const [serverTempPosition, setServerTempPosition] = useState<Position | null>(null)
  const [odcTempPosition, setOdcTempPosition] = useState<Position | null>(null)
  const [odpTempPosition, setOdpTempPosition] = useState<Position | null>(null)
  const [ontTempPosition, setOntTempPosition] = useState<Position | null>(null)
  const [poleTempPosition, setPoleTempPosition] = useState<Position | null>(null)
  const [joinboxTempPosition, setJoinboxTempPosition] = useState<Position | null>(null)

  const [selectedServerNode, setSelectedServerNode] = useState<MappingNode | null>(null)
  const [selectedOdcNode, setSelectedOdcNode] = useState<MappingNode | null>(null)
  const [selectedOdpNode, setSelectedOdpNode] = useState<MappingNode | null>(null)
  const [selectedOntNode, setSelectedOntNode] = useState<MappingNode | null>(null)
  const [selectedPoleNode, setSelectedPoleNode] = useState<MappingNode | null>(null)
  const [selectedJoinboxNode, setSelectedJoinboxNode] = useState<MappingNode | null>(null)

  const [fiberLineMode, setFiberLineMode] = useState<FiberLineMode>('idle')
  const [fiberSourceNode, setFiberSourceNode] = useState<MappingNode | null>(null)
  const [fiberWaypoints, setFiberWaypoints] = useState<Position[]>([])

  const [showNodeForm, setShowNodeForm] = useState(false)
  const [nodeFormType, setNodeFormType] = useState<string>('odp')
  const [nodeFormData, setNodeFormData] = useState<Partial<MappingNode>>({})
  const [editingNode, setEditingNode] = useState<MappingNode | null>(null)

  const [showFiberForm, setShowFiberForm] = useState(false)
  const [fiberFormData, setFiberFormData] = useState<FiberFormData | null>(null)

  const [isManualAdd, setIsManualAdd] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null)

  const handleFiberLineCancel = useCallback(() => {
    setFiberLineMode('idle')
    setFiberSourceNode(null)
    setFiberWaypoints([])
  }, [])

  const cancelNodeTool = useCallback((tool: NodeTool) => {
    switch (tool) {
      case 'server':
        setServerActionMode('idle')
        setServerTempPosition(null)
        setSelectedServerNode(null)
        return
      case 'odc':
        setOdcActionMode('idle')
        setOdcTempPosition(null)
        setSelectedOdcNode(null)
        return
      case 'odp':
        setOdpActionMode('idle')
        setOdpTempPosition(null)
        setSelectedOdpNode(null)
        return
      case 'ont':
        setOntActionMode('idle')
        setOntTempPosition(null)
        setSelectedOntNode(null)
        return
      case 'pole':
        setPoleActionMode('idle')
        setPoleTempPosition(null)
        setSelectedPoleNode(null)
        return
      case 'joinbox':
        setJoinboxActionMode('idle')
        setJoinboxTempPosition(null)
        setSelectedJoinboxNode(null)
        return
    }
  }, [])

  const resetNodePlacementState = useCallback(() => {
    cancelNodeTool('server')
    cancelNodeTool('odc')
    cancelNodeTool('odp')
    cancelNodeTool('ont')
    cancelNodeTool('pole')
    cancelNodeTool('joinbox')
  }, [cancelNodeTool])

  const cancelActiveMode = useCallback(() => {
    resetNodePlacementState()
    handleFiberLineCancel()
    setIsManualAdd(false)
  }, [handleFiberLineCancel, resetNodePlacementState])

  const handleMapClick = useCallback((e: LeafletMouseEvent) => {
    const latlng: Position = [e.latlng.lat, e.latlng.lng]

    if (serverActionMode === 'adding') {
      setServerTempPosition(latlng)
      return
    }

    if (odcActionMode === 'adding') {
      setOdcTempPosition(latlng)
      return
    }

    if (odpActionMode === 'adding') {
      setOdpTempPosition(latlng)
      return
    }

    if (ontActionMode === 'adding') {
      setOntTempPosition(latlng)
      return
    }

    if (poleActionMode === 'adding') {
      setPoleTempPosition(latlng)
      return
    }

    if (joinboxActionMode === 'adding') {
      setJoinboxTempPosition(latlng)
      return
    }

    if (fiberLineMode === 'drawing' && fiberSourceNode) {
      setFiberWaypoints((prev) => [...prev, latlng])
    }
  }, [fiberLineMode, fiberSourceNode, joinboxActionMode, odcActionMode, odpActionMode, ontActionMode, poleActionMode, serverActionMode])

  const handleNodeClick = useCallback((node: MappingNode, markerRef: Marker | null) => {
    if (fiberLineMode !== 'drawing') {
      return
    }

    if (markerRef) {
      markerRef.closePopup()
    }

    if (!fiberSourceNode) {
      setFiberSourceNode(node)
      showToast('info', `Source: ${node.name}. Click on map to add waypoints, then click target node.`)
      return
    }

    if (fiberSourceNode.nodeId === node.nodeId) {
      return
    }

    setFiberFormData({
      source: fiberSourceNode.nodeId,
      target: node.nodeId,
      fiberType: determineFiberType(fiberSourceNode.type, node.type),
      waypoints: fiberWaypoints,
    })
    setShowFiberForm(true)
  }, [fiberLineMode, fiberSourceNode, fiberWaypoints, showToast])

  const saveNodeToolPosition = useCallback(async (tool: NodeTool) => {
    const actionMode =
      tool === 'server' ? serverActionMode :
      tool === 'odc' ? odcActionMode :
      tool === 'odp' ? odpActionMode :
      tool === 'ont' ? ontActionMode :
      tool === 'pole' ? poleActionMode :
      joinboxActionMode

    const tempPosition =
      tool === 'server' ? serverTempPosition :
      tool === 'odc' ? odcTempPosition :
      tool === 'odp' ? odpTempPosition :
      tool === 'ont' ? ontTempPosition :
      tool === 'pole' ? poleTempPosition :
      joinboxTempPosition

    const selectedNode =
      tool === 'server' ? selectedServerNode :
      tool === 'odc' ? selectedOdcNode :
      tool === 'odp' ? selectedOdpNode :
      tool === 'ont' ? selectedOntNode :
      tool === 'pole' ? selectedPoleNode :
      selectedJoinboxNode

    if (!tempPosition) {
      return
    }

    if (actionMode === 'adding') {
      const config = NODE_TOOL_CONFIG[tool]
      setNodeFormType(config.formType)
      setNodeFormData({
        type: config.formType,
        latitude: tempPosition[0],
        longitude: tempPosition[1],
        capacity: config.capacity,
      })
      setShowNodeForm(true)
    } else if (actionMode === 'editing' && selectedNode) {
      await updateNodePosition(selectedNode.nodeId, tempPosition)
    }

    cancelNodeTool(tool)
  }, [cancelNodeTool, joinboxActionMode, joinboxTempPosition, odcActionMode, odcTempPosition, odpActionMode, odpTempPosition, ontActionMode, ontTempPosition, poleActionMode, poleTempPosition, selectedJoinboxNode, selectedOdcNode, selectedOdpNode, selectedOntNode, selectedPoleNode, selectedServerNode, serverActionMode, serverTempPosition, updateNodePosition])

  const saveActiveTempPosition = useCallback(async () => {
    if (serverActionMode !== 'idle') {
      await saveNodeToolPosition('server')
      return
    }

    if (odcActionMode !== 'idle') {
      await saveNodeToolPosition('odc')
      return
    }

    if (odpActionMode !== 'idle') {
      await saveNodeToolPosition('odp')
      return
    }

    if (ontActionMode !== 'idle') {
      await saveNodeToolPosition('ont')
      return
    }

    if (poleActionMode !== 'idle') {
      await saveNodeToolPosition('pole')
      return
    }

    if (joinboxActionMode !== 'idle') {
      await saveNodeToolPosition('joinbox')
    }
  }, [joinboxActionMode, odcActionMode, odpActionMode, ontActionMode, poleActionMode, saveNodeToolPosition, serverActionMode])

  const closeNodeForm = useCallback(() => {
    setShowNodeForm(false)
    setNodeFormData({})
    setEditingNode(null)
    setIsManualAdd(false)
    resetNodePlacementState()
  }, [resetNodePlacementState])

  const resetNodeFormAfterSave = useCallback(() => {
    setShowNodeForm(false)
    setNodeFormData({})
    setEditingNode(null)
    resetNodePlacementState()
  }, [resetNodePlacementState])

  const closeFiberForm = useCallback(() => {
    setShowFiberForm(false)
    setFiberFormData(null)
    handleFiberLineCancel()
  }, [handleFiberLineCancel])

  const deleteNode = useCallback((nodeId: string) => {
    setDeleteConfirmation({ type: 'node', id: nodeId })
  }, [])

  const deleteEdge = useCallback((edgeId: string) => {
    setDeleteConfirmation({ type: 'edge', id: edgeId })
  }, [])

  const onEditNodeLocation = useCallback((node: MappingNode) => {
    const position: Position = [node.latitude!, node.longitude!]

    switch (node.type) {
      case 'server':
      case 'olt':
        setSelectedServerNode(node)
        setServerTempPosition(position)
        setServerActionMode('editing')
        return
      case 'odc':
        setSelectedOdcNode(node)
        setOdcTempPosition(position)
        setOdcActionMode('editing')
        return
      case 'odp':
        setSelectedOdpNode(node)
        setOdpTempPosition(position)
        setOdpActionMode('editing')
        return
      case 'ont':
        setSelectedOntNode(node)
        setOntTempPosition(position)
        setOntActionMode('editing')
        return
      case 'pole':
        setSelectedPoleNode(node)
        setPoleTempPosition(position)
        setPoleActionMode('editing')
        return
      case 'joinbox':
        setSelectedJoinboxNode(node)
        setJoinboxTempPosition(position)
        setJoinboxActionMode('editing')
        return
    }
  }, [])

  const onEditNode = useCallback((node: MappingNode) => {
    setEditingNode(node)
    setNodeFormType(node.type)
    setNodeFormData({
      type: node.type,
      name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      capacity: node.capacity,
      splitter: node.splitter,
      pppoe: node.pppoe,
      serialNumber: node.serialNumber,
      notes: node.notes,
      attenuationIn: node.attenuationIn,
      attenuationOut: node.attenuationOut,
      inputCoreColor: node.inputCoreColor,
      photo: node.photo,
      metadata: node.metadata,
    })
    setShowNodeForm(true)
  }, [])

  const handleToolbarClick = useCallback((tool: NodeTool | 'fiber') => {
    cancelActiveMode()

    if (tool === 'fiber') {
      setFiberLineMode('drawing')
      showToast('info', 'Click on source node to start drawing fiber line')
      return
    }

    switch (tool) {
      case 'server':
        setServerActionMode('adding')
        break
      case 'odc':
        setOdcActionMode('adding')
        break
      case 'odp':
        setOdpActionMode('adding')
        break
      case 'ont':
        setOntActionMode('adding')
        break
      case 'pole':
        setPoleActionMode('adding')
        break
      case 'joinbox':
        setJoinboxActionMode('adding')
        break
    }

    showToast('info', NODE_TOOL_CONFIG[tool].addMessage)
  }, [cancelActiveMode, showToast])

  const handleManualAdd = useCallback((type: string) => {
    setNodeFormType(type)
    setNodeFormData({
      type,
      latitude: 0,
      longitude: 0,
      capacity: type === 'ont' ? 1 : type === 'olt' ? 16 : 8,
    })
    setIsManualAdd(true)
    setShowNodeForm(true)
  }, [])

  const isAnyModeActive =
    serverActionMode !== 'idle' ||
    odcActionMode !== 'idle' ||
    odpActionMode !== 'idle' ||
    ontActionMode !== 'idle' ||
    poleActionMode !== 'idle' ||
    joinboxActionMode !== 'idle' ||
    fiberLineMode !== 'idle'

  const activeModeMessage = useMemo(() => {
    if (serverActionMode === 'adding') return 'Click on map to place Server/OLT, then click Save'
    if (serverActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (odcActionMode === 'adding') return 'Click on map to place ODC, then click Save'
    if (odcActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (odpActionMode === 'adding') return 'Click on map to place ODP, then click Save'
    if (odpActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (ontActionMode === 'adding') return 'Click on map to place ONT, then click Save'
    if (ontActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (poleActionMode === 'adding') return 'Click on map to place Pole, then click Save'
    if (poleActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (joinboxActionMode === 'adding') return 'Click on map to place Joinbox, then click Save'
    if (joinboxActionMode === 'editing') return 'Drag marker to new position, then click Save'
    if (fiberLineMode === 'drawing' && !fiberSourceNode) return 'Click on source node to start'
    if (fiberLineMode === 'drawing' && fiberSourceNode) {
      return `From: ${fiberSourceNode.name}. Click map for waypoints, click target node to finish. (${fiberWaypoints.length} waypoints)`
    }
    return ''
  }, [fiberLineMode, fiberSourceNode, fiberWaypoints.length, joinboxActionMode, odcActionMode, odpActionMode, ontActionMode, poleActionMode, serverActionMode])

  const hasPendingTempPosition = !!(
    serverTempPosition ||
    odcTempPosition ||
    odpTempPosition ||
    ontTempPosition ||
    poleTempPosition ||
    joinboxTempPosition
  )

  const isNodeBeingEdited = useCallback((nodeId: string) => {
    return (
      (serverActionMode === 'editing' && selectedServerNode?.nodeId === nodeId) ||
      (odcActionMode === 'editing' && selectedOdcNode?.nodeId === nodeId) ||
      (odpActionMode === 'editing' && selectedOdpNode?.nodeId === nodeId) ||
      (ontActionMode === 'editing' && selectedOntNode?.nodeId === nodeId) ||
      (poleActionMode === 'editing' && selectedPoleNode?.nodeId === nodeId) ||
      (joinboxActionMode === 'editing' && selectedJoinboxNode?.nodeId === nodeId)
    )
  }, [joinboxActionMode, odcActionMode, odpActionMode, ontActionMode, poleActionMode, selectedJoinboxNode, selectedOdcNode, selectedOdpNode, selectedOntNode, selectedPoleNode, selectedServerNode, serverActionMode])

  return {
    serverActionMode,
    odcActionMode,
    odpActionMode,
    ontActionMode,
    poleActionMode,
    joinboxActionMode,
    serverTempPosition,
    odcTempPosition,
    odpTempPosition,
    ontTempPosition,
    poleTempPosition,
    joinboxTempPosition,
    selectedServerNode,
    selectedOdcNode,
    selectedOdpNode,
    selectedOntNode,
    selectedPoleNode,
    selectedJoinboxNode,
    fiberLineMode,
    fiberSourceNode,
    fiberWaypoints,
    showNodeForm,
    nodeFormType,
    nodeFormData,
    editingNode,
    showFiberForm,
    fiberFormData,
    isManualAdd,
    deleteConfirmation,
    isAnyModeActive,
    activeModeMessage,
    hasPendingTempPosition,
    setServerTempPosition,
    setOdcTempPosition,
    setOdpTempPosition,
    setOntTempPosition,
    setPoleTempPosition,
    setJoinboxTempPosition,
    setNodeFormData,
    setFiberFormData,
    setDeleteConfirmation,
    handleMapClick,
    handleNodeClick,
    handleFiberLineCancel,
    closeNodeForm,
    closeFiberForm,
    resetNodeFormAfterSave,
    deleteNode,
    deleteEdge,
    onEditNodeLocation,
    onEditNode,
    handleToolbarClick,
    handleManualAdd,
    saveActiveTempPosition,
    cancelActiveMode,
    isNodeBeingEdited,
  }
}
