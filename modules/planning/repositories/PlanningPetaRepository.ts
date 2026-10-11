import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Data titik rencana baru; `isPlanned` selalu disetel repository ini. */
export interface BuatTitikData {
  planningId: string;
  tenantId: string;
  type: string;
  name: string;
  latitude: number;
  longitude: number;
  splitter: string;
  notes: string | null;
}

/** Bagian titik yang boleh diubah; jenis titik tidak termasuk. */
export type UbahTitikData = Partial<{
  name: string;
  latitude: number;
  longitude: number;
  splitter: string;
  notes: string | null;
}>;

/** Data jalur rencana baru; `waypoints` sudah berupa JSON string. */
export interface BuatJalurData {
  planningId: string;
  tenantId: string;
  source: string;
  target: string;
  fiberType: string;
  waypoints: string | null;
  distance: number | null;
  notes: string | null;
}

/**
 * Akses data titik & jalur rencana sebuah Planning OSP.
 *
 * Keduanya hidup di tabel topologi yang sama dengan jaringan nyata, jadi
 * setiap penulisan di sini **wajib** menyetel `isPlanned: true`. Nilai bawaan
 * kolom itu `false` (demi keamanan data lama dan editor peta biasa), sehingga
 * repository inilah satu-satunya yang boleh menandainya sebagai rencana.
 *
 * Hanya query, tanpa aturan bisnis. Metode tulis menerima `tx` opsional agar
 * service dapat menyatukannya dengan entri audit dalam satu transaksi.
 */
export class PlanningPetaRepository {
  /** Membuat titik rencana baru yang tertaut ke sebuah planning. */
  buatTitik(data: BuatTitikData, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.mappingNode.create({
      data: {
        nodeId: randomUUID(),
        ...data,
        isPlanned: true,
        capacity: 0,
        updatedAt: new Date(),
      },
    });
  }

  /** Mengubah atribut titik. */
  ubahTitik(
    nodeId: string,
    data: UbahTitikData,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    return client.mappingNode.update({ where: { nodeId }, data });
  }

  /** Menghapus satu titik. */
  async hapusTitik(nodeId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    await client.mappingNode.delete({ where: { nodeId } });
  }

  /** Mengambil satu titik tanpa memandang status rencana/terbit. */
  ambilTitik(nodeId: string) {
    return prisma.mappingNode.findUnique({ where: { nodeId } });
  }

  /** Titik rencana milik sebuah planning, urut pembuatan. */
  ambilTitikPerPlanning(planningId: string) {
    return prisma.mappingNode.findMany({
      where: { planningId, isPlanned: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Titik rencana yang planning induknya sudah dihapus (`onDelete: SetNull`). */
  ambilTitikYatim(tenantId: string) {
    return prisma.mappingNode.findMany({
      where: { tenantId, isPlanned: true, planningId: null },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Jumlah jalur apa pun (rencana maupun nyata) yang menyentuh sebuah titik. */
  hitungJalurTerhubung(nodeId: string) {
    return prisma.mappingEdge.count({
      where: { OR: [{ source: nodeId }, { target: nodeId }] },
    });
  }

  /** Membuat jalur rencana baru yang tertaut ke sebuah planning. */
  buatJalur(data: BuatJalurData, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.mappingEdge.create({
      data: { ...data, isPlanned: true },
    });
  }

  /** Mengambil satu jalur tanpa memandang status rencana/terbit. */
  ambilJalur(edgeId: string) {
    return prisma.mappingEdge.findUnique({ where: { edgeId } });
  }

  /** Menghapus satu jalur. */
  async hapusJalur(edgeId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    await client.mappingEdge.delete({ where: { edgeId } });
  }

  /** Jalur rencana milik sebuah planning, urut pembuatan. */
  ambilJalurPerPlanning(planningId: string) {
    return prisma.mappingEdge.findMany({
      where: { planningId, isPlanned: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
