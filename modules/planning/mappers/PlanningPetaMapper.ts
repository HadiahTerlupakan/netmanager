import type { MappingEdge, MappingNode } from "@prisma/client";

import type { JalurRencanaDTO, TitikRencanaDTO } from "../dto/PlanningPetaDTO";
import { uraikanWaypoints } from "./waypoints-rencana";

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
      // Kolom rusak (`null`) diratakan menjadi `[]` di sini dan hanya di
      // sini: jejaknya tidak diketahui, dan jalur yang tidak bisa digambar
      // tidak boleh menggagalkan seluruh peta. Perhitungan material memakai
      // pengurai yang sama tetapi menghormati `null`, sehingga jalur itu
      // tetap masuk `jalurDiabaikan` alih-alih dihitung sebagai garis lurus.
      waypoints: uraikanWaypoints(edge.waypoints) ?? [],
      distance: edge.distance,
      notes: edge.notes,
      isPlanned: edge.isPlanned,
    };
  },
};
