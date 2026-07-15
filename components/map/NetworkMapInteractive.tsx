"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/Button";
import { FiberFormModal } from "@/components/map/FiberFormModal";
import { NodeFormModal } from "@/components/map/NodeFormModal";
import { MapStatisticsBar } from "@/components/map/MapStatisticsBar";
import { MapToolbar } from "@/components/map/MapToolbar";
import { NodeListTab } from "@/components/map/NodeListTab";
import { NodePopupContent } from "@/components/map/NodePopupContent";
import { MapDrawingOverlay } from "@/components/map/MapDrawingOverlay";
import { MapFiberDrawingInfoPanel } from "@/components/map/MapFiberDrawingInfoPanel";
import { MapFiberLinesLayer } from "@/components/map/MapFiberLinesLayer";
import { MapTempMarkers } from "@/components/map/MapTempMarkers";
import { SettingsTab } from "@/components/map/SettingsTab";
import type { MappingNode } from "@/components/map/map-types";
import { useMapData } from "@/components/map/useMapData";
import { useMapEditorState } from "@/components/map/useMapEditorState";
import {
  createNodeIcon,
  createTempMarkerIcon,
  getNodeColor,
} from "@/components/map/map-icon-factory";
import L from "leaflet";
import { useToast } from "@/components/ui/Toast";
import {
  getConnectedDevices,
  type ConnectedDevices,
} from "@/components/map/map-utils";
import { HiMap, HiExclamationTriangle } from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false },
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const ZoomControl = dynamic(
  () => import("react-leaflet").then((mod) => mod.ZoomControl),
  { ssr: false },
);

// Fix Leaflet icon issue
if (typeof window !== "undefined") {
  // @ts-expect-error: Fix Leaflet icon issue
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/marker-icon-2x.png",
    iconUrl: "/images/marker-icon.png",
    shadowUrl: "/images/marker-shadow.png",
  });
}

// ============================================
// TYPES - MATCHING GENIEACS
// ============================================

// ============================================
// TYPES - MATCHING GENIEACS
// ============================================

type ActiveTab = "map" | "list" | "settings";

// ============================================
// MAIN COMPONENT
// ============================================

