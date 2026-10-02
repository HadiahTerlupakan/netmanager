import { createRouteServiceError } from "@/lib/api/route-service-error";

import {
  ATURAN_JADWAL_AWAL,
  isPeriodeSah,
  jendelaDariAturan,
  jendelaSebulanPenuh,
  keadaanJendela,
  nilaiStatusGudang,
  rentangWaktuJendela,
  rentangWaktuPeriode,
  validasiAturan,
  validasiJadwalKhusus,
  type AturanJadwalSo,
  type JendelaSo,
  type KeadaanJendela,
  type RingkasanSoGudang,
  type StatusSoGudang,
} from "../domain/jadwal-stock-opname";
import { StockOpnameJadwalRepository } from "../repositories/StockOpnameJadwalRepository";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
/** Kelompok untuk gudang yang belum dikaitkan ke site mana pun. */
const NAMA_TANPA_SITE = "Tanpa site";

/** Jadwal SO satu site untuk satu bulan. */
export interface JadwalSoSite {
  siteId: string;
  namaSite: string;
  /** Jadwal bawaan site; `isDiatur` false = site belum punya jadwal. */
  aturan: AturanJadwalSo & { isDiatur: boolean };
  jendela: JendelaSo;
  catatan: string | null;
}

/** Jadwal khusus yang tersimpan untuk sebuah site. */
export interface JadwalKhususSite {
  periode: string;
  mulai: string;
  selesai: string;
  catatan: string | null;
}

/** Status SO satu gudang dalam satu bulan. */
export interface KepatuhanGudang extends RingkasanSoGudang {
  id: string;
  kode: string;
  nama: string;
  /** SO terakhir bulan ini (di dalam atau di luar jadwal). */
  soTerakhir: { tanggal: Date; pic: string | null } | null;
}

/** Gudang-gudang satu site beserta jadwal site itu. */
export interface KepatuhanSite {
  siteId: string | null;
  namaSite: string;
  jendela: JendelaSo;
  keadaan: KeadaanJendela;
  isPengingatAktif: boolean;
  gudang: KepatuhanGudang[];
}

/** Laporan kepatuhan SO satu bulan. */
export interface LaporanKepatuhanSo {
  periode: string;
  /** Jumlah pasangan site–gudang per status. */
  jumlahPerStatus: Record<StatusSoGudang, number>;
  site: KepatuhanSite[];
}

type GudangLaporan = Awaited<ReturnType<StockOpnameJadwalRepository["findGudangAktif"]>>[number];
type BarisOpname = Awaited<ReturnType<StockOpnameJadwalRepository["findOpnameDalamRentang"]>>[number];

function keTanggal(tanggal: string): Date {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

function keTeksTanggal(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10);
}

function tolak(pesan: string | null, status = HTTP_BAD_REQUEST): void {
  if (pesan) throw createRouteServiceError(pesan, status);
}

function tolakPeriode(periode: string): void {
  tolak(isPeriodeSah(periode) ? null : "Periode harus berformat YYYY-MM");
}

/** Jadwal stock opname per site dan laporan gudang yang sudah/belum di-SO. */
export class StockOpnameJadwalService {
  constructor(private readonly repository = new StockOpnameJadwalRepository()) {}

  /** Jadwal SO bulan `periode` untuk beberapa site sekaligus. */
  async getJadwalSites(
    tenantId: string,
    sites: { id: string; name: string }[],
    periode: string,
  ): Promise<Map<string, JadwalSoSite>> {
    tolakPeriode(periode);
    const siteIds = sites.map((site) => site.id);
    const [aturanList, khususList] = await Promise.all([
      this.repository.findAturanSites(tenantId, siteIds),
      this.repository.findJadwalSites(tenantId, siteIds, periode),
    ]);
    return new Map(
      sites.map((site) => {
        const tersimpan = aturanList.find((aturan) => aturan.siteId === site.id);
        const khusus = khususList.find((jadwal) => jadwal.siteId === site.id);
        const aturan = tersimpan
          ? {
              isAktif: tersimpan.isAktif,
              tanggalMulai: tersimpan.tanggalMulai,
              tanggalSelesai: tersimpan.tanggalSelesai,
              isDiatur: true,
            }
          : { ...ATURAN_JADWAL_AWAL, isAktif: false, isDiatur: false };
        let jendela: JendelaSo = tersimpan
          ? jendelaDariAturan(periode, aturan)
          : jendelaSebulanPenuh(periode);
        if (khusus) {
          jendela = {
            periode,
            mulai: keTeksTanggal(khusus.tanggalMulai),
            selesai: keTeksTanggal(khusus.tanggalSelesai),
            sumber: "KHUSUS",
          };
        }
        const jadwal: JadwalSoSite = {
          siteId: site.id,
          namaSite: site.name,
          aturan,
          jendela,
          catatan: khusus?.catatan ?? null,
        };
        return [site.id, jadwal] as const;
      }),
    );
  }

