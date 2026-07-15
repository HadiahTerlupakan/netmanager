/**
 * Centralized API client untuk Map operations
 */

import { MAP_API } from "./map-constants";
import type { MappingNode } from "./map-types";
import type { MappingEdge, MapSettings } from "@prisma/client";

/**
 * Map Nodes API
 */
function withSiteQuery(url: string, siteId?: string | null): string {
  if (!siteId) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}siteId=${encodeURIComponent(siteId)}`;
}

export const mapNodesApi = {
  list: async (siteId?: string | null): Promise<MappingNode[]> => {
    const res = await fetch(withSiteQuery(MAP_API.NODES, siteId));
    if (!res.ok) throw new Error("Failed to fetch nodes");
    const json = await res.json();
    return json.data || [];
  },

  create: async (data: Partial<MappingNode>): Promise<MappingNode> => {
    const res = await fetch(MAP_API.NODES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create node");
    }
    const json = await res.json();
    return json.data;
  },

  update: async (nodeId: string, data: Partial<MappingNode>): Promise<void> => {
    const res = await fetch(`${MAP_API.NODES}/${nodeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update node");
    }
  },

  delete: async (nodeId: string): Promise<void> => {
    const res = await fetch(`${MAP_API.NODES}/${nodeId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to delete node");
    }
  },
};

/**
 * Map Edges API
 */
export const mapEdgesApi = {
  list: async (siteId?: string | null): Promise<MappingEdge[]> => {
    const res = await fetch(withSiteQuery(MAP_API.EDGES, siteId));
    if (!res.ok) throw new Error("Failed to fetch edges");
    const json = await res.json();
    return json.data || [];
  },

  create: async (data: {
    edgeId: string;
    source: string;
    target: string;
    name: string;
    fiberType: string;
    distance: number;
    waypoints: string;
    notes: string;
  }): Promise<MappingEdge> => {
    const res = await fetch(MAP_API.EDGES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create edge");
    }
    const json = await res.json();
    return json.data;
  },

  delete: async (edgeId: string): Promise<void> => {
    const res = await fetch(`${MAP_API.EDGES}/${edgeId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || "Failed to delete edge");
    }
  },
};

/**
 * Map Settings API
 */
export const mapSettingsApi = {
  get: async (): Promise<MapSettings | null> => {
    const res = await fetch(MAP_API.SETTINGS);
    if (!res.ok) throw new Error("Failed to fetch settings");
    const json = await res.json();
    return json.data;
  },

  update: async (data: Partial<MapSettings>): Promise<void> => {
    const res = await fetch(MAP_API.SETTINGS, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update settings");
    }
  },
};

/**
 * Map Statistics API
 */
export const mapStatisticsApi = {
  get: async (
    siteId?: string | null,
  ): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  }> => {
    const res = await fetch(withSiteQuery(MAP_API.STATISTICS, siteId));
    if (!res.ok) throw new Error("Failed to fetch statistics");
    const json = await res.json();
    return json.data || { totalNodes: 0, totalEdges: 0, nodesByType: {} };
  },
};

/**
 * Map Reset API
 */
export const mapResetApi = {
  reset: async (password: string): Promise<void> => {
    const res = await fetch(MAP_API.RESET, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to reset map");
    }
  },
};

export interface MapCsvImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ rowIndex: number; raw: string; error: string }>;
  results: Array<{
    rowIndex: number;
    nodeId: string;
    name: string;
    type: string;
    action: "created" | "updated";
    warnings: string[];
  }>;
}

/**
 * Map CSV Import API (merge mode)
 */
export const mapImportApi = {
  importCsv: async (file: File): Promise<MapCsvImportSummary> => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(MAP_API.IMPORT_CSV, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.message || "Gagal mengimpor CSV");
    }

    return (json.data?.summary || json.summary) as MapCsvImportSummary;
  },
};
