import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getTimezone } from "@/lib/utils/get-timezone";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { RencanaEntity, RencanaJenis, RencanaStatusTampil } from "../domain/entities/Rencana";
import type { IKegiatanRepository } from "../domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import type {
  IRencanaRepository,
  UbahRencanaInput,
} from "../domain/ports/IRencanaRepository";
import type { ISalesRepository, SalesRingkas } from "../domain/ports/ISalesRepository";
import {
  hitungRekapRencana,
  isBolehMengatur,
  isDalamLingkup,
  isMasihTerbuka,
  isTanggalBolehDirencanakan,
  salesIdsDalamLingkup,
  tanggalLokal,
  tentukanSumber,
  type BarisRekapRencana,
  type JenisLingkupRencana,
  type LingkupRencana,
} from "../domain/rencana-rules";
import { KegiatanRepository } from "../repositories/KegiatanRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import { RencanaRepository } from "../repositories/RencanaRepository";
import { SalesRepository } from "../repositories/SalesRepository";
import { PenugasanSalesService } from "./PenugasanSalesService";

/** Pengguna yang sedang bertindak, dengan tenant sesinya. */
export interface PenggunaRencana {
  id: string;
  tenantId: string;
}

/** Hari ini dan zona tenant — dasar status tampil TERLEWAT dan laporan terlambat. */
export interface KonteksWaktuRencana {
  hariIni: string;
  zonaWaktu: string;
}

export interface BuatRencanaInput {
  /** Kosong = untuk diri sendiri. */
  salesId?: string;
  tanggal: string;
  jam?: string | null;
  jenis: RencanaJenis;
  tujuan: string;
  prospekId?: string | null;
  alamat?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DaftarRencanaInput {
  dari?: string;
  sampai?: string;
  salesId?: string;
  status?: RencanaStatusTampil;
  page: number;
  limit: number;
}

export interface RincianRencana {
  rencana: RencanaEntity;
  /** Kegiatan yang menjadi laporan rencana ini, bila sudah dilaporkan. */
  laporan: KegiatanEntity | null;
}

/** Muatan pengumuman penugasan rencana ke seorang sales. */
export interface MuatanRencanaDitugaskan {
  rencanaId: string;
  salesId: string;
  dibuatOlehId: string;
  namaPembuat: string | null;
  tanggal: string;
  jam: string | null;
  tujuan: string;
  tenantId: string;
}

export type PengumumPenugasanRencana = (
  muatan: MuatanRencanaDitugaskan,
) => Promise<void>;

type PenentuZonaWaktu = (tenantId: string) => Promise<string>;

const PESAN_TIDAK_DITEMUKAN = "Rencana tidak ditemukan";
const PESAN_DI_LUAR_LINGKUP = "Anda tidak berhak menugaskan rencana ke sales ini";
const PESAN_TIDAK_BOLEH_MENGATUR = "Rencana ini tidak bisa Anda ubah atau batalkan";
const PESAN_SUDAH_DITUTUP = "Rencana sudah dilaporkan atau dibatalkan";
const PESAN_TANGGAL_LAMPAU = "Tanggal rencana tidak boleh sebelum hari ini";
const PESAN_PROSPEK_TIDAK_ADA = "Prospek tidak ditemukan";

/** Pengumum bawaan: event bus, diimpor dinamis seperti `KegiatanService`. */
const umumkanLewatEventBus: PengumumPenugasanRencana = async (muatan) => {
  const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
  await eventBus.publish(EVENT_NAMES.PRESURVEI_RENCANA_ASSIGNED, {
    ...muatan,
    triggeredBy: muatan.dibuatOlehId,
  });
};

/**
 * Orkestrasi rencana kunjungan: dibuat sales sendiri atau ditugaskan
 * admin/kepala sales, lalu ditutup oleh laporan (kegiatan) — penutupan itu
 * dijalankan `KegiatanService.catat` dalam satu transaksi.
 *
 * Siapa berhak apa ditentukan lingkup (`LingkupRencana`) yang jenisnya
 * diputuskan route dari permission; service hanya memuat anggota tim dan
 * menegakkan batasnya.
 */
export class RencanaService {
  constructor(
    private readonly repository: IRencanaRepository = new RencanaRepository(),
    private readonly salesRepository: ISalesRepository = new SalesRepository(),
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
    private readonly kegiatanRepository: IKegiatanRepository = new KegiatanRepository(),
    private readonly penugasanSales: PenugasanSalesService = new PenugasanSalesService(),
    private readonly umumkanPenugasan: PengumumPenugasanRencana = umumkanLewatEventBus,
    private readonly tentukanZonaWaktu: PenentuZonaWaktu = getTimezone,
    private readonly sekarang: () => Date = () => new Date(),
  ) {}

