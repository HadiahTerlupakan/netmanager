"use client";

import { useCallback, useEffect, useState } from "react";
import type { MapSettings, MappingEdge } from "@prisma/client";

import {
  calculateMapDistance,
  generateMapId,
} from "@/components/map/map-utils";
import { clientLogger } from "@/lib/client-logger";
import type { FiberFormData, MappingNode } from "@/components/map/map-types";

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

export function useMapData({ showToast }: UseMapDataParams) {
  const [nodes, setNodes] = useState<MappingNode[]>([]);
  const [edges, setEdges] = useState<MappingEdge[]>([]);
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] =
    useState<MapStatistics>(DEFAULT_STATISTICS);

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, edgesRes, settingsRes, statsRes] = await Promise.all([
        fetch("/api/map/nodes"),
        fetch("/api/map/edges"),
        fetch("/api/map/settings"),
        fetch("/api/map/statistics"),
      ]);

      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.data || []);
      }

      if (edgesRes.ok) {
        const data = await edgesRes.json();
        setEdges(data.data || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data.data || DEFAULT_STATISTICS);
      }
    } catch (error) {
      clientLogger.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateNodePosition = useCallback(
    async (nodeId: string, position: [number, number]) => {
      try {
        const res = await fetch(`/api/map/nodes/${nodeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position[0],
            longitude: position[1],
          }),
        });

        if (res.ok) {
          showToast("success", "Position updated");
          fetchData();
        }
      } catch (error) {
        clientLogger.error("Gagal mengupdate posisi", error);
        showToast("error", "Gagal mengupdate posisi");
      }
    },
    [fetchData, showToast],
  );

  const saveNode = useCallback(
    async (data: Partial<MappingNode>, editingNodeId?: string) => {
      try {
        const res = await fetch(
          editingNodeId ? `/api/map/nodes/${editingNodeId}` : "/api/map/nodes",
          {
            method: editingNodeId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              nodeId: editingNodeId || generateMapId(),
            }),
          },
        );

        if (res.ok) {
          showToast("success", editingNodeId ? "Node updated" : "Node added");
          fetchData();
          return true;
        }

        const error = await res.json();
        showToast("error", error.error || "Gagal menyimpan node");
        return false;
      } catch (error) {
        clientLogger.error("Gagal menyimpan node", error);
        showToast("error", "Gagal menyimpan node");
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
          return false;
        }

        const distance = calculateMapDistance(
          sourceNode.latitude!,
          sourceNode.longitude!,
          targetNode.latitude!,
          targetNode.longitude!,
          fiberFormData.waypoints,
        );

        const res = await fetch("/api/map/edges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edgeId: generateMapId(),
            source: fiberFormData.source,
            target: fiberFormData.target,
            name: formData.name,
            fiberType: formData.fiberType,
            distance,
            waypoints: JSON.stringify(fiberFormData.waypoints),
            notes: formData.notes,
          }),
        });

        if (res.ok) {
          showToast("success", "Fiber line added");
          fetchData();
          return true;
        }

        const error = await res.json();
        showToast("error", error.error || "Gagal menambah jalur fiber");
        return false;
      } catch (error) {
        clientLogger.error("Gagal menambah jalur fiber", error);
        showToast("error", "Gagal menambah jalur fiber");
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
      const endpoint =
        type === "node" ? `/api/map/nodes/${id}` : `/api/map/edges/${id}`;
      const label = type === "node" ? "Node" : "Fiber line";

      try {
        const res = await fetch(endpoint, { method: "DELETE" });

        if (res.ok) {
          showToast("success", `${label} deleted successfully`);
          fetchData();
          return true;
        }

        const error = await res
          .json()
          .catch(() => ({ error: "Unknown error" }));
        clientLogger.error(`DELETE ${type} failed:`, error);

        if (res.status === 403) {
          showToast("error", "Permission denied: You cannot delete this item");
        } else if (res.status === 404) {
          showToast("error", `${label} not found (might be already deleted)`);
        } else {
          showToast("error", error.error || `Failed to delete ${label}`);
        }

        return false;
      } catch (error) {
        clientLogger.error(`DELETE ${type} exception:`, error);
        showToast("error", `Failed to delete ${label}: Network error`);
        return false;
      }
    },
    [fetchData, showToast],
  );

  const saveSettings = useCallback(
    async (data: Partial<MapSettings>) => {
      const res = await fetch("/api/map/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        showToast("success", "Settings saved");
        fetchData();
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
      const res = await fetch("/api/map/reset", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        showToast("success", "All map data deleted");
        fetchData();
        return;
      }

      const error = await res.json();
      showToast("error", error.error || "Gagal mereset");
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
