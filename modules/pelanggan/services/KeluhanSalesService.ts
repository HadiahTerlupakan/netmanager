import { Prisma } from "@prisma/client";

import { createRouteServiceError } from "@/lib/api/route-service-error";
import { logActivitySafe, logger } from "@/lib/logger";
import { TicketEventDispatcher } from "@/modules/events";

import {
  KeluhanSalesRepository,
  STATUS_KELUHAN_SELESAI,
  STATUS_KELUHAN_TERBUKA,
} from "../repositories/KeluhanSalesRepository";
import type { SaringanSales } from "../repositories/PelangganSalesRepository";
import { formatNomorTiket } from "../utils/daily-document-number";
import type { DaftarKeluhanQuery, LaporKeluhanInput } from "../validators/keluhan-sales";

import { keKeluhanDetailDto, keKeluhanRingkasDto, type KeluhanRingkasDTO } from "./keluhan-sales.mapper";

const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
const KODE_PRISMA_UNIK = "P2002";
/** Percobaan ulang bila nomor tiket harian bentrok dengan tiket lain yang dibuat bersamaan. */
const PERCOBAAN_NOMOR_MAKS = 3;
/** Batas keluhan terbuka yang dihitung untuk ringkasan per sales. */
const BATAS_RINGKASAN = 1000;
const NAMA_TANPA_SALES = "Belum ada sales";

/** Pengguna mobile yang memanggil (sales / kepala sales / head of sales). */
export interface PenggunaKeluhan {
  id: string;
  tenantId: string;
}

/** Jumlah keluhan terbuka per sales, untuk kepala / head of sales. */
export interface RingkasanKeluhanSales {
  salesId: string | null;
  namaSales: string;
  jumlahTerbuka: number;
}

export interface HalamanKeluhan {
  data: KeluhanRingkasDTO[];
  total: number;
  page: number;
  limit: number;
  /** Null bila pemanggil hanya melihat keluhannya sendiri. */
  ringkasanSales: RingkasanKeluhanSales[] | null;
}

const tidakDitemukan = () => createRouteServiceError("Keluhan tidak ditemukan", HTTP_NOT_FOUND);

function isBentrokUnik(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === KODE_PRISMA_UNIK;
}

/** Lingkup lebih dari diri sendiri (tim / seluruh tenant) → tampilkan ringkasan per sales. */
function isLingkupLuas(saringan: SaringanSales) {
  return saringan === null || saringan.salesIds.length > 1;
}

/** Persempit lingkup ke satu sales; null bila sales itu di luar lingkup pemanggil. */
function persempitKeSales(saringan: SaringanSales, salesId: string | undefined): SaringanSales | undefined {
  if (!salesId) return saringan;
  if (saringan && !saringan.salesIds.includes(salesId)) return undefined;
  return { salesIds: [salesId] };
}

/**
 * Keluhan pelanggan yang dicatat sales dari aplikasi: lapor atas nama
 * pelanggan, pantau penanganan helpdesk & WO, dan balas pertanyaan helpdesk.
 * Tiket tetap ditangani helpdesk di /admin/support.
 */
export class KeluhanSalesService {
  constructor(private readonly repository = new KeluhanSalesRepository()) {}

  /** Catat keluhan baru atas nama pelanggan dalam lingkup sales. */
  async lapor(pelapor: PenggunaKeluhan, saringan: SaringanSales, input: LaporKeluhanInput) {
    const pelanggan = await this.repository.cariPelangganDalamLingkup(pelapor.tenantId, input.pelangganId, saringan);
    if (!pelanggan) {
      throw createRouteServiceError("Pelanggan tidak ditemukan atau bukan pelanggan Anda", HTTP_NOT_FOUND);
    }
    const tiket = await this.simpanDenganNomorUnik(pelapor, input);
    logActivitySafe({
      action: "CREATE",
      subject: "Support Ticket",
      details: { id: tiket.id, ticketNumber: tiket.ticketNumber, pelangganId: pelanggan.id, dilaporkanOlehId: pelapor.id },
    });
    await TicketEventDispatcher.onCreated({
      ticketId: tiket.id,
      ticketNumber: tiket.ticketNumber,
      subject: tiket.subject,
      priority: tiket.priority,
      pelangganNama: pelanggan.nama,
      siteId: pelanggan.siteId,
      triggeredBy: pelapor.id,
    }).catch((error) => logger.error("[KeluhanSales] Gagal publish ticket created:", error));
    return { id: tiket.id, nomor: tiket.ticketNumber };
  }