export default function NetworkMapInteractive() {
  const { showToast } = useToast();

  const {
    nodes,
    edges,
    settings,
    loading,
    statistics,
    updateNodePosition,
    saveNode: persistNode,
    saveFiberLine,
    confirmDelete,
    saveSettings,
    exportMap,
    resetMap,
    importCsv,
  } = useMapData({ showToast });

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("map");
  const [mapStyle, setMapStyle] = useState<"satellite" | "plain">("satellite");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const {
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
  } = useMapEditorState({ showToast, updateNodePosition });

  // Add CSS for animations
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      !document.getElementById("map-animation-styles")
    ) {
      const style = document.createElement("style");
      style.id = "map-animation-styles";
      style.innerHTML = `
        .animated-polyline {
          stroke-dashoffset: 1000;
          animation: dash 30s linear infinite;
        }
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ============================================
  // GET CONNECTED DEVICES - EXACT FROM GENIEACS
  // ============================================

  const getNodeConnectedDevices = useCallback(
    (nodeId: string): ConnectedDevices => {
      return getConnectedDevices(nodeId, edges);
    },
    [edges],
  );

  const handleFiberLineComplete = async (formData: {
    name: string;
    fiberType: string;
    notes: string;
  }) => {
    const saved = await saveFiberLine(fiberFormData, formData);

    if (saved) {
      closeFiberForm();
    }
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const saveNode = async () => {
    const saved = await persistNode(nodeFormData, editingNode?.nodeId);

    if (saved) {
      resetNodeFormAfterSave();
    }
  };

  const handleConfirmDelete = async () => {
    const deleted = await confirmDelete(deleteConfirmation);

    if (deleted) {
      setDeleteConfirmation(null);
    }
  };

  // ============================================
  // MAP CONFIG
  // ============================================

  const centerPosition: [number, number] =
    settings?.centerLat && settings?.centerLng
      ? [parseFloat(settings.centerLat), parseFloat(settings.centerLng)]
      : [-6.2088, 106.8456];

  const zoomLevel = settings?.defaultZoom ? parseInt(settings.defaultZoom) : 13;
  const maxZoomIn = settings?.maxZoomIn ? parseInt(settings.maxZoomIn) : 22;
  const minZoomOut = settings?.maxZoomOut ? parseInt(settings.maxZoomOut) : 5;

  const tileUrl =
    mapStyle === "satellite"
      ? "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
      : "https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}";

  const filteredNodes = searchQuery
    ? nodes.filter(
        (n) =>
          n.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : nodes;

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] bg-gray-100 dark:bg-gray-900">
      <MapToolbar
        activeTab={activeTab}
        showSearchDropdown={showSearchDropdown}
        searchQuery={searchQuery}
        filteredNodes={filteredNodes}
        serverActionMode={serverActionMode}
        odcActionMode={odcActionMode}
        odpActionMode={odpActionMode}
        ontActionMode={ontActionMode}
        poleActionMode={poleActionMode}
        joinboxActionMode={joinboxActionMode}
        fiberLineMode={fiberLineMode}
        isAnyModeActive={isAnyModeActive}
        activeModeMessage={activeModeMessage}
        hasPendingTempPosition={hasPendingTempPosition}
        onTabChange={setActiveTab}
        onToggleSearchDropdown={() =>
          setShowSearchDropdown(!showSearchDropdown)
        }
        onSearchQueryChange={setSearchQuery}
        onSelectSearchResult={(node) => {
          if (mapRef.current && node.latitude && node.longitude) {
            mapRef.current.setView([node.latitude, node.longitude], 18);
          }
          setShowSearchDropdown(false);
          setSearchQuery("");
        }}
        onToolbarClick={handleToolbarClick}
        onSaveActiveTempPosition={saveActiveTempPosition}
        onCancelActiveMode={cancelActiveMode}
        getNodeColor={getNodeColor}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeTab === "map" && (
          <>
            <div className="flex-1 relative z-[0]">
              <MapContainer
                key={`map-${activeTab}-${mapStyle}`} // Add unique key to force remount on tab/style change
                center={centerPosition}
                zoom={zoomLevel}
                minZoom={minZoomOut}
                maxZoom={maxZoomIn}
                zoomControl={false}
                className="w-full h-full"
                style={{ height: "100%", width: "100%" }}
                ref={(map) => {
                  if (map) {
                    mapRef.current = map;
                    // Use a timeout to ensure map is fully initialized before attaching events
                    // This helps prevent "Map container is being reused" issues in some cases
                    setTimeout(() => {
                      map.off("click");
                      map.on("click", handleMapClick);
                    }, 0);
                  }
                }}
              >
                <TileLayer
                  url={tileUrl}
                  attribution="© Google Maps"
                  maxZoom={maxZoomIn}
                  minZoom={minZoomOut}
                />
                <ZoomControl position="topleft" />

                <MapFiberLinesLayer
                  edges={edges}
                  nodes={nodes}
                  onDeleteEdge={deleteEdge}
                />

                <MapDrawingOverlay
                  fiberLineMode={fiberLineMode}
                  fiberSourceNode={
                    fiberSourceNode
                      ? {
                          latitude: fiberSourceNode.latitude!,
                          longitude: fiberSourceNode.longitude!,
                        }
                      : null
                  }
                  fiberWaypoints={fiberWaypoints}
                />

                <MapTempMarkers
                  serverActionMode={serverActionMode}
                  odcActionMode={odcActionMode}
                  odpActionMode={odpActionMode}
                  ontActionMode={ontActionMode}
                  poleActionMode={poleActionMode}
                  joinboxActionMode={joinboxActionMode}
                  serverTempPosition={serverTempPosition}
                  odcTempPosition={odcTempPosition}
                  odpTempPosition={odpTempPosition}
                  ontTempPosition={ontTempPosition}
                  poleTempPosition={poleTempPosition}
                  joinboxTempPosition={joinboxTempPosition}
                  setServerTempPosition={setServerTempPosition}
                  setOdcTempPosition={setOdcTempPosition}
                  setOdpTempPosition={setOdpTempPosition}
                  setOntTempPosition={setOntTempPosition}
                  setPoleTempPosition={setPoleTempPosition}
                  setJoinboxTempPosition={setJoinboxTempPosition}
                  createTempMarkerIcon={createTempMarkerIcon}
                />

                {/* Existing Nodes */}
                {nodes.map((node) => {
                  if (!node.latitude || !node.longitude) return null;

                  // Don't show if we're editing this node
                  if (isNodeBeingEdited(node.nodeId)) return null;

                  const isSelected = node.nodeId === fiberSourceNode?.nodeId;
                  const connected = getNodeConnectedDevices(node.nodeId);

                  // Get connected node names
                  const isMappingNode = (
                    node: MappingNode | undefined,
                  ): node is MappingNode => node !== undefined;
                  const connectedFromNodes = Array.from(
                    new Set(connected.connectedFrom),
                  )
                    .map((id) => nodes.find((n) => n.nodeId === id))
                    .filter(isMappingNode);
                  const connectedToNodes = Array.from(
                    new Set(connected.connectedTo),
                  )
                    .map((id) => nodes.find((n) => n.nodeId === id))
                    .filter(isMappingNode);

                  const getSplitterCapacity = (splitter: string | null) => {
                    if (!splitter) return 8;
                    const match = splitter.match(/1:(\d+)/);
                    return match ? parseInt(match[1]) : 8;
                  };

                  const capacity = node.splitter
                    ? getSplitterCapacity(node.splitter)
                    : node.capacity || 8;
                  const usedSlots = connected.usedSlots;

                  const copyInfo = () => {
                    const info = `${node.name}\n${node.latitude?.toFixed(6)}, ${node.longitude?.toFixed(6)}`;
                    navigator.clipboard.writeText(info);
                    showToast("success", "Info copied to clipboard");
                  };

                  return (
                    <Marker
                      key={node.nodeId}
                      position={[node.latitude, node.longitude]}
                      icon={createNodeIcon(node.type, isSelected)}
                      eventHandlers={{
                        click: (e) => handleNodeClick(node, e.target),
                      }}
                    >
                      {fiberLineMode !== "drawing" && (
                        <Popup>
                          <NodePopupContent
                            node={node}
                            connectedFromNodes={
                              connectedFromNodes as typeof nodes
                            }
                            connectedToNodes={connectedToNodes as typeof nodes}
                            usedSlots={usedSlots}
                            capacity={capacity}
                            onCopyInfo={copyInfo}
                            onEditNode={onEditNode}
                            onEditNodeLocation={onEditNodeLocation}
                            onDeleteNode={deleteNode}
                          />
                        </Popup>
                      )}
                    </Marker>
                  );
                })}
              </MapContainer>

              <MapFiberDrawingInfoPanel
                fiberLineMode={fiberLineMode}
                fiberSourceNode={
                  fiberSourceNode
                    ? {
                        name: fiberSourceNode.name,
                        latitude: fiberSourceNode.latitude!,
                        longitude: fiberSourceNode.longitude!,
                      }
                    : null
                }
                fiberWaypoints={fiberWaypoints}
              />

              {/* Map Style Toggle */}
              <Button
                onClick={() =>
                  setMapStyle(mapStyle === "satellite" ? "plain" : "satellite")
                }
                className="absolute bottom-4 right-4 z-1000 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <HiMap className="w-4 h-4" />
                {mapStyle === "satellite" ? "Sat Plain" : "Plain Sat"}
              </Button>
            </div>

            <MapStatisticsBar statistics={statistics} />
          </>
        )}

        {activeTab === "list" && (
          <NodeListTab
            searchQuery={searchQuery}
            filteredNodes={filteredNodes}
            onSearchQueryChange={setSearchQuery}
            onManualAdd={handleManualAdd}
            onEditNode={onEditNode}
            onDeleteNode={deleteNode}
            getNodeColor={getNodeColor}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings}
            nodes={nodes}
            edges={edges}
            onSave={saveSettings}
            onExport={exportMap}
            onReset={resetMap}
            onImportCsv={importCsv}
          />
        )}
      </div>

      {/* Node Form Modal */}
      <NodeFormModal
        isOpen={showNodeForm}
        nodeType={nodeFormType}
        data={nodeFormData}
        isEditing={!!editingNode}
        allowManualCoordinates={isManualAdd}
        onClose={closeNodeForm}
        onChange={setNodeFormData}
        onSave={saveNode}
      />

      {/* Fiber Form Modal */}
      <FiberFormModal
        isOpen={showFiberForm}
        data={fiberFormData}
        nodes={nodes}
        onClose={closeFiberForm}
        onSave={handleFiberLineComplete}
        onFiberTypeChange={(type) => {
          if (fiberFormData) {
            setFiberFormData({ ...fiberFormData, fiberType: type });
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmation}
        onClose={() => setDeleteConfirmation(null)}
        title="Confirm Deletion"
        size="md"
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <HiExclamationTriangle className="w-8 h-8" />
            <p className="font-medium text-gray-900 dark:text-white">
              Are you sure you want to delete this{" "}
              {deleteConfirmation?.type === "node" ? "Node" : "Fiber Line"}?
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            This action cannot be undone.
            {deleteConfirmation?.type === "node" &&
              " All connected fiber lines will also be deleted."}
          </p>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
