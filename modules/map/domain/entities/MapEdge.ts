export interface MapEdge {
  edgeId: string;
  source: string;
  target: string;
  fiberType: string | null;
  distance: number | null;
  waypoints: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  name: string | null;
  tenantId: string | null;
  sourceNodeName: string | null;
  targetNodeName: string | null;
}
