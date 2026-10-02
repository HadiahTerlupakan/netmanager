import { createRouteServiceError } from "@/lib/api/route-service-error";

import {
  ATURAN_JADWAL_BAWAAN,
  jendelaDariAturan,
  keadaanJendela,
  nilaiStatusGudang,
  rentangWaktuJendela,
  rentangWaktuPeriode,
  validasiAturan,
  validasiJadwalKhusus,
  isPeriodeSah,
  type AturanJadwalSo,
  type JendelaSo,
  type KeadaanJendela,
  type RingkasanSoGudang,
  type StatusSoGudang,
} from "../domain/jadwal-stock-opname";
import { StockOpnameJadwalRepository } from "../repositories/StockOpnameJadwalRepository";

const HTTP_BAD_REQUEST = 400;
/** Kelompok untuk gudang yang belum dikaitkan ke site mana pun. */
const NAMA_TANPA_SITE = "Tanpa site";

/** Jadwal SO satu bulan beserta aturan bawaannya. */
export interface JadwalSoBulan {
  aturan: AturanJadwalSo & { isDiatur: boolean };
  jendela: JendelaSo;
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

/** Gudang-gudang satu site. */
export interface KepatuhanSite {
  siteId: string | null;
  namaSite: string;
  gudang: KepatuhanGudang[];
}

/** Laporan kepatuhan SO satu bulan. */
export interface LaporanKepatuhanSo {
  jendela: JendelaSo;
  keadaan: KeadaanJendela;
  jumlahPerStatus: Record<StatusSoGudang, number>;
  site: KepatuhanSite[];
}

function keTanggal(tanggal: string): Date {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

function keTeksTanggal(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 10);
}

function tolak(pesan: string | null): void {
  if (pesan) throw createRouteServiceError(pesan, HTTP_BAD_REQUEST);
}

/** Jadwal stock opname bulanan dan laporan gudang yang sudah/belum di-SO. */
export class StockOpnameJadwalService {
  constructor(private readonly repository = new StockOpnameJadwalRepository()) {}

  /** Jadwal SO bulan `periode`: jadwal khusus bila ada, selain itu aturan bawaan. */
  async getJadwal(tenantId: string, periode: string): Promise<JadwalSoBulan> {
    tolak(isPeriodeSah(periode) ? null : "Periode harus berformat YYYY-MM");
    const [aturanTersimpan, khusus] = await Promise.all([
      this.repository.findAturan(tenantId),
      this.repository.findJadwal(tenantId, periode),
    ]);
    const aturan = aturanTersimpan
      ? {
          isAktif: aturanTersimpan.isAktif,
          tanggalMulai: aturanTersimpan.tanggalMulai,
          tanggalSelesai: aturanTersimpan.tanggalSelesai,
          isDiatur: true,
        }
      : { ...ATURAN_JADWAL_BAWAAN, isDiatur: false };
    const jendela: JendelaSo = khusus
      ? {
          periode,
          mulai: keTeksTanggal(khusus.tanggalMulai),
          selesai: keTeksTanggal(khusus.tanggalSelesai),
          sumber: "KHUSUS",
        }
      : jendelaDariAturan(periode, aturan);
    return { aturan, jendela, catatan: khusus?.catatan ?? null };
  }

  /** Simpan aturan bawaan "tanggal X–Y setiap bulan" dan saklar pengingat. */
  async simpanAturan(tenantId: string, aturan: AturanJadwalSo) {
    tolak(validasiAturan(aturan));
    return this.repository.upsertAturan(tenantId, aturan);
  }

  /** Simpan jadwal khusus untuk satu bulan (menimpa aturan bawaan bulan itu). */
  async simpanJadwalKhusus(
    tenantId: string,
    periode: string,
    input: { mulai: string; selesai: string; catatan?: string | null },
    userId: string,
  ) {
    tolak(validasiJadwalKhusus(periode, input.mulai, input.selesai));
    return this.repository.upsertJadwal(tenantId, periode, {
      tanggalMulai: keTanggal(input.mulai),
      tanggalSelesai: keTanggal(input.selesai),
      catatan: input.catatan?.trim() || null,
      diubahOlehId: userId,
    });
  }

