export interface MobileTopologyEntity {
  otbs: Record<string, unknown>[];
  odcs: Record<string, unknown>[];
  odps: Record<string, unknown>[];
  joinboxes: Record<string, unknown>[];
  poles: Record<string, unknown>[];
  pelanggans: Record<string, unknown>[];
  kmzFiles: Record<string, unknown>[];
  mappingNodes: MobileTopologyNodeEntity[];
  mappingEdges: MobileTopologyEdgeEntity[];
  edgeCounts: MobileTopologyEdgeCountEntity[];
}

export interface MobileTopologyNodeEntity extends Record<string, unknown> {
  nodeId: string;
  name: string | null;
  type: string;
  photo: string | null;
  splitter: string | null;
  capacity: number | null;
  inputCoreColor: string | null;
  attenuationIn: number | null;
  attenuationOut: number | null;
}

export interface MobileTopologyEdgeEntity extends Record<string, unknown> {
  source: string;
  target: string;
  waypoints: string | null;
}

export interface MobileTopologyEdgeCountEntity {
  source: string;
  _count: { source: number };
}
