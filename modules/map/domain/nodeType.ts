export const CANONICAL_NODE_TYPES = [
  "olt",
  "odc",
  "odp",
  "ont",
  "pole",
  "joinbox",
  "customer",
] as const;

export type CanonicalNodeType = (typeof CANONICAL_NODE_TYPES)[number];

export const SYNC_NODE_TYPES = ["server", "olt", "odc", "odp", "ont"] as const;
export type SyncNodeType = (typeof SYNC_NODE_TYPES)[number];

export const SYNC_TYPE_ALIASES: Record<string, CanonicalNodeType> = {
  server: "olt",
};

interface NodeTypeDefaults {
  capacity: number;
  usedPorts: number | null;
}

export const NODE_TYPE_DEFAULTS: Record<CanonicalNodeType, NodeTypeDefaults> = {
  olt: { capacity: 128, usedPorts: 0 },
  odc: { capacity: 96, usedPorts: 0 },
  odp: { capacity: 8, usedPorts: 0 },
  ont: { capacity: 1, usedPorts: 0 },
  pole: { capacity: 0, usedPorts: null },
  joinbox: { capacity: 0, usedPorts: null },
  customer: { capacity: 1, usedPorts: 1 },
};

export function normalizeSyncType(type: SyncNodeType): CanonicalNodeType {
  return SYNC_TYPE_ALIASES[type] ?? (type as CanonicalNodeType);
}

export function isCanonicalNodeType(type: string): type is CanonicalNodeType {
  return (CANONICAL_NODE_TYPES as readonly string[]).includes(type);
}