  /** Hapus jadwal khusus bulan itu (kembali ke aturan bawaan). */
  async hapusJadwalKhusus(tenantId: string, periode: string) {
    tolak(isPeriodeSah(periode) ? null : "Periode harus berformat YYYY-MM");
    await this.repository.deleteJadwal(tenantId, periode);
  }

  /** Site yang boleh dilihat pengguna `opname:site_only`. */
  async siteIdsPengguna(userId: string): Promise<string[]> {
    return this.repository.findSiteIdsPengguna(userId);
  }

  /**
   * Laporan gudang per site untuk bulan `periode`.
   * @param siteIds batasi ke site ini (pengguna `opname:site_only`); null = semua.
   */
  async getKepatuhan(
    tenantId: string,
    periode: string,
    siteIds: string[] | null,
    sekarang: Date = new Date(),
  ): Promise<LaporanKepatuhanSo> {
    const { jendela } = await this.getJadwal(tenantId, periode);
    const gudangList = await this.repository.findGudangAktif(tenantId, siteIds);
    const gudangIds = gudangList.map((gudang) => gudang.id);
    const bulan = rentangWaktuPeriode(periode);
    const jadwal = rentangWaktuJendela(jendela);
    const [berstok, opnameBulanIni] = await Promise.all([
      this.repository.findBarangBerstok(tenantId, gudangIds),
      this.repository.findOpnameDalamRentang(tenantId, gudangIds, bulan.dari, bulan.sampai),
    ]);

    const kepatuhanPerGudang = new Map(
      gudangList.map((gudang) => {
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
        const kepatuhan: KepatuhanGudang = {
          id: gudang.id,
          kode: gudang.kode,
          nama: gudang.nama,
          ...ringkasan,
          soTerakhir: terakhir ? { tanggal: terakhir.tanggal, pic: terakhir.pic } : null,
        };
        return [gudang.id, kepatuhan] as const;
      }),
    );

    return {
      jendela,
      keadaan: keadaanJendela(jendela, sekarang),
      jumlahPerStatus: hitungPerStatus([...kepatuhanPerGudang.values()]),
      site: kelompokkanPerSite(gudangList, kepatuhanPerGudang, siteIds),
    };
  }
}

function hitungPerStatus(gudang: KepatuhanGudang[]): Record<StatusSoGudang, number> {
  const jumlah: Record<StatusSoGudang, number> = {
    LENGKAP: 0,
    SEBAGIAN: 0,
    DI_LUAR_JADWAL: 0,
    BELUM: 0,
    TANPA_STOK: 0,
  };
  for (const item of gudang) jumlah[item.status] += 1;
  return jumlah;
}

/**
 * Gudang dikelompokkan per site; gudang yang melayani beberapa site tampil di
 * tiap site. Gudang tanpa site dikumpulkan di kelompok "Tanpa site".
 */
function kelompokkanPerSite(
  gudangList: { id: string; sites: { id: string; name: string }[] }[],
  kepatuhan: Map<string, KepatuhanGudang>,
  siteIdsDibatasi: string[] | null,
): KepatuhanSite[] {
  const perSite = new Map<string | null, KepatuhanSite>();
  for (const gudang of gudangList) {
    const data = kepatuhan.get(gudang.id);
    if (!data) continue;
    const sites = gudang.sites.filter((site) => !siteIdsDibatasi || siteIdsDibatasi.includes(site.id));
    const tujuan = sites.length > 0 ? sites : [{ id: null, name: NAMA_TANPA_SITE }];
    for (const site of tujuan) {
      const kelompok = perSite.get(site.id) ?? { siteId: site.id, namaSite: site.name, gudang: [] };
      kelompok.gudang.push(data);
      perSite.set(site.id, kelompok);
    }
  }
  return [...perSite.values()].sort((a, b) => {
    if (a.siteId === null) return 1;
    if (b.siteId === null) return -1;
    return a.namaSite.localeCompare(b.namaSite, "id");
  });
}

let stockOpnameJadwalService: StockOpnameJadwalService | null = null;

/** Singleton service jadwal & kepatuhan SO. */
export function getStockOpnameJadwalService() {
  stockOpnameJadwalService ??= new StockOpnameJadwalService();
  return stockOpnameJadwalService;
}
