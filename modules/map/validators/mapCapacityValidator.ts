import type { MapNode } from "../domain/entities/MapNode";

/** Check whether a node type is limited by capacity. */
export function isCapacityLimitedNode(type: string): boolean {
  return type === "odc" || type === "odp";
}

/** Check whether the node can accept more outgoing edges. */
export function canAddOutgoingEdge(
  node: MapNode,
  currentConnections: number,
): boolean {
  if (!isCapacityLimitedNode(node.type)) {
    return true;
  }

  if (node.capacity <= 0) {
    return true;
  }

  return currentConnections < node.capacity;
}
