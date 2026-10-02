import type { Prisma } from "@prisma/client";

import type { BarisKeluhanDetail, BarisKeluhanRingkas } from "../repositories/KeluhanSalesRepository";

/** WO terbaru yang menangani keluhan (ringkas). */
export interface WoKeluhanRingkasDTO {
  nomor: string;
  status: string;
  namaTeknisi: string | null;
  jadwal: string | null;
}

/** Satu keluhan pada daftar "Keluhan" sales. */
export interface KeluhanRingkasDTO {
  id: string;
  nomor: string;
  subjek: string;
  kategori: string;
  prioritas: string;
  status: string;
  dibuatPada: string;
  diperbaruiPada: string;
  pelanggan: { id: string; nama: string; idPelanggan: string };
  /** Sales penanggung jawab pelanggan, atau pelapor bila belum ditetapkan. */
  namaSales: string | null;
  /** Null = dicatat pelanggan sendiri / admin. */
  namaPelapor: string | null;
  wo: WoKeluhanRingkasDTO | null;
}

export interface BalasanKeluhanDTO {
  id: string;
  pesan: string;
  dariHelpdesk: boolean;
  namaPengirim: string | null;
  waktu: string;
  lampiran: string[];
}

export interface WoKeluhanDTO {
  id: string;
  nomor: string;
  jenis: string;
  status: string;
  namaTeknisi: string | null;
  jadwal: string | null;
  jamJadwal: string | null;
  dimulaiPada: string | null;
  selesaiPada: string | null;
}

/** Detail keluhan: percakapan dengan helpdesk dan WO yang menanganinya. */
export interface KeluhanDetailDTO extends Omit<KeluhanRingkasDTO, "pelanggan" | "wo"> {
  deskripsi: string;
  selesaiPada: string | null;
  pelanggan: KeluhanRingkasDTO["pelanggan"] & { noTelp: string | null; alamat: string | null };
  balasan: BalasanKeluhanDTO[];
  workOrders: WoKeluhanDTO[];
}

const keIso = (tanggal: Date | null) => tanggal?.toISOString() ?? null;

/** Lampiran balasan tersimpan sebagai array JSON atau string JSON berisi array URL. */
export function bacaLampiran(nilai: Prisma.JsonValue | null): string[] {
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

function petaKepala(baris: BarisKeluhanRingkas | BarisKeluhanDetail) {
  return {
    id: baris.id,
    nomor: baris.ticketNumber,
    subjek: baris.subject,
    kategori: baris.category,
    prioritas: baris.priority,
    status: baris.status,
    dibuatPada: baris.createdAt.toISOString(),
    diperbaruiPada: baris.updatedAt.toISOString(),
    namaSales: baris.pelanggan.sales?.name ?? baris.dilaporkanOleh?.name ?? null,
    namaPelapor: baris.dilaporkanOleh?.name ?? null,
  };
}

/** Baris ringkas → DTO daftar keluhan. */
export function keKeluhanRingkasDto(baris: BarisKeluhanRingkas): KeluhanRingkasDTO {
  const wo = baris.workOrders[0];
  return {
    ...petaKepala(baris),
    pelanggan: { id: baris.pelanggan.id, nama: baris.pelanggan.nama, idPelanggan: baris.pelanggan.idPelanggan },
    wo: wo
      ? { nomor: wo.workOrderNumber, status: wo.status, namaTeknisi: wo.assignedTo?.name ?? null, jadwal: keIso(wo.scheduledDate) }
      : null,
  };
}

/** Baris detail → DTO detail keluhan. */
export function keKeluhanDetailDto(baris: BarisKeluhanDetail): KeluhanDetailDTO {
  const { pelanggan } = baris;
  return {
    ...petaKepala(baris),
    deskripsi: baris.description,
    selesaiPada: keIso(baris.resolvedAt),
    pelanggan: {
      id: pelanggan.id,
      nama: pelanggan.nama,
      idPelanggan: pelanggan.idPelanggan,
      noTelp: pelanggan.noTelp,
      alamat: pelanggan.alamat,
    },
    balasan: baris.replies.map((balasan) => ({
      id: balasan.id,
      pesan: balasan.message,
      dariHelpdesk: balasan.isFromAdmin,
      namaPengirim: balasan.user?.name ?? null,
      waktu: balasan.createdAt.toISOString(),
      lampiran: bacaLampiran(balasan.attachments),
    })),
    workOrders: baris.workOrders.map((wo) => ({
      id: wo.id,
      nomor: wo.workOrderNumber,
      jenis: wo.type,
      status: wo.status,
      namaTeknisi: wo.assignedTo?.name ?? null,
      jadwal: keIso(wo.scheduledDate),
      jamJadwal: wo.scheduledTimeStart,
      dimulaiPada: keIso(wo.startedAt),
      selesaiPada: keIso(wo.completedAt),
    })),
  };
}
