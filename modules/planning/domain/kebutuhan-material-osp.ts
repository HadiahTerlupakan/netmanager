import { calculateHaversineDistance } from "@/lib/geo-utils";

/**
 * Kebutuhan material sebuah Planning OSP, dihitung dari titik dan jalur di
 * peta. Murni: tanpa Prisma, tanpa I/O.
 *
 * Angka di sini menjadi dasar anggaran yang naik ke persetujuan berjenjang,
 * jadi dibuat semudah mungkin diuji dan tidak memuat asumsi tersembunyi.
 * Panjang kabel dijumlahkan mentah per jenis fiber dan dibulatkan sekali di
 * akhir, agar galat pembulatan tidak menumpuk per ruas.
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
  /** Jumlah jalur yang panjangnya tidak bisa ditentukan dan tidak ikut dihitung. */
  jalurDiabaikan: number;
  spareKabelPersen: number;
}

interface HasilJumlahKabel {
  meterPerJenis: Map<string, number>;
  jalurDiabaikan: number;
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

/** Distance hanya dipercaya bila angka hingga dan positif; nol bawaan form dianggap tidak ada. */
function isDistanceTersedia(distance: number | null): distance is number {
  return distance !== null && Number.isFinite(distance) && distance > 0;
}

/** Menghitung panjang polyline sumber -> waypoints -> tujuan dalam meter, tanpa pembulatan. */
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

/** Panjang satu jalur dalam meter: `distance` bila valid, kalau tidak dihitung dari koordinat. Null bila tidak bisa ditentukan. */
function panjangJalur(jalur: JalurRencana): number | null {
  if (isDistanceTersedia(jalur.distance)) {
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

/** Menjumlahkan meter mentah per jenis fiber dan mencatat jalur yang diabaikan. */
function jumlahkanKabel(jalur: JalurRencana[]): HasilJumlahKabel {
  const meterPerJenis = new Map<string, number>();
  let jalurDiabaikan = 0;

  for (const satuJalur of jalur) {
    const panjang = panjangJalur(satuJalur);
    if (panjang === null) {
      jalurDiabaikan += 1;
      continue;
    }
    const jenis = satuJalur.fiberType ?? JENIS_FIBER_TAK_DIKENAL;
    meterPerJenis.set(jenis, (meterPerJenis.get(jenis) ?? 0) + panjang);
  }

  return { meterPerJenis, jalurDiabaikan };
}

/**
 * Panjang kabel yang dipesan dari panjang terukur, setelah cadangan.
 *
 * Diekspor karena panel ringkasan material di klien memperlihatkan angka
 * pesanan berubah saat perencana mengubah persentase cadangan, sebelum apa
 * pun ditulis. Angka itu wajib lahir dari aritmetika yang sama dengan yang
 * dipakai saat penerbitan — kalau klien menghitungnya sendiri, layar dan
 * item material bisa berbeda tanpa ada yang menyadarinya.
 */
export function terapkanCadanganKabel(
  meterTerukur: number,
  spareKabelPersen: number,
): number {
  return bulatkanSepersepuluh(
    meterTerukur * (1 + spareKabelPersen / PERSEN_PENUH),
  );
}

/** Menyusun daftar kabel; cadangan diterapkan sekali pada total per jenis. */
function susunDaftarKabel(
  meterPerJenis: Map<string, number>,
  spareKabelPersen: number,
): KebutuhanMaterialOsp["kabel"] {
  return [...meterPerJenis.entries()].map(([jenisFiber, meter]) => {
    const meterTerukur = bulatkanSepersepuluh(meter);
    return {
      jenisFiber,
      meterTerukur,
      meterDipesan: terapkanCadanganKabel(meterTerukur, spareKabelPersen),
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

  const { meterPerJenis, jalurDiabaikan } = jumlahkanKabel(jalur);

  return {
    kabel: susunDaftarKabel(meterPerJenis, spareKabelPersen),
    ...hitungSplitterDanTitik(titik),
    jalurDiabaikan,
    spareKabelPersen,
  };
}
