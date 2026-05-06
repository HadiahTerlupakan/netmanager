"use client";

import { useCallback, useMemo, useState } from "react";
import type { LeafletMouseEvent, Marker } from "leaflet";

import { determineFiberType } from "./map-utils";
import { NODE_TOOL_CONFIG, FIBER_MODE_MESSAGES } from "./map-constants";
import type { FiberFormData, MappingNode } from "./map-types";

type ToastType = "success" | "error" | "info" | "warning";
type NodeActionMode = "idle" | "adding" | "editing";
type FiberLineMode = "idle" | "drawing";
type NodeTool = "server" | "odc" | "odp" | "ont" | "pole" | "joinbox";
type Position = [number, number];
type DeleteConfirmation = { type: "node" | "edge"; id: string } | null;

interface NodeToolState {
  actionMode: NodeActionMode;
  tempPosition: Position | null;
  selectedNode: MappingNode | null;
}

interface NodeFormState {
  show: boolean;
  type: string;
  data: Partial<MappingNode>;
  editingNode: MappingNode | null;
  isManualAdd: boolean;
}

interface FiberState {
  mode: FiberLineMode;
  sourceNode: MappingNode | null;
  waypoints: Position[];
  showForm: boolean;
  formData: FiberFormData | null;
}

interface UseMapEditorStateParams {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  updateNodePosition: (nodeId: string, position: Position) => Promise<void>;
}

const INITIAL_NODE_TOOL_STATE: NodeToolState = {
  actionMode: "idle",
  tempPosition: null,
  selectedNode: null,
};

const INITIAL_NODE_FORM_STATE: NodeFormState = {
  show: false,
  type: "odp",
  data: {},
  editingNode: null,
  isManualAdd: false,
};

const INITIAL_FIBER_STATE: FiberState = {
  mode: "idle",
  sourceNode: null,
  waypoints: [],
  showForm: false,
  formData: null,
};

/**
 * Unified map editor state management
 * Menggabungkan 24 state variables menjadi 3 unified states
 */
