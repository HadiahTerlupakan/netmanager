import type { MappingEdge, MappingNode } from "@prisma/client";

import type { JalurRencanaDTO, TitikRencanaDTO } from "../dto/PlanningPetaDTO";

/**
 * Membaca kolom `waypoints` (JSON string array koordinat, ditulis dengan
 * `JSON.stringify` seperti di editor peta operasional).
 * Isi yang rusak dianggap tanpa waypoint agar satu baris buruk tidak
 * menggagalkan seluruh peta.
 */
function parseWaypoints(raw: string | null): Array<[number, number]> {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Array<[number, number]>) : [];
  } catch {
    return [];
  }
}

/** Pemetaan baris topologi rencana ke DTO respons. */
export const PlanningPetaMapper = {
  /** Baris `MappingNode` menjadi `TitikRencanaDTO`. */
  toTitikDTO(node: MappingNode): TitikRencanaDTO {
    return {
      nodeId: node.nodeId,
      planningId: node.planningId,
      type: node.type,
      name: node.name,
      latitude: node.latitude,
      longitude: node.longitude,
      splitter: node.splitter,
      notes: node.notes,
      isPlanned: node.isPlanned,
    };
  },

  /** Baris `MappingEdge` menjadi `JalurRencanaDTO`. */
  toJalurDTO(edge: MappingEdge): JalurRencanaDTO {
    return {
      edgeId: edge.edgeId,
      planningId: edge.planningId,
      source: edge.source,
      target: edge.target,
      fiberType: edge.fiberType,
      waypoints: parseWaypoints(edge.waypoints),
      distance: edge.distance,
      notes: edge.notes,
      isPlanned: edge.isPlanned,
    };
  },
};
