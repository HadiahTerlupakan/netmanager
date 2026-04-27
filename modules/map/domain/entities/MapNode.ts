export interface MapNode {
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
  createdAt: Date;
  updatedAt: Date;
  attenuationIn: number | null;
  attenuationOut: number | null;
  inputCoreColor: string | null;
  photo: string | null;
  metadata: Record<string, unknown> | null;
  tenantId: string | null;
}
