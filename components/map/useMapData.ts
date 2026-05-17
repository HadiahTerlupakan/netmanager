"use client";

import { useCallback, useState } from "react";
import type { MapSettings, MappingEdge } from "@prisma/client";

import { calculateMapDistance, generateMapId } from "./map-utils";
import { clientLogger } from "@/lib/client-logger";
import type { FiberFormData, MappingNode } from "./map-types";
import {
  mapNodesApi,
  mapEdgesApi,
  mapSettingsApi,
  mapStatisticsApi,
  mapResetApi,
} from "./map-api-client";

type ToastType = "success" | "error" | "info" | "warning";
type DeleteConfirmation = { type: "node" | "edge"; id: string } | null;

type MapStatistics = {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
};

interface UseMapDataParams {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

interface SaveFiberLineFormData {
  name: string;
  fiberType: string;
  notes: string;
}

const DEFAULT_STATISTICS: MapStatistics = {
  totalNodes: 0,
  totalEdges: 0,
  nodesByType: {},
};

/**
 * Custom hook untuk manage map data (nodes, edges, settings, statistics)
 * Menggunakan centralized API client untuk semua operations
 */
export function useMapData({ showToast }: UseMapDataParams) {
  const [nodes, setNodes] = useState<MappingNode[]>([]);
  const [edges, setEdges] = useState<MappingEdge[]>([]);
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] =
    useState<MapStatistics>(DEFAULT_STATISTICS);

  const fetchData = useCallback(async () => {
    try {
      const [nodesData, edgesData, settingsData, statsData] = await Promise.all(
        [
          mapNodesApi.list(),
          mapEdgesApi.list(),
          mapSettingsApi.get(),
          mapStatisticsApi.get(),
        ],
      );

      setNodes(nodesData);
      setEdges(edgesData);
      setSettings(settingsData);
      setStatistics(statsData);
    } catch (error) {
      clientLogger.error("Error fetching map data:", error);
      showToast("error", "Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const [hasFetched, setHasFetched] = useState(false);
  if (!hasFetched) {
    setHasFetched(true);
    void fetchData();
  }

  const updateNodePosition = useCallback(
    async (nodeId: string, position: [number, number]) => {
      try {
        await mapNodesApi.update(nodeId, {
          latitude: position[0],
          longitude: position[1],
        });
        showToast("success", "Position updated");
        fetchData();
      } catch (error) {
        clientLogger.error("Failed to update position:", error);
        showToast("error", "Failed to update position");
      }
    },
    [fetchData, showToast],
  );

  const saveNode = useCallback(
    async (data: Partial<MappingNode>, editingNodeId?: string) => {
      try {
        if (editingNodeId) {
          await mapNodesApi.update(editingNodeId, data);
          showToast("success", "Node updated");
        } else {
          await mapNodesApi.create({
            ...data,
            nodeId: generateMapId(),
          });
          showToast("success", "Node added");
        }
        fetchData();
        return true;
      } catch (error) {
        clientLogger.error("Failed to save node:", error);
        const message =
          error instanceof Error ? error.message : "Failed to save node";
        showToast("error", message);
        return false;
      }
    },
    [fetchData, showToast],
  );

  const saveFiberLine = useCallback(
    async (
      fiberFormData: FiberFormData | null,
      formData: SaveFiberLineFormData,
    ) => {
      if (!fiberFormData) {
        return false;
      }

      try {
        const sourceNode = nodes.find(
          (node) => node.nodeId === fiberFormData.source,
        );
        const targetNode = nodes.find(
          (node) => node.nodeId === fiberFormData.target,
        );

        if (!sourceNode || !targetNode) {
          showToast("error", "Source or target node not found");
          return false;
        }

        const distance = calculateMapDistance(
          sourceNode.latitude!,
          sourceNode.longitude!,
          targetNode.latitude!,
          targetNode.longitude!,
          fiberFormData.waypoints,
        );

        await mapEdgesApi.create({
          edgeId: generateMapId(),
          source: fiberFormData.source,
          target: fiberFormData.target,
          name: formData.name,
          fiberType: formData.fiberType,
          distance,
          waypoints: JSON.stringify(fiberFormData.waypoints),
          notes: formData.notes,
        });

        showToast("success", "Fiber line added");
        fetchData();
        return true;
      } catch (error) {
        clientLogger.error("Failed to add fiber line:", error);
        const message =
          error instanceof Error ? error.message : "Failed to add fiber line";
        showToast("error", message);
        return false;
      }
    },
    [fetchData, nodes, showToast],
  );

  const confirmDelete = useCallback(
    async (deleteConfirmation: DeleteConfirmation) => {
      if (!deleteConfirmation) {
        return false;
      }

      const { type, id } = deleteConfirmation;
      const label = type === "node" ? "Node" : "Fiber line";

      try {
        if (type === "node") {
          await mapNodesApi.delete(id);
        } else {
          await mapEdgesApi.delete(id);
        }

        showToast("success", `${label} deleted successfully`);
        fetchData();
        return true;
      } catch (error) {
        clientLogger.error(`Failed to delete ${type}:`, error);
        const message =
          error instanceof Error ? error.message : `Failed to delete ${label}`;
        showToast("error", message);
        return false;
      }
    },
    [fetchData, showToast],
  );

  const saveSettings = useCallback(
    async (data: Partial<MapSettings>) => {
      try {
        await mapSettingsApi.update(data);
        showToast("success", "Settings saved");
        fetchData();
      } catch (error) {
        clientLogger.error("Failed to save settings:", error);
        showToast("error", "Failed to save settings");
      }
    },
    [fetchData, showToast],
  );

  const exportMap = useCallback(() => {
    const data = {
      nodes: nodes.map((node) => ({
        node_id: node.nodeId,
        type: node.type,
        name: node.name,
        latitude: node.latitude,
        longitude: node.longitude,
        capacity: node.capacity,
        splitter: node.splitter,
        pppoe: node.pppoe,
        serialnumber: node.serialNumber,
        notes: node.notes || "",
      })),
      edges: edges.map((edge) => ({
        edge_id: edge.edgeId,
        source: edge.source,
        target: edge.target,
        fiber_type: edge.fiberType,
        distance: edge.distance,
        waypoints: edge.waypoints ? JSON.parse(edge.waypoints) : [],
        notes: edge.notes || "",
      })),
      settings,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `map-export-${new Date().toISOString().split("T")[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("success", "Map exported");
  }, [edges, nodes, settings, showToast]);

  const resetMap = useCallback(
    async (password: string) => {
      try {
        await mapResetApi.reset(password);
        showToast("success", "All map data deleted");
        fetchData();
      } catch (error) {
        clientLogger.error("Failed to reset map:", error);
        const message =
          error instanceof Error ? error.message : "Failed to reset map";
        showToast("error", message);
      }
    },
    [fetchData, showToast],
  );

  return {
    nodes,
    edges,
    settings,
    loading,
    statistics,
    updateNodePosition,
    saveNode,
    saveFiberLine,
    confirmDelete,
    saveSettings,
    exportMap,
    resetMap,
  };
}
