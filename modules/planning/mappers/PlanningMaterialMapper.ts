import type { MappingEdge, MappingNode } from "@prisma/client";

import type {
  JalurRencana,
  KoordinatRencana,
  TitikRencana,
} from "../domain/kebutuhan-material-osp";

const PANJANG_PASANGAN_KOORDINAT = 2;

/** Apakah nilai berupa pasangan [latitude, longitude] berangka hingga. */
function isPasanganKoordinat(nilai: unknown): nilai is [number, number] {
  return (
    Array.isArray(nilai) &&
    nilai.length === PANJANG_PASANGAN_KOORDINAT &&
    nilai.every((angka) => typeof angka === "number" && Number.isFinite(angka))
  );
}

/**
 * Menguraikan kolom `waypoints` (String? berisi JSON) untuk perhitungan.
 * Kosong, gagal diurai, atau memuat satu elemen saja yang bukan pasangan
 * koordinat sah, maka seluruh waypoints jalur itu dianggap kosong (bukan hanya
 * elemen rusaknya). Data rusak tidak menggagalkan perhitungan anggaran; panjang
 * jalur tetap terhitung dari garis lurus ujung ke ujung.
 */
export function uraikanWaypointsUntukHitung(
  mentah: string | null,
): Array<[number, number]> {
  if (!mentah) return [];
  try {
    const hasil: unknown = JSON.parse(mentah);
    if (!Array.isArray(hasil) || !hasil.every(isPasanganKoordinat)) return [];
    return hasil;
  } catch {
    return [];
  }
}

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

  /** Baris `MappingEdge` + peta titik menjadi `JalurRencana`; ujung yang hilang berkoordinat null. */
  toJalurRencana(
    edge: MappingEdge,
    titikPerId: Map<string, MappingNode>,
  ): JalurRencana {
    return {
      fiberType: edge.fiberType,
      distance: edge.distance,
      sumber: koordinatDari(titikPerId.get(edge.source)),
      tujuan: koordinatDari(titikPerId.get(edge.target)),
      waypoints: uraikanWaypointsUntukHitung(edge.waypoints),
    };
  },
};
