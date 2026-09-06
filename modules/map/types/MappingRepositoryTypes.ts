export interface MapListFilters {
  siteId?: string;
  /** Batasi ke satu tipe node (mis. "odp") — disaring di SQL, bukan di memori. */
  type?: string;
  /**
   * Sertakan juga node yang belum punya site saat memfilter `siteId`.
   *
   * Dibutuhkan karena dua jalur pembuatan node peta tidak pernah mengisi
   * `siteId`: sinkronisasi peta (`createManyMappingNodes`) dan import CSV.
   * Di produksi seluruh 426 ODP ber-`siteId` null. Tanpa opsi ini, form
   * pelanggan yang wajib memilih site akan selalu mendapat dropdown ODP
   * kosong. `HargaPaketRepository` sudah memakai pendekatan toleran yang sama.
   */
  includeUnassignedSite?: boolean;
}

export interface CreateMapNodeInput {
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
  tenantId?: string | null;
  siteId?: string | null;
}

export interface UpdateMapNodeInput {
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
  tenantId?: string | null;
  siteId?: string | null;
}

export interface CreateMapEdgeInput {
  edgeId?: string;
  source: string;
  target: string;
  fiberType?: string | null;
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
  name?: string | null;
  tenantId?: string | null;
}

export interface UpdateMapEdgeInput {
  source?: string;
  target?: string;
  fiberType?: string | null;
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
  name?: string | null;
  tenantId?: string | null;
}

export interface UpdateMapSettingsInput {
  centerLat?: string | null;
  centerLng?: string | null;
  maxZoomIn?: string | null;
  maxZoomOut?: string | null;
  defaultZoom?: string | null;
  tenantId?: string | null;
}

export interface SyncMapNodeInput {
  nodeId: string;
  type: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  splitter?: string | null;
  pppoe?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
}

export interface SyncMapEdgeInput {
  edgeId: string;
  source: string;
  target: string;
  fiberType?: string | null;
  distance?: number | null;
  waypoints?: string | null;
  notes?: string | null;
}

export interface SyncMapDataInput {
  nodes: SyncMapNodeInput[];
  edges: SyncMapEdgeInput[];
}
