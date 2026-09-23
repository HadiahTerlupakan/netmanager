import type { SalesRingkas } from "../domain/ports/ISalesRepository";

/** Satu pilihan sales untuk klien: id untuk filter, nama untuk label. */
export interface SalesPresurveiDto {
  id: string;
  nama: string;
}

/** Bentuk sales untuk klien. */
export function toSalesPresurveiDto(sales: SalesRingkas): SalesPresurveiDto {
  return { id: sales.id, nama: sales.nama };
}