  /** Jadwal satu site untuk bulan `periode` beserta jadwal khusus mulai bulan itu. */
  async getJadwalSite(tenantId: string, siteId: string, periode: string) {
    const site = await this.pastikanSite(tenantId, siteId);
    const jadwal = await this.getJadwalSites(tenantId, [site], periode);
    const khusus = await this.repository.findJadwalKhususSite(tenantId, siteId, periode);
    return {
      ...(jadwal.get(siteId) as JadwalSoSite),
      jadwalKhusus: khusus.map(
        (baris): JadwalKhususSite => ({
          periode: baris.periode,
          mulai: keTeksTanggal(baris.tanggalMulai),
          selesai: keTeksTanggal(baris.tanggalSelesai),
          catatan: baris.catatan,
        }),
      ),
    };
  }

  /** Simpan jadwal bawaan site "tanggal X–Y setiap bulan" dan saklar pengingat. */
  async simpanAturanSite(tenantId: string, siteId: string, aturan: AturanJadwalSo) {
    await this.pastikanSite(tenantId, siteId);
    tolak(validasiAturan(aturan));
    return this.repository.upsertAturan(tenantId, siteId, aturan);
  }

  /** Simpan jadwal khusus site untuk satu bulan (menimpa jadwal bawaan bulan itu). */
  async simpanJadwalKhususSite(
    tenantId: string,
    siteId: string,
    periode: string,
    input: { mulai: string; selesai: string; catatan?: string | null },
    userId: string,
  ) {
    await this.pastikanSite(tenantId, siteId);
    tolak(validasiJadwalKhusus(periode, input.mulai, input.selesai));
    return this.repository.upsertJadwal(tenantId, siteId, periode, {
      tanggalMulai: keTanggal(input.mulai),
      tanggalSelesai: keTanggal(input.selesai),
      catatan: input.catatan?.trim() || null,
      diubahOlehId: userId,
    });
  }

  /** Hapus jadwal khusus site bulan itu (kembali ke jadwal bawaan site). */
  async hapusJadwalKhususSite(tenantId: string, siteId: string, periode: string) {
    await this.pastikanSite(tenantId, siteId);
    tolakPeriode(periode);
    await this.repository.deleteJadwal(tenantId, siteId, periode);
  }

  /** Site yang boleh dilihat pengguna `opname:site_only`. */
  async getSiteIdsPengguna(tenantId: string, userId: string): Promise<string[]> {
    return this.repository.findSiteIdsPengguna(tenantId, userId);
  }