  /** Satu halaman keluhan dalam lingkup; ringkasan per sales di halaman pertama lingkup luas. */
  async daftar(tenantId: string, saringan: SaringanSales, query: DaftarKeluhanQuery): Promise<HalamanKeluhan> {
    const kosong = { data: [] as KeluhanRingkasDTO[], total: 0, page: query.page, limit: query.limit };
    const saringanEfektif = persempitKeSales(saringan, query.salesId);
    if (saringanEfektif === undefined || (saringanEfektif && saringanEfektif.salesIds.length === 0)) {
      return { ...kosong, ringkasanSales: null };
    }
    const statusDicari = query.status === "SELESAI" ? STATUS_KELUHAN_SELESAI : STATUS_KELUHAN_TERBUKA;
    const [halaman, ringkasanSales] = await Promise.all([
      this.repository.daftar(tenantId, saringanEfektif, statusDicari, {
        lewati: (query.page - 1) * query.limit,
        ambil: query.limit,
      }),
      query.page === 1 && isLingkupLuas(saringan) ? this.ringkasPerSales(tenantId, saringan) : null,
    ]);
    return { data: halaman.data.map(keKeluhanRingkasDto), total: halaman.total, page: query.page, limit: query.limit, ringkasanSales };
  }

  /** Detail keluhan dalam lingkup (404 bila di luar lingkup). */
  async detail(tenantId: string, saringan: SaringanSales, ticketId: string) {
    const baris = await this.repository.cariDetail(tenantId, ticketId, saringan);
    if (!baris) throw tidakDitemukan();
    return keKeluhanDetailDto(baris);
  }

  /** Balasan sales ke helpdesk; tiket yang menunggu jawaban pelanggan dibuka lagi. */
  async balas(pengirim: PenggunaKeluhan, saringan: SaringanSales, ticketId: string, pesan: string) {
    const baris = await this.repository.cariDetail(pengirim.tenantId, ticketId, saringan);
    if (!baris) throw tidakDitemukan();
    if (baris.status === "CLOSED") {
      throw createRouteServiceError("Keluhan sudah ditutup, buat laporan baru bila masih ada kendala", HTTP_UNPROCESSABLE);
    }
    const balasan = await this.repository.tambahBalasan({
      tenantId: pengirim.tenantId,
      ticketId,
      senderId: pengirim.id,
      message: pesan,
      statusBaru: baris.status === "WAITING_CUSTOMER" ? "OPEN" : undefined,
    });
    await TicketEventDispatcher.onReply({
      ticketId,
      ticketNumber: baris.ticketNumber,
      replyId: balasan.id,
      message: pesan,
      isFromAdmin: false,
      triggeredBy: pengirim.id,
    }).catch((error) => logger.error("[KeluhanSales] Gagal publish ticket reply:", error));
    return { id: balasan.id };
  }

  /** Nomor tiket harian dihitung dari jumlah tiket hari ini; ulangi bila bentrok. */
  private async simpanDenganNomorUnik(pelapor: PenggunaKeluhan, input: LaporKeluhanInput) {
    for (let percobaan = 0; ; percobaan += 1) {
      const jumlahHariIni = await this.repository.hitungTiketHariIni(pelapor.tenantId);
      try {
        return await this.repository.buat({
          tenantId: pelapor.tenantId,
          pelangganId: input.pelangganId,
          dilaporkanOlehId: pelapor.id,
          ticketNumber: formatNomorTiket(jumlahHariIni + percobaan),
          category: input.kategori,
          priority: input.prioritas,
          subject: input.subjek,
          description: input.deskripsi,
        });
      } catch (error) {
        if (!isBentrokUnik(error) || percobaan + 1 >= PERCOBAAN_NOMOR_MAKS) throw error;
      }
    }
  }

  /** Jumlah keluhan terbuka per sales (penanggung jawab pelanggan, atau pelapor). */
  private async ringkasPerSales(tenantId: string, saringan: SaringanSales): Promise<RingkasanKeluhanSales[]> {
    const baris = await this.repository.daftarPenanggungJawabTerbuka(tenantId, saringan, BATAS_RINGKASAN);
    const peta = new Map<string, RingkasanKeluhanSales>();
    for (const item of baris) {
      const sales = item.pelanggan.sales ?? item.dilaporkanOleh;
      const kunci = sales?.id ?? "";
      const ringkasan = peta.get(kunci) ?? {
        salesId: sales?.id ?? null,
        namaSales: sales?.name || NAMA_TANPA_SALES,
        jumlahTerbuka: 0,
      };
      ringkasan.jumlahTerbuka += 1;
      peta.set(kunci, ringkasan);
    }
    return [...peta.values()].sort((a, b) => b.jumlahTerbuka - a.jumlahTerbuka || a.namaSales.localeCompare(b.namaSales));
  }
}

let keluhanSalesService: KeluhanSalesService | null = null;

/** Singleton service keluhan lewat sales. */
export function getKeluhanSalesService() {
  keluhanSalesService ??= new KeluhanSalesService();
  return keluhanSalesService;
}
