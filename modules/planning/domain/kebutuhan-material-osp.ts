import { calculateHaversineDistance } from "@/lib/geo-utils";

/**
 * Kebutuhan material sebuah Planning OSP, dihitung dari titik dan jalur di
 * peta. Murni: tanpa Prisma, tanpa I/O.
 *
 * Angka di sini menjadi dasar anggaran yang naik ke persetujuan berjenjang,
 * jadi dibuat semudah mungkin diuji dan tidak memuat asumsi tersembunyi.
 */

export interface TitikRencana {
  type: string;
  splitter: string | null;
}

export interface KoordinatRencana {
  latitude: number | null;
  longitude: number | null;
}

export interface JalurRencana {
  fiberType: string | null;
  distance: number | null;
  sumber: KoordinatRencana;
  tujuan: KoordinatRencana;
  waypoints: Array<[number, number]>;
}

export interface KebutuhanMaterialOsp {
  kabel: Array<{
    jenisFiber: string;
    meterTerukur: number;
    meterDipesan: number;
  }>;
  splitter: Array<{ rasio: string; jumlah: number }>;
  jumlahTitik: { odp: number; odc: number };
  spareKabelPersen: number;
}

const JENIS_FIBER_TAK_DIKENAL = "lainnya";
const CADANGAN_PERSEN_MAKSIMAL = 100;
const PERSEN_PENUH = 100;
const SKALA_PEMBULATAN_METER = 10;
const TIPE_TITIK_ODP = "odp";
const TIPE_TITIK_ODC = "odc";

/** Membulatkan meter ke 0,1 agar angka bisa dipesan ke pemasok. */
function bulatkanSepersepuluh(nilai: number): number {
  return Math.round(nilai * SKALA_PEMBULATAN_METER) / SKALA_PEMBULATAN_METER;
}

/** Menghitung panjang polyline sumber -> waypoints -> tujuan dalam meter. */
function hitungPanjangPolyline(jalur: JalurRencana): number | null {
  const { sumber, tujuan } = jalur;
  if (
    sumber.latitude === null ||
    sumber.longitude === null ||
    tujuan.latitude === null ||
    tujuan.longitude === null
  ) {
    return null;
  }

  const titik: Array<[number, number]> = [
    [sumber.latitude, sumber.longitude],
    ...jalur.waypoints,
    [tujuan.latitude, tujuan.longitude],
  ];

  let total = 0;
  for (let i = 0; i < titik.length - 1; i += 1) {
    total += calculateHaversineDistance(
      titik[i][0],
      titik[i][1],
      titik[i + 1][0],
      titik[i + 1][1],
    );
  }
  return total;
}

/** Panjang satu jalur dalam meter: `distance` bila ada, kalau tidak dihitung dari koordinat. */
function panjangJalur(jalur: JalurRencana): number | null {
  if (jalur.distance !== null) {
    return jalur.distance;
  }
  return hitungPanjangPolyline(jalur);
}

/** Memastikan persentase cadangan berada di rentang 0 sampai 100. */
function pastikanCadanganSah(spareKabelPersen: number): void {
  if (
    Number.isNaN(spareKabelPersen) ||
    spareKabelPersen < 0 ||
    spareKabelPersen > CADANGAN_PERSEN_MAKSIMAL
  ) {
    throw new Error("Cadangan kabel harus antara 0 dan 100 persen");
  }
}

/** Menjumlahkan meter terukur per jenis fiber; jalur tanpa panjang dilewati. */
function jumlahkanMeterPerJenis(jalur: JalurRencana[]): Map<string, number> {
  const meterPerJenis = new Map<string, number>();
  for (const satuJalur of jalur) {
    const panjang = panjangJalur(satuJalur);
    if (panjang === null) {
      continue;
    }
    const jenis = satuJalur.fiberType ?? JENIS_FIBER_TAK_DIKENAL;
    meterPerJenis.set(jenis, (meterPerJenis.get(jenis) ?? 0) + panjang);
  }
  return meterPerJenis;
}

/** Menyusun daftar kabel; cadangan diterapkan sekali pada total per jenis. */
function susunDaftarKabel(
  meterPerJenis: Map<string, number>,
  spareKabelPersen: number,
): KebutuhanMaterialOsp["kabel"] {
  const pengali = 1 + spareKabelPersen / PERSEN_PENUH;
  return [...meterPerJenis.entries()].map(([jenisFiber, meter]) => {
    const meterTerukur = bulatkanSepersepuluh(meter);
    return {
      jenisFiber,
      meterTerukur,
      meterDipesan: bulatkanSepersepuluh(meterTerukur * pengali),
    };
  });
}

/** Menghitung jumlah ODP/ODC dan splitter per rasio; titik tanpa rasio tidak dihitung ke splitter. */
function hitungSplitterDanTitik(
  titik: TitikRencana[],
): Pick<KebutuhanMaterialOsp, "splitter" | "jumlahTitik"> {
  const jumlahPerRasio = new Map<string, number>();
  const jumlahTitik = { odp: 0, odc: 0 };

  for (const satuTitik of titik) {
    if (satuTitik.type === TIPE_TITIK_ODP) {
      jumlahTitik.odp += 1;
    }
    if (satuTitik.type === TIPE_TITIK_ODC) {
      jumlahTitik.odc += 1;
    }
    if (!satuTitik.splitter) {
      continue;
    }
    jumlahPerRasio.set(
      satuTitik.splitter,
      (jumlahPerRasio.get(satuTitik.splitter) ?? 0) + 1,
    );
  }

  return {
    splitter: [...jumlahPerRasio.entries()].map(([rasio, jumlah]) => ({
      rasio,
      jumlah,
    })),
    jumlahTitik,
  };
}

/** Hitung kebutuhan kabel dan splitter dari titik & jalur rencana. */
export function hitungKebutuhanMaterialOsp(
  titik: TitikRencana[],
  jalur: JalurRencana[],
  spareKabelPersen: number,
): KebutuhanMaterialOsp {
  pastikanCadanganSah(spareKabelPersen);

  const meterPerJenis = jumlahkanMeterPerJenis(jalur);

  return {
    kabel: susunDaftarKabel(meterPerJenis, spareKabelPersen),
    ...hitungSplitterDanTitik(titik),
    spareKabelPersen,
  };
}
