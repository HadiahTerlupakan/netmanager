import { randomUUID } from "crypto";

import type { Prisma, PrismaClient, TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";

import { toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";

import type { SaringanSales } from "./PelangganSalesRepository";

/** Status tiket yang dianggap masih berjalan / selesai bagi sales. */
export const STATUS_KELUHAN_TERBUKA: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"];
export const STATUS_KELUHAN_SELESAI: TicketStatus[] = ["RESOLVED", "CLOSED"];

const PILIH_PELAPOR = { select: { id: true, name: true } } as const;
const PILIH_TEKNISI = { select: { name: true } } as const;

const PILIH_KELUHAN_RINGKAS = {
  id: true,
  ticketNumber: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  pelanggan: { select: { id: true, nama: true, idPelanggan: true, salesId: true, sales: PILIH_PELAPOR } },
  dilaporkanOleh: PILIH_PELAPOR,
  workOrders: {
    select: { workOrderNumber: true, status: true, scheduledDate: true, assignedTo: PILIH_TEKNISI },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.SupportTicketsSelect;

const PILIH_KELUHAN_DETAIL = {
  ...PILIH_KELUHAN_RINGKAS,
  description: true,
  resolvedAt: true,
  pelanggan: {
    select: {
      id: true,
      nama: true,
      idPelanggan: true,
      noTelp: true,
      alamat: true,
      salesId: true,
      sales: PILIH_PELAPOR,
    },
  },
  replies: {
    select: { id: true, message: true, isFromAdmin: true, createdAt: true, attachments: true, user: PILIH_TEKNISI },
    orderBy: { createdAt: "asc" },
  },
  workOrders: {
    select: {
      id: true,
      workOrderNumber: true,
      type: true,
      status: true,
      scheduledDate: true,
      scheduledTimeStart: true,
      startedAt: true,
      completedAt: true,
      assignedTo: PILIH_TEKNISI,
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SupportTicketsSelect;

export type BarisKeluhanRingkas = Prisma.SupportTicketsGetPayload<{ select: typeof PILIH_KELUHAN_RINGKAS }>;
export type BarisKeluhanDetail = Prisma.SupportTicketsGetPayload<{ select: typeof PILIH_KELUHAN_DETAIL }>;

export interface DataKeluhanBaru {
  tenantId: string;
  pelangganId: string;
  dilaporkanOlehId: string;
  ticketNumber: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  /** Foto dari lapangan; disimpan sebagai balasan pertama pelapor agar tampil di percakapan. */
  foto: string[];
}

const PESAN_FOTO_KELUHAN = "Foto kondisi di lokasi pelanggan.";

/**
 * Tiket keluhan yang dilihat sales: dicatat olehnya, atau milik pelanggan yang
 * dipegangnya. Lingkup `null` (head of sales) = semua keluhan yang terkait sales.
 */
function whereLingkupKeluhan(tenantId: string, saringan: SaringanSales): Prisma.SupportTicketsWhereInput {
  if (!saringan) {
    return {
      tenantId,
      OR: [{ dilaporkanOlehId: { not: null } }, { pelanggan: { salesId: { not: null } } }],
    };
  }
  return {
    tenantId,
    OR: [{ dilaporkanOlehId: { in: saringan.salesIds } }, { pelanggan: { salesId: { in: saringan.salesIds } } }],
  };
}

/**
 * Data tiket keluhan yang dicatat / dipantau sales. Semua query menyaring
 * `tenantId` eksplisit (fail-closed), tidak bergantung ekstensi tenant.
 */
export class KeluhanSalesRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Pelanggan tenant dalam lingkup sales (null bila bukan / di luar lingkup). */
  async cariPelangganDalamLingkup(tenantId: string, pelangganId: string, saringan: SaringanSales) {
    return this.client.pelanggan.findFirst({
      where: {
        id: pelangganId,
        tenantId,
        ...(saringan ? { salesId: { in: saringan.salesIds } } : {}),
      },
      select: { id: true, nama: true, siteId: true },
    });
  }

  /** Jumlah tiket tenant hari ini, untuk nomor urut tiket harian. */
  async hitungTiketHariIni(tenantId: string): Promise<number> {
    return this.client.supportTickets.count({ where: { tenantId, createdAt: { gte: toStartOfDay(new Date()) } } });
  }

  /** Simpan tiket keluhan baru atas nama pelanggan beserta balasan berisi fotonya (satu transaksi). */
  async buat({ foto, ...data }: DataKeluhanBaru) {
    return this.client.$transaction(async (tx) => {
      const tiket = await tx.supportTickets.create({
        data: { id: randomUUID(), ...data, status: "OPEN", updatedAt: new Date() },
        select: { id: true, ticketNumber: true, subject: true, priority: true },
      });
      await tx.ticketReplies.create({
        data: {
          id: randomUUID(),
          ticketId: tiket.id,
          senderId: data.dilaporkanOlehId,
          isFromAdmin: false,
          message: PESAN_FOTO_KELUHAN,
          attachments: foto,
          tenantId: data.tenantId,
        },
      });
      return tiket;
    });
  }

  /** Satu halaman keluhan dalam lingkup, terbaru diperbarui dulu. */
  async daftar(
    tenantId: string,
    saringan: SaringanSales,
    statusDicari: TicketStatus[],
    halaman: { lewati: number; ambil: number },
  ): Promise<{ data: BarisKeluhanRingkas[]; total: number }> {
    const where: Prisma.SupportTicketsWhereInput = {
      AND: [whereLingkupKeluhan(tenantId, saringan), { status: { in: statusDicari } }],
    };
    const [data, total] = await Promise.all([
      this.client.supportTickets.findMany({
        where,
        select: PILIH_KELUHAN_RINGKAS,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: halaman.lewati,
        take: halaman.ambil,
      }),
      this.client.supportTickets.count({ where }),
    ]);
    return { data, total };
  }

  /** Penanggung jawab tiap keluhan terbuka dalam lingkup (untuk ringkasan per sales). */
  async daftarPenanggungJawabTerbuka(tenantId: string, saringan: SaringanSales, batas: number) {
    return this.client.supportTickets.findMany({
      where: { AND: [whereLingkupKeluhan(tenantId, saringan), { status: { in: STATUS_KELUHAN_TERBUKA } }] },
      select: { pelanggan: { select: { sales: PILIH_PELAPOR } }, dilaporkanOleh: PILIH_PELAPOR },
      take: batas,
    });
  }

  /** Detail keluhan dalam lingkup (null bila tidak ada / di luar lingkup). */
  async cariDetail(tenantId: string, ticketId: string, saringan: SaringanSales): Promise<BarisKeluhanDetail | null> {
    return this.client.supportTickets.findFirst({
      where: { AND: [whereLingkupKeluhan(tenantId, saringan), { id: ticketId }] },
      select: PILIH_KELUHAN_DETAIL,
    });
  }

  /** Simpan balasan sales pada tiket; `statusBaru` opsional ikut diterapkan. */
  async tambahBalasan(params: {
    tenantId: string;
    ticketId: string;
    senderId: string;
    message: string;
    statusBaru?: TicketStatus;
  }) {
    return this.client.$transaction(async (tx) => {
      const balasan = await tx.ticketReplies.create({
        data: {
          id: randomUUID(),
          ticketId: params.ticketId,
          senderId: params.senderId,
          isFromAdmin: false,
          message: params.message,
          tenantId: params.tenantId,
        },
        select: { id: true },
      });
      await tx.supportTickets.updateMany({
        where: { id: params.ticketId, tenantId: params.tenantId },
        data: { updatedAt: new Date(), ...(params.statusBaru ? { status: params.statusBaru } : {}) },
      });
      return balasan;
    });
  }

  /** Penerima kabar keluhan: pelapor dan sales penanggung jawab pelanggan. */
  async cariPenerimaKabar(ticketId: string) {
    return this.client.supportTickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        tenantId: true,
        ticketNumber: true,
        dilaporkanOlehId: true,
        pelanggan: { select: { nama: true, salesId: true } },
      },
    });
  }
}
