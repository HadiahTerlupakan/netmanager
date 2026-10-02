import { logger } from "@/lib/logger";
import { createNotification, hasNotificationForSource } from "@/modules/notification";

import {
  isPerluDiingatkan,
  periodeDari,
  tanggalWib,
  type JendelaSo,
} from "../domain/jadwal-stock-opname";
import { StockOpnameJadwalRepository } from "../repositories/StockOpnameJadwalRepository";
import {
  StockOpnameJadwalService,
  type KepatuhanGudang,
  type LaporanKepatuhanSo,
} from "./StockOpnameJadwalService";

/** sourceType notifikasi pengingat SO (juga kunci dedupe). */
export const SUMBER_NOTIFIKASI_SO = "STOCK_OPNAME";
const HARI_MS = 24 * 60 * 60 * 1000;
const BATAS_NAMA_GUDANG = 5;

/** Tahap pengingat dalam satu jadwal SO. */
export type FasePengingatSo = "DIBUKA" | "HARI_TERAKHIR" | "DITUTUP";

type Penerima = { id: string; siteIds: string[]; isSiteOnly: boolean };
type GudangSite = KepatuhanGudang & { siteIds: (string | null)[] };

export interface HasilPengingatSo {
  tenant: number;
  terkirim: number;
}

function tautanJadwal(periode: string): string {
  return `/admin/inventory/opname?tab=jadwal&periode=${periode}`;
}

