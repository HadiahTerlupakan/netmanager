"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { FiberFormModal } from "@/components/map/FiberFormModal";
import { NodeFormModal } from "@/components/map/NodeFormModal";
import { MapStatisticsBar } from "@/components/map/MapStatisticsBar";
import { MapToolbar } from "@/components/map/MapToolbar";
import { NodeListTab } from "@/components/map/NodeListTab";
import { NodePopupContent } from "@/components/map/NodePopupContent";
import { JalurPratinjau } from "@/components/map/JalurPratinjau";
import { MapFiberDrawingInfoPanel } from "@/components/map/MapFiberDrawingInfoPanel";
import { MapFiberLinesLayer } from "@/components/map/MapFiberLinesLayer";
import { PenandaSementaraPeta } from "@/components/map/PenandaSementaraPeta";
import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";
import { SettingsTab } from "@/components/map/SettingsTab";
import type { MappingNode } from "@/components/map/map-types";
import { useMapData } from "@/components/map/useMapData";
import { useMapEditorState } from "@/components/map/useMapEditorState";
import { getNodeColor } from "@/components/map/map-icon-factory";
import { useToast } from "@/components/ui/Toast";
import {
  getConnectedDevices,
  type ConnectedDevices,
} from "@/components/map/map-utils";
import { HiMap, HiExclamationTriangle } from "react-icons/hi2";
import { Modal, ModalFooter } from "@/components/ui/Modal";

type ActiveTab = "map" | "list" | "settings";

/** Perbesaran saat melompat ke hasil pencarian node. */
const ZOOM_HASIL_CARI = 18;

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
    siteIdFilter,
    setSiteIdFilter,
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
  const [sites, setSites] = useState<
    Array<{ id: string; name: string; code?: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/sites?activeOnly=true");
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.sites)
            ? json.data.sites
            : Array.isArray(json)
              ? json
              : [];
        if (!cancelled) {
          setSites(
            list.map((s: { id: string; name: string; code?: string }) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            })),
          );
        }
      } catch {
        setSites([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hasil pencarian memindahkan peta lewat `titikPas`, bukan lewat pegangan
  // ke objek peta: `PetaUniversal` menyembunyikan mesinnya, dan satu-satunya
  // hal yang perlu disampaikan ke sana adalah "paskan ke titik ini".
  const [titikSorot, setTitikSorot] = useState<
    Array<{ lat: number; lng: number }> | undefined
  >(undefined);
  const [pemicuSorot, setPemicuSorot] = useState(0);

  const {
    serverActionMode,
    odcActionMode,
    odpActionMode,
    ontActionMode,
    poleActionMode,
    joinboxActionMode,
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
    titikSementara,
    isAnyModeActive,
    activeModeMessage,
    hasPendingTempPosition,
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
        sites={sites}
        siteIdFilter={siteIdFilter}
        onSiteFilterChange={setSiteIdFilter}
        onTabChange={setActiveTab}
        onToggleSearchDropdown={() =>
          setShowSearchDropdown(!showSearchDropdown)
        }
        onSearchQueryChange={setSearchQuery}
        onSelectSearchResult={(node) => {
          if (node.latitude && node.longitude) {
            setTitikSorot([{ lat: node.latitude, lng: node.longitude }]);
            setPemicuSorot((nilai) => nilai + 1);
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
              <PetaUniversal
                pusat={{ lat: centerPosition[0], lng: centerPosition[1] }}
                zoom={zoomLevel}
                gaya={mapStyle}
                minZoom={minZoomOut}
                maxZoom={maxZoomIn}
                onKlik={handleMapClick}
                titikPas={titikSorot}
                pemicuPas={pemicuSorot}
                zoomPas={ZOOM_HASIL_CARI}
              >
                <MapFiberLinesLayer
                  edges={edges}
                  nodes={nodes}
                  onDeleteEdge={deleteEdge}
                />

                <JalurPratinjau
                  aktif={fiberLineMode === "drawing"}
                  asal={
                    fiberSourceNode?.latitude && fiberSourceNode?.longitude
                      ? {
                          lat: fiberSourceNode.latitude,
                          lng: fiberSourceNode.longitude,
                        }
                      : null
                  }
                  belokan={fiberWaypoints}
                />

                <PenandaSementaraPeta titik={titikSementara} />

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
                    <PenandaUniversal
                      key={node.nodeId}
                      posisi={{ lat: node.latitude, lng: node.longitude }}
                      type={node.type}
                      ragam={isSelected ? "terpilih" : "biasa"}
                      title={node.name}
                      onKlik={() => handleNodeClick(node)}
                      // Selama menggambar jalur, mengklik node berarti memilih
                      // ujung kabel — bukan membuka kartunya. Popup yang tidak
                      // dirender sama sekali membuat maksud itu tidak bisa
                      // salah dibaca.
                      popup={
                        fiberLineMode === "drawing" ? undefined : (
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
                        )
                      }
                    />
                  );
                })}
              </PetaUniversal>

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
