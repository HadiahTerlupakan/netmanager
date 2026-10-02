import type { TicketStatus } from "@prisma/client";

import { logger } from "@/lib/logger";
import { createNotification, hasNotificationForSource } from "@/modules/notification";

import { KeluhanSalesRepository } from "../repositories/KeluhanSalesRepository";

/** Kejadian pada keluhan yang perlu diketahui sales pelapor / penanggung jawab. */
export type KabarKeluhan =
  | { jenis: "STATUS"; status: TicketStatus }
  | { jenis: "BALASAN_HELPDESK" }
  | { jenis: "WO_DIBUAT"; nomorWo: string; jadwal?: string | null }
  | { jenis: "WO_DIMULAI"; nomorWo: string }
  | { jenis: "WO_SELESAI"; nomorWo: string };

/** Sumber notifikasi (sourceId = id tiket); aplikasi membuka `/(app)/keluhan/<sourceId>`. */
export const SUMBER_NOTIFIKASI_KELUHAN = "KELUHAN";

const LABEL_STATUS: Readonly<Record<TicketStatus, string>> = {
  OPEN: "dibuka kembali",
  IN_PROGRESS: "sedang ditangani",
  WAITING_CUSTOMER: "menunggu jawaban pelanggan",
  RESOLVED: "sudah diselesaikan",
  CLOSED: "ditutup",
};

const FORMAT_JADWAL = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/** Judul & isi notifikasi untuk satu kabar keluhan. */
export function susunPesanKabar(kabar: KabarKeluhan, nomorTiket: string, namaPelanggan: string) {
  switch (kabar.jenis) {
    case "STATUS":
      return { judul: `Keluhan ${namaPelanggan}`, pesan: `${nomorTiket} ${LABEL_STATUS[kabar.status]}.` };
    case "BALASAN_HELPDESK":
      return { judul: `Balasan helpdesk · ${namaPelanggan}`, pesan: `Helpdesk membalas ${nomorTiket}. Buka untuk membaca.` };
    case "WO_DIBUAT": {
      const jadwal = kabar.jadwal ? `, dijadwalkan ${FORMAT_JADWAL.format(new Date(kabar.jadwal))}` : "";
      return { judul: `Teknisi dijadwalkan · ${namaPelanggan}`, pesan: `${kabar.nomorWo} dibuat untuk ${nomorTiket}${jadwal}.` };
    }
    case "WO_DIMULAI":
      return { judul: `Teknisi menuju lokasi · ${namaPelanggan}`, pesan: `${kabar.nomorWo} mulai dikerjakan.` };
    case "WO_SELESAI":
      return { judul: `Keluhan selesai · ${namaPelanggan}`, pesan: `${kabar.nomorWo} selesai. Kabari pelanggan Anda.` };
  }
}

/**
 * Kabar progres WO datang dari event (at-least-once) → jangan kirim ulang kabar
 * yang isinya sama (pesan memuat nomor WO & tahapnya). Status & balasan helpdesk
 * dipanggil langsung dan boleh berulang.
 */
function isKabarIdempoten(kabar: KabarKeluhan) {
  return kabar.jenis !== "STATUS" && kabar.jenis !== "BALASAN_HELPDESK";
}

/** Kirim satu notifikasi keluhan; dilewati bila kabar idempoten ini sudah pernah terkirim. */
async function kirimKabar(params: {
  userId: string;
  tenantId: string;
  ticketId: string;
  kabar: KabarKeluhan;
  isi: { judul: string; pesan: string };
}) {
  const sumber = { userId: params.userId, sourceType: SUMBER_NOTIFIKASI_KELUHAN, sourceId: params.ticketId };
  if (isKabarIdempoten(params.kabar) && (await hasNotificationForSource({ ...sumber, message: params.isi.pesan }))) {
    return;
  }
  await createNotification({
    type: "TICKET",
    priority: params.kabar.jenis === "WO_SELESAI" ? "HIGH" : "NORMAL",
    title: params.isi.judul,
    message: params.isi.pesan,
    // Tautan web helpdesk; aplikasi membuka /(app)/keluhan/<sourceId> dari sourceType.
    link: `/admin/support/${params.ticketId}`,
    ...sumber,
    tenantId: params.tenantId,
  });
}

/**
 * Kabari sales pelapor dan sales penanggung jawab pelanggan (tanpa duplikat,
 * tanpa pelakunya sendiri). Tiket tanpa sales terkait tidak menghasilkan apa-apa.
 * Tidak pernah melempar: kegagalan notifikasi tidak boleh menggagalkan alur utama.
 */
export async function kabariSalesKeluhan(
  ticketId: string,
  kabar: KabarKeluhan,
  pelakuId?: string,
  repository = new KeluhanSalesRepository(),
): Promise<void> {
  try {
    const tiket = await repository.cariPenerimaKabar(ticketId);
    if (!tiket?.tenantId) return;
    const { tenantId } = tiket;
    const penerima = new Set([tiket.dilaporkanOlehId, tiket.pelanggan.salesId].filter((id): id is string => Boolean(id)));
    if (pelakuId) penerima.delete(pelakuId);
    const isi = susunPesanKabar(kabar, tiket.ticketNumber, tiket.pelanggan.nama);
    await Promise.all([...penerima].map((userId) => kirimKabar({ userId, tenantId, ticketId, kabar, isi })));
  } catch (error) {
    logger.error("[KeluhanSales] Gagal mengabari sales:", { ticketId, jenis: kabar.jenis, error });
  }
}