  /**
   * Laporan gudang per site untuk bulan `periode`; tiap site dinilai dengan
   * jadwalnya sendiri. Site tanpa gudang tidak ditampilkan.
   * @param siteIds batasi ke site ini (pengguna `opname:site_only`); null = semua.
   */
  async getKepatuhan(
    tenantId: string,
    periode: string,
    siteIds: string[] | null,
    sekarang: Date = new Date(),
  ): Promise<LaporanKepatuhanSo> {
    tolakPeriode(periode);
    const [sites, gudangList] = await Promise.all([
      this.repository.findSitesAktif(tenantId, siteIds),
      this.repository.findGudangAktif(tenantId, siteIds),
    ]);
    const jadwalPerSite = await this.getJadwalSites(tenantId, sites, periode);
    const gudangIds = gudangList.map((gudang) => gudang.id);
    const bulan = rentangWaktuPeriode(periode);
    const [berstok, opnameBulanIni] = await Promise.all([
      this.repository.findBarangBerstok(tenantId, gudangIds),
      this.repository.findOpnameDalamRentang(tenantId, gudangIds, bulan.dari, bulan.sampai),
    ]);
    const nilaiGudang = (gudang: GudangLaporan, jendela: JendelaSo) =>
      nilaiKepatuhanGudang(gudang, jendela, berstok, opnameBulanIni);

    const hasil: KepatuhanSite[] = sites
      .map((site) => {
        const jadwal = jadwalPerSite.get(site.id) as JadwalSoSite;
        const gudang = gudangList.filter((item) => item.sites.some((s) => s.id === site.id));
        return {
          siteId: site.id,
          namaSite: site.name,
          jendela: jadwal.jendela,
          keadaan: keadaanJendela(jadwal.jendela, sekarang),
          isPengingatAktif: jadwal.aturan.isDiatur && jadwal.aturan.isAktif,
          gudang: gudang.map((item) => nilaiGudang(item, jadwal.jendela)),
        };
      })
      .filter((site) => site.gudang.length > 0);

    const tanpaSite = gudangList.filter((gudang) => gudang.sites.length === 0);
    if (siteIds === null && tanpaSite.length > 0) {
      const jendela = jendelaSebulanPenuh(periode);
      hasil.push({
        siteId: null,
        namaSite: NAMA_TANPA_SITE,
        jendela,
        keadaan: keadaanJendela(jendela, sekarang),
        isPengingatAktif: false,
        gudang: tanpaSite.map((item) => nilaiGudang(item, jendela)),
      });
    }

    return { periode, jumlahPerStatus: hitungPerStatus(hasil), site: hasil };
  }

  private async pastikanSite(tenantId: string, siteId: string) {
    const site = await this.repository.findSite(tenantId, siteId);
    if (!site) throw createRouteServiceError("Site tidak ditemukan", HTTP_NOT_FOUND);
    return site;
  }
}

/** Status satu gudang terhadap jendela site tertentu. */
function nilaiKepatuhanGudang(
  gudang: GudangLaporan,
  jendela: JendelaSo,
  berstok: { gudangId: string; barangId: string }[],
  opnameBulanIni: BarisOpname[],
): KepatuhanGudang {
  const jadwal = rentangWaktuJendela(jendela);
  const opname = opnameBulanIni.filter((baris) => baris.gudangId === gudang.id);
  const dalamJadwal = opname.filter(
    (baris) => baris.tanggal >= jadwal.dari && baris.tanggal <= jadwal.sampai,
  );
  const ringkasan = nilaiStatusGudang({
    barangBerstok: new Set(
      berstok.filter((baris) => baris.gudangId === gudang.id).map((baris) => baris.barangId),
    ),
    barangDihitungDalamJadwal: new Set(dalamJadwal.map((baris) => baris.barangId)),
    barangDihitungBulanIni: new Set(opname.map((baris) => baris.barangId)),
  });
  const terakhir = opname[0];
  return {
    id: gudang.id,
    kode: gudang.kode,
    nama: gudang.nama,
    ...ringkasan,
    soTerakhir: terakhir ? { tanggal: terakhir.tanggal, pic: terakhir.pic } : null,
  };
}

function hitungPerStatus(site: KepatuhanSite[]): Record<StatusSoGudang, number> {
  const jumlah: Record<StatusSoGudang, number> = {
    LENGKAP: 0,
    SEBAGIAN: 0,
    DI_LUAR_JADWAL: 0,
    BELUM: 0,
    TANPA_STOK: 0,
  };
  for (const item of site.flatMap((s) => s.gudang)) jumlah[item.status] += 1;
  return jumlah;
}

let stockOpnameJadwalService: StockOpnameJadwalService | null = null;

/** Singleton service jadwal & kepatuhan SO. */
export function getStockOpnameJadwalService() {
  stockOpnameJadwalService ??= new StockOpnameJadwalService();
  return stockOpnameJadwalService;
}
