import type { MappingEdge, MappingNode } from "@prisma/client";

import type {
  JalurRencana,
  KoordinatRencana,
  TitikRencana,
} from "../domain/kebutuhan-material-osp";
import { uraikanWaypoints } from "./waypoints-rencana";

function koordinatDari(titik: MappingNode | undefined): KoordinatRencana {
  return {
    latitude: titik?.latitude ?? null,
    longitude: titik?.longitude ?? null,
  };
}

/** Pemetaan baris topologi ke masukan fungsi domain kebutuhan material. */
export const PlanningMaterialMapper = {
  /** Baris `MappingNode` menjadi `TitikRencana`. */
  toTitikRencana(node: MappingNode): TitikRencana {
    return { type: node.type, splitter: node.splitter };
  },

  /**
   * Baris `MappingEdge` + peta titik menjadi `JalurRencana`; ujung yang
   * hilang berkoordinat null.
   *
   * `waypoints` rusak diteruskan sebagai `null`, bukan diratakan menjadi
   * `[]`: domain memakainya untuk menyatakan "panjang tidak bisa ditentukan"
   * sehingga jalurnya masuk `jalurDiabaikan`, bukan dihitung sebagai garis
   * lurus yang lebih pendek dari kenyataan.
   */
  toJalurRencana(
    edge: MappingEdge,
    titikPerId: Map<string, MappingNode>,
  ): JalurRencana {
    return {
      fiberType: edge.fiberType,
      distance: edge.distance,
      sumber: koordinatDari(titikPerId.get(edge.source)),
      tujuan: koordinatDari(titikPerId.get(edge.target)),
      waypoints: uraikanWaypoints(edge.waypoints),
    };
  },
};