export function useMapEditorState({
  showToast,
  updateNodePosition,
}: UseMapEditorStateParams) {
  const [nodeToolStates, setNodeToolStates] = useState<
    Record<NodeTool, NodeToolState>
  >({
    server: { ...INITIAL_NODE_TOOL_STATE },
    odc: { ...INITIAL_NODE_TOOL_STATE },
    odp: { ...INITIAL_NODE_TOOL_STATE },
    ont: { ...INITIAL_NODE_TOOL_STATE },
    pole: { ...INITIAL_NODE_TOOL_STATE },
    joinbox: { ...INITIAL_NODE_TOOL_STATE },
  });

  const [nodeFormState, setNodeFormState] = useState<NodeFormState>(
    INITIAL_NODE_FORM_STATE,
  );
  const [fiberState, setFiberState] = useState<FiberState>(INITIAL_FIBER_STATE);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation>(null);

  const updateNodeToolState = useCallback(
    (tool: NodeTool, updates: Partial<NodeToolState>) => {
      setNodeToolStates((prev) => ({
        ...prev,
        [tool]: { ...prev[tool], ...updates },
      }));
    },
    [],
  );

  const resetNodeToolState = useCallback((tool: NodeTool) => {
    setNodeToolStates((prev) => ({
      ...prev,
      [tool]: { ...INITIAL_NODE_TOOL_STATE },
    }));
  }, []);

  const resetAllNodeToolStates = useCallback(() => {
    setNodeToolStates({
      server: { ...INITIAL_NODE_TOOL_STATE },
      odc: { ...INITIAL_NODE_TOOL_STATE },
      odp: { ...INITIAL_NODE_TOOL_STATE },
      ont: { ...INITIAL_NODE_TOOL_STATE },
      pole: { ...INITIAL_NODE_TOOL_STATE },
      joinbox: { ...INITIAL_NODE_TOOL_STATE },
    });
  }, []);

  const handleFiberLineCancel = useCallback(() => {
    setFiberState(INITIAL_FIBER_STATE);
  }, []);

  const cancelActiveMode = useCallback(() => {
    resetAllNodeToolStates();
    handleFiberLineCancel();
    setNodeFormState((prev) => ({ ...prev, isManualAdd: false }));
  }, [handleFiberLineCancel, resetAllNodeToolStates]);

  const handleMapClick = useCallback(
    (e: LeafletMouseEvent) => {
      const latlng: Position = [e.latlng.lat, e.latlng.lng];

      const activeTool = (Object.keys(nodeToolStates) as NodeTool[]).find(
        (tool) => nodeToolStates[tool].actionMode === "adding",
      );

      if (activeTool) {
        updateNodeToolState(activeTool, { tempPosition: latlng });
        return;
      }

      if (fiberState.mode === "drawing" && fiberState.sourceNode) {
        setFiberState((prev) => ({
          ...prev,
          waypoints: [...prev.waypoints, latlng],
        }));
      }
    },
    [
      fiberState.mode,
      fiberState.sourceNode,
      nodeToolStates,
      updateNodeToolState,
    ],
  );

  const handleNodeClick = useCallback(
    (node: MappingNode, markerRef: Marker | null) => {
      if (fiberState.mode !== "drawing") {
        return;
      }

      if (markerRef) {
        markerRef.closePopup();
      }

      if (!fiberState.sourceNode) {
        setFiberState((prev) => ({ ...prev, sourceNode: node }));
        showToast("info", FIBER_MODE_MESSAGES.SOURCE_SELECTED(node.name));
        return;
      }

      if (fiberState.sourceNode.nodeId === node.nodeId) {
        return;
      }

      setFiberState((prev) => ({
        ...prev,
        showForm: true,
        formData: {
          source: prev.sourceNode!.nodeId,
          target: node.nodeId,
          fiberType: determineFiberType(prev.sourceNode!.type, node.type),
          waypoints: prev.waypoints,
        },
      }));
    },
    [fiberState.mode, fiberState.sourceNode, showToast],
  );

  const saveNodeToolPosition = useCallback(
    async (tool: NodeTool) => {
      const state = nodeToolStates[tool];

      if (!state.tempPosition) {
        return;
      }

      if (state.actionMode === "adding") {
        const config = NODE_TOOL_CONFIG[tool];
        setNodeFormState({
          show: true,
          type: config.formType,
          data: {
            type: config.formType,
            latitude: state.tempPosition[0],
            longitude: state.tempPosition[1],
            capacity: config.capacity,
          },
          editingNode: null,
          isManualAdd: false,
        });
      } else if (state.actionMode === "editing" && state.selectedNode) {
        await updateNodePosition(state.selectedNode.nodeId, state.tempPosition);
      }

      resetNodeToolState(tool);
    },
    [nodeToolStates, resetNodeToolState, updateNodePosition],
  );

  const saveActiveTempPosition = useCallback(async () => {
    const activeTool = (Object.keys(nodeToolStates) as NodeTool[]).find(
      (tool) => nodeToolStates[tool].actionMode !== "idle",
    );

    if (activeTool) {
      await saveNodeToolPosition(activeTool);
    }
  }, [nodeToolStates, saveNodeToolPosition]);

  const closeNodeForm = useCallback(() => {
    setNodeFormState(INITIAL_NODE_FORM_STATE);
    resetAllNodeToolStates();
  }, [resetAllNodeToolStates]);

  const resetNodeFormAfterSave = useCallback(() => {
    setNodeFormState(INITIAL_NODE_FORM_STATE);
    resetAllNodeToolStates();
  }, [resetAllNodeToolStates]);

  const closeFiberForm = useCallback(() => {
    setFiberState(INITIAL_FIBER_STATE);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setDeleteConfirmation({ type: "node", id: nodeId });
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setDeleteConfirmation({ type: "edge", id: edgeId });
  }, []);

  const getNodeToolByType = useCallback((nodeType: string): NodeTool => {
    if (nodeType === "server" || nodeType === "olt") return "server";
    if (nodeType === "odc") return "odc";
    if (nodeType === "odp") return "odp";
    if (nodeType === "ont") return "ont";
    if (nodeType === "pole") return "pole";
    return "joinbox";
  }, []);

  const onEditNodeLocation = useCallback(
    (node: MappingNode) => {
      const position: Position = [node.latitude!, node.longitude!];
      const tool = getNodeToolByType(node.type);

      updateNodeToolState(tool, {
        actionMode: "editing",
        tempPosition: position,
        selectedNode: node,
      });
    },
    [getNodeToolByType, updateNodeToolState],
  );

  const onEditNode = useCallback((node: MappingNode) => {
    setNodeFormState({
      show: true,
      type: node.type,
      data: {
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
      },
      editingNode: node,
      isManualAdd: false,
    });
  }, []);

  const handleToolbarClick = useCallback(
    (tool: NodeTool | "fiber") => {
      cancelActiveMode();

      if (tool === "fiber") {
        setFiberState((prev) => ({ ...prev, mode: "drawing" }));
        showToast("info", FIBER_MODE_MESSAGES.START);
        return;
      }

      updateNodeToolState(tool, { actionMode: "adding" });
      showToast("info", NODE_TOOL_CONFIG[tool].addMessage);
    },
    [cancelActiveMode, showToast, updateNodeToolState],
  );

  const handleManualAdd = useCallback((type: string) => {
    const capacity = type === "ont" ? 1 : type === "olt" ? 16 : 8;
    setNodeFormState({
      show: true,
      type,
      data: {
        type,
        latitude: 0,
        longitude: 0,
        capacity,
      },
      editingNode: null,
      isManualAdd: true,
    });
  }, []);

  const isAnyModeActive = useMemo(() => {
    return (
      Object.values(nodeToolStates).some(
        (state) => state.actionMode !== "idle",
      ) || fiberState.mode !== "idle"
    );
  }, [fiberState.mode, nodeToolStates]);

  const activeModeMessage = useMemo(() => {
    const activeTool = (Object.keys(nodeToolStates) as NodeTool[]).find(
      (tool) => nodeToolStates[tool].actionMode !== "idle",
    );

    if (activeTool) {
      const state = nodeToolStates[activeTool];
      const config = NODE_TOOL_CONFIG[activeTool];

      if (state.actionMode === "adding") {
        return config.addMessage;
      }
      if (state.actionMode === "editing") {
        return config.editMessage;
      }
    }

    if (fiberState.mode === "drawing") {
      if (!fiberState.sourceNode) {
        return FIBER_MODE_MESSAGES.START;
      }
      return FIBER_MODE_MESSAGES.DRAWING(
        fiberState.sourceNode.name,
        fiberState.waypoints.length,
      );
    }

    return "";
  }, [
    fiberState.mode,
    fiberState.sourceNode,
    fiberState.waypoints.length,
    nodeToolStates,
  ]);

  const hasPendingTempPosition = useMemo(() => {
    return Object.values(nodeToolStates).some(
      (state) => state.tempPosition !== null,
    );
  }, [nodeToolStates]);

  const isNodeBeingEdited = useCallback(
    (nodeId: string) => {
      return Object.values(nodeToolStates).some(
        (state) =>
          state.actionMode === "editing" &&
          state.selectedNode?.nodeId === nodeId,
      );
    },
    [nodeToolStates],
  );

  const setTempPosition = useCallback(
    (tool: NodeTool, position: Position | null) => {
      updateNodeToolState(tool, { tempPosition: position });
    },
    [updateNodeToolState],
  );

  return {
    serverActionMode: nodeToolStates.server.actionMode,
    odcActionMode: nodeToolStates.odc.actionMode,
    odpActionMode: nodeToolStates.odp.actionMode,
    ontActionMode: nodeToolStates.ont.actionMode,
    poleActionMode: nodeToolStates.pole.actionMode,
    joinboxActionMode: nodeToolStates.joinbox.actionMode,
    serverTempPosition: nodeToolStates.server.tempPosition,
    odcTempPosition: nodeToolStates.odc.tempPosition,
    odpTempPosition: nodeToolStates.odp.tempPosition,
    ontTempPosition: nodeToolStates.ont.tempPosition,
    poleTempPosition: nodeToolStates.pole.tempPosition,
    joinboxTempPosition: nodeToolStates.joinbox.tempPosition,
    selectedServerNode: nodeToolStates.server.selectedNode,
    selectedOdcNode: nodeToolStates.odc.selectedNode,
    selectedOdpNode: nodeToolStates.odp.selectedNode,
    selectedOntNode: nodeToolStates.ont.selectedNode,
    selectedPoleNode: nodeToolStates.pole.selectedNode,
    selectedJoinboxNode: nodeToolStates.joinbox.selectedNode,
    fiberLineMode: fiberState.mode,
    fiberSourceNode: fiberState.sourceNode,
    fiberWaypoints: fiberState.waypoints,
    showNodeForm: nodeFormState.show,
    nodeFormType: nodeFormState.type,
    nodeFormData: nodeFormState.data,
    editingNode: nodeFormState.editingNode,
    showFiberForm: fiberState.showForm,
    fiberFormData: fiberState.formData,
    isManualAdd: nodeFormState.isManualAdd,
    deleteConfirmation,
    isAnyModeActive,
    activeModeMessage,
    hasPendingTempPosition,
    setServerTempPosition: (pos: Position | null) =>
      setTempPosition("server", pos),
    setOdcTempPosition: (pos: Position | null) => setTempPosition("odc", pos),
    setOdpTempPosition: (pos: Position | null) => setTempPosition("odp", pos),
    setOntTempPosition: (pos: Position | null) => setTempPosition("ont", pos),
    setPoleTempPosition: (pos: Position | null) => setTempPosition("pole", pos),
    setJoinboxTempPosition: (pos: Position | null) =>
      setTempPosition("joinbox", pos),
    setNodeFormData: (data: Partial<MappingNode>) =>
      setNodeFormState((prev) => ({ ...prev, data })),
    setFiberFormData: (data: FiberFormData | null) =>
      setFiberState((prev) => ({ ...prev, formData: data })),
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
  };
}
