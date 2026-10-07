import path from "path";
import ExcelJS from "exceljs";

import type { LicenseScheme } from "../domain/license-schemes";
import type {
  ParameterReport,
  SelfAssessmentReport,
} from "../domain/self-assessment-report";

/**
 * Lampiran I Self-Assessment, dibangun dari berkas Lampiran resmi Komdigi.
 *
 * Berkas resminya dipakai apa adanya sebagai template dan hanya baris sampelnya
 * yang diisi — judul bagian, judul kolom, dan tata letaknya tidak disentuh.
 * Menyusun ulang sendiri berisiko ditolak: redaksi kolomnya spesifik sampai ke
 * salah ketik milik Komdigi ("peyelesaian", "dd/mm/yyy"), dan menyeragamkannya
 * justru membuat lampiran tidak lagi sama dengan yang diminta.
 *
 * Tabel pengukuran jaringan (packet loss, latency, POP, download/upload)
 * dibiarkan kosong: datanya dari uji lapangan, bukan dari operasional.
 */

const DIREKTORI = path.join(
  process.cwd(),
  "modules",
  "regulatory",
  "templates",
);

const BERKAS_LAMPIRAN: Record<LicenseScheme, string> = {
  JARTAPLOK_PS: "lampiran-jartaplok-ps.xlsx",
  ISP: "lampiran-isp.xlsx",
};

/**
 * Baris contoh pada template ("1", "2", "..", "100") yang digantikan data nyata.
 * Dikenali dari kolom pertama, bukan dari nomor baris, supaya tetap benar bila
 * Komdigi menggeser tata letaknya.
 */
function isBarisContoh(nilai: unknown): boolean {
  const teks = String(nilai ?? "").trim();
  return teks === ".." || teks === "…" || /^\d+(\.0)?$/.test(teks);
}

/** Judul kolom kedua tiap tabel sampel, dipakai menemukan tabelnya di template. */
const JUDUL_TABEL: Record<string, string[]> = {
  PASANG_BARU: ["daftar pemohon pasang baru"],
  PEMULIHAN_LAYANAN: ["daftar pemohon pemulihan layanan"],
};

function cocok(teks: string, kunci: string[]): boolean {
  const rapi = teks.toLowerCase().replace(/\s+/g, " ").trim();
  return kunci.some((k) => rapi.startsWith(k));
}

/** Cari baris header tabel sampel satu parameter; -1 bila tidak ada di template. */
function cariHeader(sheet: ExcelJS.Worksheet, kunci: string[]): number {
  for (let nomor = 1; nomor <= sheet.rowCount; nomor += 1) {
    const baris = sheet.getRow(nomor);
    const kolomPertama = String(baris.getCell(1).value ?? "").trim();
    if (kolomPertama !== "No") continue;
    if (cocok(String(baris.getCell(2).value ?? ""), kunci)) return nomor;
  }
  return -1;
}

/**
 * Baris contoh yang mengikuti sebuah header, sebagai rentang [awal, jumlah].
 *
 * Header pada Lampiran resmi memakai sel ter-merge vertikal, sehingga baris di
 * bawahnya ikut berisi "No". Baris seperti itu dan baris kosong dilewati dulu;
 * tanpa itu pemindaian berhenti di lanjutan header dan tabelnya tak pernah
 * terisi.
 */
function rentangContoh(
  sheet: ExcelJS.Worksheet,
  header: number,
): [number, number] {
  const kolomPertama = (nomor: number) =>
    String(sheet.getRow(nomor).getCell(1).value ?? "").trim();

  let awal = header + 1;
  while (awal <= sheet.rowCount && !isBarisContoh(kolomPertama(awal))) {
    const teks = kolomPertama(awal);
    const lanjutanHeader = teks === "" || teks === "No";
    if (!lanjutanHeader) return [awal, 0];
    awal += 1;
  }

  let jumlah = 0;
  while (isBarisContoh(kolomPertama(awal + jumlah))) jumlah += 1;
  return [awal, jumlah];
}

/** Isi satu tabel sampel dengan data laporan. */
function isiTabel(
  sheet: ExcelJS.Worksheet,
  header: number,
  baris: (string | number)[][],
): void {
  const [awal, jumlah] = rentangContoh(sheet, header);
  if (jumlah === 0) return;

  // Tanpa data, baris contoh dibuang agar lampiran tidak terbaca berisi "1, 2, .., 100".
  sheet.spliceRows(awal, jumlah, ...(baris.length > 0 ? baris : [[]]));
}

const WAKTU_KOSONG = "-";

function formatWaktu(nilai: Date | null | undefined): string {
  if (!nilai) return WAKTU_KOSONG;
  const dua = (angka: number) => String(angka).padStart(2, "0");
  return (
    `${dua(nilai.getDate())}/${dua(nilai.getMonth() + 1)}/${nilai.getFullYear()} ` +
    `${dua(nilai.getHours())}:${dua(nilai.getMinutes())}:${dua(nilai.getSeconds())}`
  );
}

/**
 * Baris sampel satu parameter, mengikuti lima kolom Lampiran resmi.
 *
 * Kolom keempat berbeda antar-parameter — pasang baru memakai waktu
 * persetujuan, pemulihan memakai waktu penyelesaian. Pemetaannya diambil dari
 * `columns.secondTime.field`, definisi yang sama dengan yang dipakai dokumen,
 * bukan ditebak ulang di sini.
 */
function barisSampel(parameter: ParameterReport): (string | number)[][] {
  const kolomKedua = parameter.parameter.columns.secondTime.field;

  return parameter.samples.map((sample, urutan) => [
    urutan + 1,
    sample.reference,
    formatWaktu(sample.submittedAt),
    formatWaktu(sample[kolomKedua]),
    sample.durationDays ?? WAKTU_KOSONG,
  ]);
}

/**
 * Berkas Lampiran I terisi untuk satu laporan.
 *
 * Parameter yang tabelnya tidak ada di template dilewati, bukan dipaksa masuk:
 * Lampiran ISP memang tidak memuat pemulihan layanan.
 */
export async function buildSelfAssessmentLampiran(
  report: SelfAssessmentReport,
  scheme: LicenseScheme,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(DIREKTORI, BERKAS_LAMPIRAN[scheme]));

  const sheet = workbook.worksheets[0];
  for (const parameter of report.parameters) {
    const kunci = JUDUL_TABEL[parameter.parameter.key];
    if (!kunci) continue;

    const header = cariHeader(sheet, kunci);
    if (header === -1) continue;

    isiTabel(sheet, header, barisSampel(parameter));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
