import { createRouteServiceError } from "@/lib/api/route-service-error";

import {
  PelangganSalesRepository,
  type BarisPelangganTunggakan,
  type SaringanSales,
} from "../repositories/PelangganSalesRepository";

const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;
/** Batas daftar tunggakan di aplikasi; tunggakan lebih banyak dilihat di web admin. */
export const BATAS_TUNGGAKAN = 500;
const MS_SEHARI = 24 * 60 * 60 * 1000;

/** Satu pelanggan isolir pada daftar tunggakan mobile. */
export interface PelangganTunggakanDTO {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  paket: string | null;
  alamat: string | null;
  noTelp: string | null;
  jatuhTempo: string;
  hariLewat: number;
  siteName: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Kelompok tunggakan satu sales (`salesId` null = belum punya penanggung jawab). */
export interface KelompokTunggakan {
  salesId: string | null;
  namaSales: string;
  pelanggan: PelangganTunggakanDTO[];
}

export interface RingkasanTunggakan {
  total: number;
  kelompok: KelompokTunggakan[];
}

const NAMA_TANPA_SALES = "Belum ada sales";

function hariLewat(jatuhTempo: Date, sekarang: Date): number {
  return Math.max(0, Math.floor((sekarang.getTime() - jatuhTempo.getTime()) / MS_SEHARI));
}

function keDto(baris: BarisPelangganTunggakan, sekarang: Date): PelangganTunggakanDTO {
  return {
    id: baris.id,
    idPelanggan: baris.idPelanggan,
    nama: baris.nama,
    username: baris.username,
    paket: baris.hargaPaket?.name ?? null,
    alamat: baris.alamat,
    noTelp: baris.noTelp,
    jatuhTempo: baris.jatuhTempo.toISOString(),
    hariLewat: hariLewat(baris.jatuhTempo, sekarang),
    siteName: baris.site?.name ?? null,
    latitude: baris.latitude,
    longitude: baris.longitude,
  };
}

/** Kelompokkan per sales; kelompok terbanyak dulu, "Belum ada sales" paling akhir. */
export function kelompokkanPerSales(
  baris: BarisPelangganTunggakan[],
  sekarang: Date,
): KelompokTunggakan[] {
  const peta = new Map<string, KelompokTunggakan>();
  for (const item of baris) {
    const kunci = item.salesId ?? "";
    const kelompok = peta.get(kunci) ?? {
      salesId: item.salesId,
      namaSales: item.sales?.name || NAMA_TANPA_SALES,
      pelanggan: [],
    };
    kelompok.pelanggan.push(keDto(item, sekarang));
    peta.set(kunci, kelompok);
  }
  return [...peta.values()].sort((a, b) => {
    if ((a.salesId === null) !== (b.salesId === null)) return a.salesId === null ? 1 : -1;
    return b.pelanggan.length - a.pelanggan.length || a.namaSales.localeCompare(b.namaSales);
  });
}

/**
 * Sales penanggung jawab pelanggan: pilihan sales, penetapan dari admin, dan
 * daftar pelanggan isolir yang perlu ditindaklanjuti pembayarannya.
 */
export class PelangganSalesService {
  constructor(private readonly repository = new PelangganSalesRepository()) {}

  /** Sales aktif yang bisa dipilih sebagai penanggung jawab. */
  daftarSalesPilihan(tenantId: string) {
    return this.repository.daftarSalesAktif(tenantId);
  }

  /** Sales penanggung jawab pelanggan saat ini (null bila belum ditetapkan). */
  async salesPelanggan(tenantId: string, pelangganId: string) {
    const pelanggan = await this.repository.cariPelanggan(tenantId, pelangganId);
    if (!pelanggan) throw createRouteServiceError("Pelanggan tidak ditemukan", HTTP_NOT_FOUND);
    return { salesId: pelanggan.salesId, sales: pelanggan.sales };
  }

  /** Tolak sales yang bukan sales aktif tenant ini (422). */
  async pastikanSalesAktif(tenantId: string, salesId: string) {
    if (!(await this.repository.cariSalesAktif(tenantId, salesId))) {
      throw createRouteServiceError("Sales tidak ditemukan atau tidak aktif", HTTP_UNPROCESSABLE);
    }
  }

  /** Tetapkan (atau lepas dengan null) sales penanggung jawab pelanggan. */
  async tetapkanSales(tenantId: string, pelangganId: string, salesId: string | null) {
    const pelanggan = await this.repository.cariPelanggan(tenantId, pelangganId);
    if (!pelanggan) throw createRouteServiceError("Pelanggan tidak ditemukan", HTTP_NOT_FOUND);
    if (salesId) await this.pastikanSalesAktif(tenantId, salesId);
    return this.repository.tetapkanSales(pelangganId, salesId);
  }

  /**
   * Pelanggan isolir untuk ditindaklanjuti, dikelompokkan per sales.
   * @param saringan sales yang boleh dilihat pemanggil; null = seluruh tenant.
   */
  async daftarTunggakan(tenantId: string, saringan: SaringanSales, sekarang = new Date()): Promise<RingkasanTunggakan> {
    if (saringan && saringan.salesIds.length === 0) return { total: 0, kelompok: [] };
    const baris = (await this.repository.daftarIsolir(tenantId, saringan)).slice(0, BATAS_TUNGGAKAN);
    return { total: baris.length, kelompok: kelompokkanPerSales(baris, sekarang) };
  }
}

let pelangganSalesService: PelangganSalesService | null = null;

/** Singleton service sales penanggung jawab pelanggan. */
export function getPelangganSalesService() {
  pelangganSalesService ??= new PelangganSalesService();
  return pelangganSalesService;
}