function labelBulan(periode: string): string {
  return new Date(`${periode}-01T00:00:00.000Z`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function labelTanggal(tanggal: string): string {
  return new Date(`${tanggal}T00:00:00.000Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function hariSesudah(tanggal: string): string {
  return new Date(new Date(`${tanggal}T00:00:00.000Z`).getTime() + HARI_MS)
    .toISOString()
    .slice(0, 10);
}

function periodeSebelumnya(periode: string): string {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan - 2, 1)).toISOString().slice(0, 7);
}

/** Fase pengingat hari ini untuk sebuah jendela, atau null bila bukan harinya. */
export function faseHariIni(jendela: JendelaSo, hariIni: string): FasePengingatSo | null {
  if (hariIni === jendela.mulai) return "DIBUKA";
  if (hariIni === jendela.selesai) return "HARI_TERAKHIR";
  if (hariIni === hariSesudah(jendela.selesai)) return "DITUTUP";
  return null;
}

function ringkasNamaGudang(gudang: KepatuhanGudang[]): string {
  const nama = gudang.slice(0, BATAS_NAMA_GUDANG).map((item) => item.nama);
  const sisa = gudang.length - nama.length;
  return sisa > 0 ? `${nama.join(", ")} dan ${sisa} lainnya` : nama.join(", ");
}

/** Gudang yang menjadi tanggung jawab penerima (dibatasi site bila site_only). */
function gudangMilik(penerima: Penerima, gudang: GudangSite[]): GudangSite[] {
  if (!penerima.isSiteOnly) return gudang;
  return gudang.filter((item) => item.siteIds.some((id) => id && penerima.siteIds.includes(id)));
}

/** Daftar gudang tanpa duplikat (gudang lintas site muncul sekali) beserta site-nya. */
function gudangUnik(laporan: LaporanKepatuhanSo): GudangSite[] {
  const peta = new Map<string, GudangSite>();
  for (const site of laporan.site) {
    for (const gudang of site.gudang) {
      const ada = peta.get(gudang.id);
      if (ada) ada.siteIds.push(site.siteId);
      else peta.set(gudang.id, { ...gudang, siteIds: [site.siteId] });
    }
  }
  return [...peta.values()];
}

/**
 * Pengingat stock opname bulanan (dipanggil cron harian 08.00 WIB):
 * - DIBUKA (hari pertama jadwal): petugas gudang (`opname:create`) diberi tahu
 *   jadwal & gudang yang perlu di-SO.
 * - HARI_TERAKHIR: petugas diingatkan gudang yang belum tuntas.
 * - DITUTUP (sehari sesudah jadwal): pengelola (`opname:manage`) menerima
 *   ringkasan gudang yang tidak di-SO.
 * Hanya tenant yang mengaktifkan jadwal SO. Idempotent per pengguna+fase.
 */
export class StockOpnamePengingatService {
  constructor(
    private readonly repository = new StockOpnameJadwalRepository(),
    private readonly jadwalService = new StockOpnameJadwalService(repository),
  ) {}

  async jalankan(sekarang: Date = new Date()): Promise<HasilPengingatSo> {
    const tenantIds = await this.repository.findTenantAktif();
    let terkirim = 0;
    for (const tenantId of tenantIds) {
      try {
        terkirim += await this.jalankanTenant(tenantId, sekarang);
      } catch (error) {
        logger.error(`[StockOpnamePengingat] Tenant ${tenantId} gagal:`, error);
      }
    }
    return { tenant: tenantIds.length, terkirim };
  }

  private async jalankanTenant(tenantId: string, sekarang: Date): Promise<number> {
    const hariIni = tanggalWib(sekarang);
    const periodeIni = periodeDari(sekarang);
    let terkirim = 0;
    // Bulan lalu ikut diperiksa: jadwal yang berakhir di tanggal terakhir bulan
    // ditutup (DITUTUP) pada tanggal 1 bulan berikutnya.
    for (const periode of [periodeIni, periodeSebelumnya(periodeIni)]) {
      const { jendela } = await this.jadwalService.getJadwal(tenantId, periode);
      const fase = faseHariIni(jendela, hariIni);
      if (!fase) continue;
      const laporan = await this.jadwalService.getKepatuhan(tenantId, periode, null, sekarang);
      terkirim += await this.kirimFase(tenantId, fase, laporan);
    }
    return terkirim;
  }

  private async kirimFase(
    tenantId: string,
    fase: FasePengingatSo,
    laporan: LaporanKepatuhanSo,
  ): Promise<number> {
    const { jendela } = laporan;
    const semuaGudang = gudangUnik(laporan);
    const action = fase === "DITUTUP" ? "manage" : "create";
    const penerima = await this.repository.findPenggunaDenganIzin(tenantId, action);
    let terkirim = 0;

    for (const orang of penerima) {
      const gudang = gudangMilik(orang, semuaGudang).filter((item) =>
        fase === "DIBUKA" ? item.status !== "TANPA_STOK" && item.status !== "LENGKAP" : isPerluDiingatkan(item.status),
      );
      if (gudang.length === 0) continue;
      const sourceId = `${jendela.periode}:${fase}`;
      if (await hasNotificationForSource({ userId: orang.id, sourceType: SUMBER_NOTIFIKASI_SO, sourceId })) {
        continue;
      }
      const pesan = susunPesan(fase, jendela, gudang);
      await createNotification({
        type: "ALERT",
        priority: fase === "DIBUKA" ? "NORMAL" : "HIGH",
        title: pesan.judul,
        message: pesan.isi,
        link: tautanJadwal(jendela.periode),
        userId: orang.id,
        sourceType: SUMBER_NOTIFIKASI_SO,
        sourceId,
        tenantId,
      });
      terkirim += 1;
    }
    return terkirim;
  }
}

/** Judul & isi notifikasi tiap fase. */
export function susunPesan(
  fase: FasePengingatSo,
  jendela: JendelaSo,
  gudang: KepatuhanGudang[],
): { judul: string; isi: string } {
  const bulan = labelBulan(jendela.periode);
  const rentang = `${labelTanggal(jendela.mulai)}–${labelTanggal(jendela.selesai)}`;
  const daftar = ringkasNamaGudang(gudang);
  if (fase === "DIBUKA") {
    return {
      judul: `Jadwal stock opname ${bulan} dimulai`,
      isi: `Lakukan stock opname tanggal ${rentang} untuk gudang: ${daftar}.`,
    };
  }
  if (fase === "HARI_TERAKHIR") {
    return {
      judul: "Hari terakhir stock opname",
      isi: `Jadwal SO ${bulan} berakhir hari ini. Belum tuntas: ${daftar}.`,
    };
  }
  return {
    judul: `${gudang.length} gudang tidak tuntas stock opname ${bulan}`,
    isi: `Jadwal ${rentang} sudah lewat. Gudang belum tuntas: ${daftar}.`,
  };
}

let stockOpnamePengingatService: StockOpnamePengingatService | null = null;

/** Jalankan pengingat SO (entry point cron). */
export function runStockOpnameReminderCron(sekarang?: Date) {
  stockOpnamePengingatService ??= new StockOpnamePengingatService();
  return stockOpnamePengingatService.jalankan(sekarang);
}
