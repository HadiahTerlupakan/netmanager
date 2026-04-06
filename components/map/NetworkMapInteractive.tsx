"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { Button } from '@/components/ui/Button'
import { FiberFormModal } from '@/components/map/FiberFormModal'
import { NodeFormModal } from '@/components/map/NodeFormModal'
import { MapStatisticsBar } from '@/components/map/MapStatisticsBar'
import { MapToolbar } from '@/components/map/MapToolbar'
import { NodeListTab } from '@/components/map/NodeListTab'
import { NodePopupContent } from '@/components/map/NodePopupContent'
import { MapDrawingOverlay } from '@/components/map/MapDrawingOverlay'
import { MapFiberDrawingInfoPanel } from '@/components/map/MapFiberDrawingInfoPanel'
import { MapFiberLinesLayer } from '@/components/map/MapFiberLinesLayer'
import { MapTempMarkers } from '@/components/map/MapTempMarkers'
import { SettingsTab } from '@/components/map/SettingsTab'
import type { MappingNode } from '@/components/map/map-types'
import { useMapData } from '@/components/map/useMapData'
import { useMapEditorState } from '@/components/map/useMapEditorState'
import L from "leaflet";
import { useToast } from "@/components/ui/Toast";
import {
  getConnectedDevices,
  type ConnectedDevices,
} from "@/components/map/map-utils";
import {
  HiMap,
  HiExclamationTriangle,
} from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";

// Dynamically import Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);
const ZoomControl = dynamic(
  () => import("react-leaflet").then((mod) => mod.ZoomControl),
  { ssr: false }
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
// NODE ICONS - EXACT FROM GENIEACS (sk object)
// ============================================

const nodeIcons = {
  server: {
    color: "#9333ea",
    svg: '<path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  olt: {
    color: "#9333ea",
    svg: '<path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  odc: {
    color: "#2563eb",
    svg: '<path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  odp: {
    color: "#06b6d4",
    svg: '<path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  ont: {
    color: "#ea580c",
    svg: '<path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  pole: {
    color: "#6b7280", // Gray
    svg: '<path d="M12 3v18M8 6h8M8 10h8M8 14h8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  joinbox: {
    color: "#d97706", // Amber-600
    svg: '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  }
};

const createNodeIcon = (type: string, isSelected = false) => {
  const config = nodeIcons[type as keyof typeof nodeIcons] || nodeIcons.odp;
  const size = isSelected ? 36 : 30;
  const border = isSelected ? "3px solid #facc15" : "2px solid white";

  return L.divIcon({
    className: "custom-node-icon",
    html: `
      <div style="
        background-color: ${config.color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${border};
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          ${config.svg}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -15],
  });
};

// Temporary marker icon (for adding new node)
const createTempMarkerIcon = (type: string) => {
  const config = nodeIcons[type as keyof typeof nodeIcons] || nodeIcons.odp;
  return L.divIcon({
    className: "temp-node-icon",
    html: `
      <div style="
        background-color: ${config.color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px dashed white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: move;
        animation: pulse 1.5s ease-in-out infinite;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          ${config.svg}
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

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
    if (typeof document !== "undefined" && !document.getElementById("map-animation-styles")) {
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

  const getNodeConnectedDevices = useCallback((nodeId: string): ConnectedDevices => {
    return getConnectedDevices(nodeId, edges);
  }, [edges]);

  const handleFiberLineComplete = async (formData: { name: string; fiberType: string; notes: string }) => {
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

  const centerPosition: [number, number] = settings?.centerLat && settings?.centerLng
    ? [parseFloat(settings.centerLat), parseFloat(settings.centerLng)]
    : [-6.2088, 106.8456];

  const zoomLevel = settings?.defaultZoom ? parseInt(settings.defaultZoom) : 13;
  const maxZoomIn = settings?.maxZoomIn ? parseInt(settings.maxZoomIn) : 22;
  const minZoomOut = settings?.maxZoomOut ? parseInt(settings.maxZoomOut) : 5;

  const tileUrl = mapStyle === "satellite"
    ? "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
    : "https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}";

  const filteredNodes = searchQuery
    ? nodes.filter(n =>
      n.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
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
        onToggleSearchDropdown={() => setShowSearchDropdown(!showSearchDropdown)}
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
        getNodeColor={(type) => nodeIcons[type as keyof typeof nodeIcons]?.color || "#6b7280"}
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
                <TileLayer url={tileUrl} attribution="© Google Maps" maxZoom={maxZoomIn} minZoom={minZoomOut} />
                <ZoomControl position="topleft" />

                <MapFiberLinesLayer edges={edges} nodes={nodes} onDeleteEdge={deleteEdge} />

                <MapDrawingOverlay
                  fiberLineMode={fiberLineMode}
                  fiberSourceNode={fiberSourceNode ? { latitude: fiberSourceNode.latitude!, longitude: fiberSourceNode.longitude! } : null}
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
                  const isMappingNode = (node: MappingNode | undefined): node is MappingNode => node !== undefined;
                  const connectedFromNodes = Array.from(new Set(connected.connectedFrom)).map(id => nodes.find(n => n.nodeId === id)).filter(isMappingNode);
                  const connectedToNodes = Array.from(new Set(connected.connectedTo)).map(id => nodes.find(n => n.nodeId === id)).filter(isMappingNode);

                  const getSplitterCapacity = (splitter: string | null) => {
                    if (!splitter) return 8;
                    const match = splitter.match(/1:(\d+)/);
                    return match ? parseInt(match[1]) : 8;
                  };

                  const capacity = node.splitter ? getSplitterCapacity(node.splitter) : (node.capacity || 8);
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
                            connectedFromNodes={connectedFromNodes as typeof nodes}
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
                fiberSourceNode={fiberSourceNode ? {
                  name: fiberSourceNode.name,
                  latitude: fiberSourceNode.latitude!,
                  longitude: fiberSourceNode.longitude!,
                } : null}
                fiberWaypoints={fiberWaypoints}
              />

              {/* Map Style Toggle */}
              <Button onClick={() => setMapStyle(mapStyle === "satellite" ? "plain" : "satellite")}
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
            getNodeColor={(type) => nodeIcons[type as keyof typeof nodeIcons]?.color || "#6b7280"}
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
        onFiberTypeChange={(type) => setFiberFormData(prev => prev ? { ...prev, fiberType: type } : null)}
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
              Are you sure you want to delete this {deleteConfirmation?.type === 'node' ? 'Node' : 'Fiber Line'}?
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            This action cannot be undone.
            {deleteConfirmation?.type === 'node' && " All connected fiber lines will also be deleted."}
          </p>
          <ModalFooter>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button variant="destructive"
                onClick={handleConfirmDelete}

              >
                Delete
              </Button>
            </div>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}

