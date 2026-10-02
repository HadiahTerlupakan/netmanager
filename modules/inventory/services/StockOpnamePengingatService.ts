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
  type KepatuhanSite,
} from "./StockOpnameJadwalService";

/** sourceType notifikasi pengingat SO (juga kunci dedupe). */
export const SUMBER_NOTIFIKASI_SO = "STOCK_OPNAME";
const HARI_MS = 24 * 60 * 60 * 1000;
const BATAS_NAMA_GUDANG = 5;

/** Tahap pengingat dalam satu jadwal SO. */
export type FasePengingatSo = "DIBUKA" | "HARI_TERAKHIR" | "DITUTUP";

type Penerima = { id: string; siteIds: string[]; isSiteOnly: boolean };
/** Site yang hari ini berada di sebuah fase, beserta gudang yang perlu disebut. */
type SiteFase = { site: KepatuhanSite; gudang: KepatuhanGudang[] };

export interface HasilPengingatSo {
  tenant: number;
  terkirim: number;
}

function tautanLaporan(periode: string): string {
  return `/admin/inventory/opname?tab=laporan&periode=${periode}`;
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

/** Site-site yang menjadi tanggung jawab penerima (dibatasi bila site_only). */
function siteMilik(penerima: Penerima, daftar: SiteFase[]): SiteFase[] {
  if (!penerima.isSiteOnly) return daftar;
  return daftar.filter((item) => item.site.siteId && penerima.siteIds.includes(item.site.siteId));
}

/** Gudang yang disebut tiap fase: hari pertama = yang belum lengkap; lainnya = yang belum tuntas. */
function gudangUntukFase(fase: FasePengingatSo, gudang: KepatuhanGudang[]): KepatuhanGudang[] {
  return gudang.filter((item) =>
    fase === "DIBUKA"
      ? item.status !== "TANPA_STOK" && item.status !== "LENGKAP"
      : isPerluDiingatkan(item.status),
  );
}

/**
 * Pengingat stock opname bulanan (dipanggil cron harian 08.00 WIB). Jadwal
 * berbeda per site, jadi fase dihitung per site:
 * - DIBUKA (hari pertama jadwal site): petugas gudang (`opname:create`) diberi
 *   tahu jadwal & gudang yang perlu di-SO.
 * - HARI_TERAKHIR: petugas diingatkan gudang yang belum tuntas.
 * - DITUTUP (sehari sesudah jadwal): pengelola (`opname:manage`) menerima
 *   ringkasan gudang yang tidak di-SO.
 * Hanya site yang pengingatnya aktif. Satu notifikasi per pengguna per fase
 * per hari (gabungan semua site-nya); idempotent.
 */
export class StockOpnamePengingatService {
  constructor(
    private readonly repository = new StockOpnameJadwalRepository(),
    private readonly jadwalService = new StockOpnameJadwalService(repository),
  ) {}

  async jalankan(sekarang: Date = new Date()): Promise<HasilPengingatSo> {
    const tenantIds = await this.repository.findTenantDenganPengingatAktif();
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
    const perFase = new Map<FasePengingatSo, SiteFase[]>();
    // Bulan lalu ikut diperiksa: jadwal yang berakhir di tanggal terakhir bulan
    // ditutup (DITUTUP) pada tanggal 1 bulan berikutnya.
    for (const periode of [periodeIni, periodeSebelumnya(periodeIni)]) {
      const laporan = await this.jadwalService.getKepatuhan(tenantId, periode, null, sekarang);
      for (const site of laporan.site) {
        const fase = site.isPengingatAktif ? faseHariIni(site.jendela, hariIni) : null;
        if (!fase) continue;
        const gudang = gudangUntukFase(fase, site.gudang);
        if (gudang.length > 0) perFase.set(fase, [...(perFase.get(fase) ?? []), { site, gudang }]);
      }
    }

    let terkirim = 0;
    for (const [fase, daftar] of perFase) {
      terkirim += await this.kirimFase(tenantId, fase, daftar, hariIni);
    }
    return terkirim;
  }

  private async kirimFase(
    tenantId: string,
    fase: FasePengingatSo,
    daftar: SiteFase[],
    hariIni: string,
  ): Promise<number> {
    const penerima = await this.repository.findPenggunaDenganIzin(
      tenantId,
      fase === "DITUTUP" ? "manage" : "create",
    );
    let terkirim = 0;
    for (const orang of penerima) {
      const milik = siteMilik(orang, daftar);
      if (milik.length === 0) continue;
      const sourceId = `${fase}:${hariIni}`;
      if (await hasNotificationForSource({ userId: orang.id, sourceType: SUMBER_NOTIFIKASI_SO, sourceId })) {
        continue;
      }
      const pesan = susunPesan(fase, milik);
      await createNotification({
        type: "ALERT",
        priority: fase === "DIBUKA" ? "NORMAL" : "HIGH",
        title: pesan.judul,
        message: pesan.isi,
        link: tautanLaporan(milik[0].site.jendela.periode),
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

/** "Site A (25 Okt–31 Okt): Gudang X, Gudang Y" per site. */
function daftarPerSite(daftar: SiteFase[]): string {
  return daftar
    .map(({ site, gudang }) => {
      const rentang = `${labelTanggal(site.jendela.mulai)}–${labelTanggal(site.jendela.selesai)}`;
      return `${site.namaSite} (${rentang}): ${ringkasNamaGudang(gudang)}`;
    })
    .join("; ");
}

/** Judul & isi notifikasi tiap fase (gabungan site-site penerima). */
export function susunPesan(fase: FasePengingatSo, daftar: SiteFase[]): { judul: string; isi: string } {
  const bulan = labelBulan(daftar[0].site.jendela.periode);
  const isi = daftarPerSite(daftar);
  if (fase === "DIBUKA") {
    return { judul: `Jadwal stock opname ${bulan} dimulai`, isi: `Lakukan stock opname — ${isi}.` };
  }
  if (fase === "HARI_TERAKHIR") {
    return { judul: "Hari terakhir stock opname", isi: `Jadwal SO berakhir hari ini. Belum tuntas — ${isi}.` };
  }
  const jumlah = daftar.reduce((total, item) => total + item.gudang.length, 0);
  return {
    judul: `${jumlah} gudang tidak tuntas stock opname ${bulan}`,
    isi: `Jadwal sudah lewat. Belum tuntas — ${isi}.`,
  };
}

let stockOpnamePengingatService: StockOpnamePengingatService | null = null;

/** Jalankan pengingat SO (entry point cron). */
export function runStockOpnameReminderCron(sekarang?: Date) {
  stockOpnamePengingatService ??= new StockOpnamePengingatService();
  return stockOpnamePengingatService.jalankan(sekarang);
}
