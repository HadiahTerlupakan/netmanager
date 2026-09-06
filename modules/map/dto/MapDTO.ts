/**
 * Opsi ODP untuk dropdown pemilihan ODP pelanggan.
 * Sengaja ringkas: hanya yang dibutuhkan untuk memilih, bukan detail node.
 */
export interface OdpOptionDTO {
  id: string;
  name: string;
}

/**
 * Map DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/** DTO for map node list views. */
export interface MapNodeListItemDTO {
  nodeId: string;
  type: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  splitter: string | null;
  pppoe: string | null;
  serialNumber: string | null;
  notes: string | null;
  attenuationIn: number | null;
  attenuationOut: number | null;
  inputCoreColor: string | null;
  photo: string | null;
  metadata: Record<string, unknown> | null;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO for map node detail views. */
export interface MapNodeDetailDTO extends MapNodeListItemDTO {
  connectedEdges: MapEdgeDTO[];
}

/** DTO for map edge. */
export interface MapEdgeDTO {
  edgeId: string;
  source: string;
  target: string;
  fiberType: string | null;
  distance: number | null;
  waypoints: string | null;
  notes: string | null;
  name: string | null;
  sourceNodeName: string | null;
  targetNodeName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** DTO for map settings. */
export interface MapSettingsDTO {
  centerLat: string | null;
  centerLng: string | null;
  maxZoomIn: string | null;
  maxZoomOut: string | null;
  defaultZoom: string | null;
  updatedAt: string | null;
}

/** DTO for map statistics. */
export interface MapStatisticsDTO {
  totalNodes: number;
  totalEdges: number;
  totalCapacity: number;
  usedCapacity: number;
  utilizationPercent: number;
  nodesByType: Array<{
    type: string;
    count: number;
  }>;
}

/** DTO for full map data. */
export interface MapDataDTO {
  nodes: MapNodeListItemDTO[];
  edges: MapEdgeDTO[];
  settings: MapSettingsDTO | null;
}

// ==================== Request DTOs ====================

/** DTO for creating map node. */
export interface CreateMapNodeDTO {
  nodeId: string;
  type: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number;
  splitter?: string | null;
  pppoe?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  attenuationIn?: number | null;
  attenuationOut?: number | null;
  inputCoreColor?: string | null;
  photo?: string | null;
  metadata?: Record<string, unknown> | null;
  siteId?: string | null;
}

/** DTO for updating map node. */
export interface UpdateMapNodeDTO {
  type?: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number;
  splitter?: string | null;
  pppoe?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  attenuationIn?: number | null;
  attenuationOut?: number | null;
  inputCoreColor?: string | null;
  photo?: string | null;
  metadata?: Record<string, unknown> | null;
  siteId?: string | null;
}

/** DTO for creating map edge. */
export interface CreateMapEdgeDTO {
  edgeId?: string;
  source: string;
  target: string;
  fiberType?: string | null;
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
  name?: string | null;
}

/** DTO for updating map edge. */
export interface UpdateMapEdgeDTO {
  source?: string;
  target?: string;
  fiberType?: string | null;
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
  name?: string | null;
}

/** DTO for updating map settings. */
export interface UpdateMapSettingsDTO {
  centerLat?: string | null;
  centerLng?: string | null;
  maxZoomIn?: string | null;
  maxZoomOut?: string | null;
  defaultZoom?: string | null;
}
