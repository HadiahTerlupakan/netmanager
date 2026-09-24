import type { DepartemenRingkas } from "../domain/ports/IDepartemenRepository";

/** Satu pilihan departemen untuk klien: id untuk filter, nama untuk label. */
export interface DepartemenPresurveiDto {
  id: string;
  nama: string;
}

/** Bentuk departemen untuk klien. */
export function toDepartemenPresurveiDto(
  departemen: DepartemenRingkas,
): DepartemenPresurveiDto {
  return { id: departemen.id, nama: departemen.nama };
}