  /** Bangun lingkup dari jenisnya; TIM memuat anggota tim dari database. */
  async lingkup(
    pengguna: PenggunaRencana,
    jenis: JenisLingkupRencana,
  ): Promise<LingkupRencana> {
    if (jenis !== "TIM") return { jenis, penggunaId: pengguna.id };
    const anggotaIds = await this.repository.anggotaTim(
      pengguna.id,
      pengguna.tenantId,
    );
    return { jenis, penggunaId: pengguna.id, anggotaIds };
  }

  /** Hari ini menurut zona tenant. */
  async konteksWaktu(tenantId: string): Promise<KonteksWaktuRencana> {
    const zonaWaktu = await this.tentukanZonaWaktu(tenantId);
    return { hariIni: tanggalLokal(this.sekarang(), zonaWaktu), zonaWaktu };
  }

  async daftar(
    input: DaftarRencanaInput,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<{ items: RencanaEntity[]; total: number; waktu: KonteksWaktuRencana }> {
    const waktu = await this.konteksWaktu(tenantId);
    const hasil = await this.repository.findMany({
      ...input,
      tenantId,
      salesIds: salesIdsDalamLingkup(lingkup),
      hariIni: waktu.hariIni,
    });
    return { ...hasil, waktu };
  }

  async rincian(
    id: string,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<RincianRencana> {
    const rencana = await this.muatDalamLingkup(id, lingkup, tenantId);
    const laporan = rencana.kegiatanId
      ? await this.kegiatanRepository.findById(rencana.kegiatanId)
      : null;
    return { rencana, laporan };
  }

  async buat(
    input: BuatRencanaInput,
    pengguna: PenggunaRencana,
    lingkup: LingkupRencana,
  ): Promise<RencanaEntity> {
    const salesId = input.salesId || pengguna.id;
    if (!isDalamLingkup(salesId, lingkup)) {
      throw new AppError(PESAN_DI_LUAR_LINGKUP, 403, "FORBIDDEN");
    }

    const penugasan = await this.penugasanSales.muatUntukBaris(
      salesId,
      pengguna.tenantId,
    );
    const tenantId = this.penugasanSales.pastikanSah(penugasan, {
      isWajibAktif: true,
    });

    await this.pastikanTanggalSah(input.tanggal, tenantId);
    await this.pastikanProspekSah(input.prospekId, tenantId);

    const rencana = await this.repository.create({
      salesId,
      dibuatOlehId: pengguna.id,
      sumber: tentukanSumber(salesId, pengguna.id),
      jenis: input.jenis,
      tanggal: input.tanggal,
      jam: input.jam ?? null,
      tujuan: input.tujuan,
      prospekId: input.prospekId ?? null,
      alamat: input.alamat ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      tenantId,
    });

    if (rencana.sumber === "PENUGASAN") this.umumkanTanpaMenggagalkan(rencana);
    return rencana;
  }

  async ubah(
    id: string,
    input: UbahRencanaInput,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<RencanaEntity> {
    const rencana = await this.muatUntukDiatur(id, lingkup, tenantId);
    if (input.tanggal !== undefined) {
      await this.pastikanTanggalSah(input.tanggal, tenantId);
    }
    if (input.prospekId) await this.pastikanProspekSah(input.prospekId, tenantId);

    const diubah = await this.repository.ubahSelagiTerbuka(rencana.id, input);
    if (!diubah) throw new AppError(PESAN_SUDAH_DITUTUP, 409, "CONFLICT");
    return diubah;
  }

  async batalkan(
    id: string,
    alasan: string,
    pengguna: PenggunaRencana,
    lingkup: LingkupRencana,
  ): Promise<RencanaEntity> {
    const rencana = await this.muatUntukDiatur(id, lingkup, pengguna.tenantId);
    const dibatalkan = await this.repository.batalkanSelagiTerbuka(rencana.id, {
      alasan,
      olehId: pengguna.id,
      pada: this.sekarang(),
    });
    if (!dibatalkan) throw new AppError(PESAN_SUDAH_DITUTUP, 409, "CONFLICT");
    return dibatalkan;
  }

  /** Rekap rencana vs realisasi per sales pada rentang tanggal. */
  async rekap(
    rentang: { dari: string; sampai: string },
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<{ baris: BarisRekapRencana[]; waktu: KonteksWaktuRencana }> {
    const waktu = await this.konteksWaktu(tenantId);
    const daftar = await this.repository.findUntukRekap({
      tenantId,
      salesIds: salesIdsDalamLingkup(lingkup),
      ...rentang,
    });
    return {
      baris: hitungRekapRencana(daftar, waktu.hariIni, waktu.zonaWaktu),
      waktu,
    };
  }

  /** Sales yang boleh ditugasi rencana oleh pengguna ini. */
  async salesTersedia(
    pengguna: PenggunaRencana,
    lingkup: LingkupRencana,
  ): Promise<SalesRingkas[]> {
    const ids = salesIdsDalamLingkup(lingkup);
    if (!ids) return this.salesRepository.daftarAktif(pengguna.tenantId);
    return this.salesRepository.daftarAktifDariIds(pengguna.tenantId, ids);
  }

  private async muatDalamLingkup(
    id: string,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<RencanaEntity> {
    const rencana = await this.repository.findById(id);
    // Rencana tenant lain dijawab sama dengan "tidak ada".
    if (!rencana || rencana.tenantId !== tenantId) {
      throw new AppError(PESAN_TIDAK_DITEMUKAN, 404, "NOT_FOUND");
    }
    if (!isDalamLingkup(rencana.salesId, lingkup)) {
      throw new AppError("Rencana ini milik sales lain", 403, "FORBIDDEN");
    }
    return rencana;
  }

  private async muatUntukDiatur(
    id: string,
    lingkup: LingkupRencana,
    tenantId: string,
  ): Promise<RencanaEntity> {
    const rencana = await this.muatDalamLingkup(id, lingkup, tenantId);
    if (!isBolehMengatur(rencana, lingkup)) {
      throw new AppError(PESAN_TIDAK_BOLEH_MENGATUR, 403, "FORBIDDEN");
    }
    if (!isMasihTerbuka(rencana.status)) {
      throw new AppError(PESAN_SUDAH_DITUTUP, 409, "CONFLICT");
    }
    return rencana;
  }

  private async pastikanTanggalSah(tanggal: string, tenantId: string): Promise<void> {
    const { hariIni } = await this.konteksWaktu(tenantId);
    if (!isTanggalBolehDirencanakan(tanggal, hariIni)) {
      throw new AppError(PESAN_TANGGAL_LAMPAU, 400, "VALIDATION_ERROR");
    }
  }

  private async pastikanProspekSah(
    prospekId: string | null | undefined,
    tenantId: string,
  ): Promise<void> {
    if (!prospekId) return;
    const prospek = await this.prospekRepository.findById(prospekId);
    if (!prospek || prospek.tenantId !== tenantId) {
      throw new AppError(PESAN_PROSPEK_TIDAK_ADA, 404, "NOT_FOUND");
    }
  }

  /** Penugasan sudah tersimpan; gagal mengumumkan tidak boleh membatalkannya. */
  private umumkanTanpaMenggagalkan(rencana: RencanaEntity): void {
    this.umumkanPenugasan({
      rencanaId: rencana.id,
      salesId: rencana.salesId,
      dibuatOlehId: rencana.dibuatOlehId,
      namaPembuat: rencana.namaPembuat,
      tanggal: rencana.tanggal,
      jam: rencana.jam,
      tujuan: rencana.tujuan,
      tenantId: rencana.tenantId ?? "",
    }).catch((error: unknown) => {
      logger.error("[RencanaService] Gagal mengumumkan penugasan rencana:", error);
    });
  }
}
