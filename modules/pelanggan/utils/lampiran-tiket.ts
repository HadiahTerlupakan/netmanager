import type { Prisma } from "@prisma/client";

/**
 * Lampiran balasan tiket tersimpan sebagai array JSON berisi URL, atau (dari
 * sinkron WO) string JSON berisi array. Bentuk lain → kosong.
 */
export function bacaLampiranTiket(nilai: Prisma.JsonValue | null | undefined): string[] {
  let isi: unknown = nilai;
  if (typeof nilai === "string") {
    try {
      isi = JSON.parse(nilai);
    } catch {
      return [];
    }
  }
  return Array.isArray(isi) ? isi.filter((item): item is string => typeof item === "string") : [];
}
