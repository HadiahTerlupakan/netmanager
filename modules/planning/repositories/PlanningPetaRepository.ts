import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Tipe node yang boleh menjadi ujung kabel pada jalur rencana. */
export const TIPE_UJUNG_JALUR = [
  "olt",
  "odc",
  "odp",
  "pole",
  "joinbox",
] as const;

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

  /**
   * Titik **rencana yang belum dibangun** milik planning tertentu. Penyaringan
   * ada di query: titik terbit, titik planning lain, atau yatim tidak pernah
   * ikut terbaca.
   *
   * `isPlanned: true` di sini merangkap dua pertanyaan: "milik planning ini"
   * DAN "belum dibangun". Untuk mengubah atau menghapus titik, merangkapnya
   * benar — titik yang sudah masuk topologi operasional tidak boleh lagi
   * disentuh lewat jalur planning. Untuk hal yang sah dilakukan setelah titik
   * terbit (melampirkan foto, misalnya) merangkapnya SALAH: titiknya akan
   * dianggap tidak ada. Pakai `ambilTitikAsalPlanning` untuk pertanyaan yang
   * kedua, yang hanya menanyakan asal-usul.
   */
  ambilTitikMilikPlanning(nodeId: string, planningId: string) {
    return prisma.mappingNode.findFirst({
      where: { nodeId, planningId, isPlanned: true },
    });
  }

  /**
   * Titik yang **berasal dari** planning tertentu, terbit maupun belum.
   *
   * Saudara `ambilTitikMilikPlanning` tanpa penyaring `isPlanned`: `planningId`
   * sengaja dipertahankan setelah penerbitan sebagai jejak asal-usul, jadi
   * kolom itulah jawaban atas "titik ini milik rencana mana". Dipakai jalur
   * foto titik, yang justru harus tetap bisa dipakai setelah titik dibangun
   * (`COMPLETION_PHOTO` memang diunggah setelah pekerjaan selesai). Tetap
   * menolak titik planning lain dan titik yatim.
   */
  ambilTitikAsalPlanning(nodeId: string, planningId: string) {
    return prisma.mappingNode.findFirst({
      where: { nodeId, planningId },
    });
  }

  /**
   * Titik yang boleh menjadi ujung jalur rencana: titik rencana planning ini
   * atau node nyata, dalam tenant yang sama, dan hanya elemen infrastruktur
   * jalur kabel (perencanaan OSP berhenti di ODP, bukan perangkat pelanggan).
   */
  ambilTitikUjungJalur(nodeId: string, planningId: string, tenantId: string) {
    return prisma.mappingNode.findFirst({
      where: {
        nodeId,
        tenantId,
        type: { in: [...TIPE_UJUNG_JALUR] },
        OR: [{ isPlanned: false }, { isPlanned: true, planningId }],
      },
    });
  }

  /** Titik rencana milik sebuah planning, urut pembuatan. */
  ambilTitikPerPlanning(planningId: string) {
    return prisma.mappingNode.findMany({
      where: { planningId, isPlanned: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Titik (rencana maupun nyata) menurut daftar id, dibatasi pada tenant.
   * Dipakai membaca koordinat ujung jalur yang bisa berupa node nyata.
   */
  ambilTitikByIds(nodeIds: string[], tenantId: string) {
    return prisma.mappingNode.findMany({
      where: { nodeId: { in: nodeIds }, tenantId },
    });
  }

  /**
   * Node jaringan nyata yang relevan bagi perencanaan OSP, dalam satu tenant.
   *
   * Dibatasi pada tipe yang boleh menjadi ujung jalur: perencanaan OSP
   * berhenti di ODP, jadi perangkat pelanggan (ONT) hanya akan memadati peta
   * tanpa pernah bisa disambung. Daftar ini sengaja sama dengan
   * `ambilTitikUjungJalur`, supaya setiap node yang terlihat di latar memang
   * bisa dipilih sebagai ujung jalur.
   */
  ambilNodeNyataInfrastruktur(tenantId: string) {
    return prisma.mappingNode.findMany({
      where: {
        tenantId,
        isPlanned: false,
        type: { in: [...TIPE_UJUNG_JALUR] },
      },
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

  /** Jalur rencana milik planning tertentu; jalur terbit/planning lain tidak terbaca. */
  ambilJalurMilikPlanning(edgeId: string, planningId: string) {
    return prisma.mappingEdge.findFirst({
      where: { edgeId, planningId, isPlanned: true },
    });
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

  /**
   * Menerbitkan peta sebuah planning: melepas penanda rencana dari seluruh
   * titik dan jalurnya dalam satu transaksi. Tidak ada data yang disalin —
   * baris yang sama berhenti disaring dari topologi operasional.
   *
   * `planningId` SENGAJA tidak disentuh: ia jejak asal-usul node ("berasal
   * dari rencana mana") yang harus bertahan selamanya setelah terbit.
   * Penyaringan `tenantId` + `isPlanned: true` membuat pemanggilan ulang
   * idempoten (jumlahnya 0) dan tidak pernah menyentuh node nyata.
   */
  async tandaiTerbit(
    planningId: string,
    tenantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ titikTerbit: number; jalurTerbit: number }> {
    const jalankan = async (client: Prisma.TransactionClient) => {
      const titik = await client.mappingNode.updateMany({
        where: { planningId, tenantId, isPlanned: true },
        data: { isPlanned: false },
      });
      const jalur = await client.mappingEdge.updateMany({
        where: { planningId, tenantId, isPlanned: true },
        data: { isPlanned: false },
      });
      return { titikTerbit: titik.count, jalurTerbit: jalur.count };
    };

    if (tx) return jalankan(tx);
    return prisma.$transaction(jalankan);
  }
}
