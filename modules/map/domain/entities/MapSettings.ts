export interface MapSettings {
  id: number;
  centerLat: string | null;
  centerLng: string | null;
  maxZoomIn: string | null;
  maxZoomOut: string | null;
  defaultZoom: string | null;
  updatedAt: Date;
  tenantId: string | null;
}
