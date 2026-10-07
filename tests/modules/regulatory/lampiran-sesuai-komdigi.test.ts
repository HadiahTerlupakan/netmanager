import ExcelJS from "exceljs";
import path from "path";
import { describe, expect, it } from "vitest";

import { buildSelfAssessmentLampiran } from "@/modules/regulatory";
import type { LicenseScheme } from "@/modules/regulatory";

/**
 * Lampiran dibangun dari berkas Lampiran resmi Komdigi dan hanya baris
 * sampelnya yang diisi. Yang dijaga di sini: judul bagian dan judul kolom hasil
 * akhir tetap sama persis dengan templatenya.
 *
 * Redaksi kolom Komdigi spesifik sampai ke salah ketiknya sendiri
 * ("peyelesaian", "dd/mm/yyy"). Menyeragamkannya terasa seperti perbaikan,
 * padahal justru membuat lampiran tidak lagi sama dengan yang diminta.
 */

const TEMPLATE = {
  JARTAPLOK_PS: "lampiran-jartaplok-ps.xlsx",
  ISP: "lampiran-isp.xlsx",
} as const;

interface Struktur {
  judul: string[];
  header: string[];
  barisTabel: Map<string, string[][]>;
}

async function struktur(sumber: string | Buffer): Promise<Struktur> {
  const workbook = new ExcelJS.Workbook();
  if (typeof sumber === "string") await workbook.xlsx.readFile(sumber);
  else await workbook.xlsx.load(sumber as never);

  const sheet = workbook.worksheets[0];
  const judul: string[] = [];
  const header: string[] = [];
  const barisTabel = new Map<string, string[][]>();
  let tabelAktif: string | null = null;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const sel = (row.values as unknown[])
      .slice(1)
      .map((v) => (v == null ? "" : String(v).replace(/ /g, " ").trim()));
    const isi = sel.filter(Boolean);
    if (isi.length === 0) return;

    if (sel[0] === "No" && sel[1]) {
      header.push(isi.join("|"));
      tabelAktif = sel[1];
      barisTabel.set(tabelAktif, barisTabel.get(tabelAktif) ?? []);
      return;
    }
    if (isi.length === 1 && !/^[\d.]+$/.test(isi[0]) && isi[0] !== "..") {
      judul.push(isi[0]);
      tabelAktif = null;
      return;
    }
    if (tabelAktif) barisTabel.get(tabelAktif)!.push(isi);
  });

  return { judul, header, barisTabel };
}

const sampel = (jumlah: number) =>
  Array.from({ length: jumlah }, (_, i) => ({
    reference: `WO-${String(i + 1).padStart(3, "0")}`,
    submittedAt: new Date(2025, 2, i + 1, 9, 0, 0),
    startedAt: new Date(2025, 2, i + 1, 10, 0, 0),
    finishedAt: new Date(2025, 2, i + 3, 14, 30, 0),
    durationDays: 2,
    outcome: "MET" as const,
    siteName: "HQ",
    region: "Bandung",
  }));

const laporan = (keys: string[], jumlahSampel = 3) => ({
  year: 2025,
  parameters: keys.map((key) => ({
    parameter: {
      key,
      number: 1,
      title: key,
      basis: "x",
      maxDays: 7,
      dayUnit: "CALENDAR" as const,
      targetRatio: 0.9,
      standardLabel: "x",
      columns: {
        reference: "",
        firstTime: { header: "", field: "submittedAt" as const },
        secondTime: {
          header: "",
          field:
            key === "PASANG_BARU"
              ? ("startedAt" as const)
              : ("finishedAt" as const),
        },
        duration: "",
        isMet: "",
        note: "",
      },
    },
    samples: sampel(jumlahSampel),
    monthly: [] as never[],
    quarterly: [] as never[],
    annual: { total: jumlahSampel, met: jumlahSampel, ratio: 1 },
    regions: [] as never[],
  })),
  warnings: {
    sitesWithoutRegion: [] as string[],
    lastHolidayDate: null as string | null,
  },
  notes: [] as string[],
});

const buat = (skema: LicenseScheme, keys: string[]) =>
  buildSelfAssessmentLampiran(laporan(keys) as never, skema);

describe.each([
  ["JARTAPLOK_PS", ["PASANG_BARU", "PEMULIHAN_LAYANAN"]],
  ["ISP", ["PASANG_BARU"]],
] as const)("Lampiran %s sama dengan berkas resmi", (skema, keys) => {
  const berkasTemplate = path.join(
    process.cwd(),
    "modules",
    "regulatory",
    "templates",
    TEMPLATE[skema],
  );

  it("judul bagian tidak berubah", async () => {
    const asli = await struktur(berkasTemplate);
    const hasil = await struktur(await buat(skema, [...keys]));

    expect(hasil.judul).toEqual(asli.judul);
  });

  it("judul kolom tidak berubah, termasuk redaksi aslinya", async () => {
    const asli = await struktur(berkasTemplate);
    const hasil = await struktur(await buat(skema, [...keys]));

    expect(hasil.header).toEqual(asli.header);
  });
});

describe("pengisian baris sampel", () => {
  it("mengisi tabel pasang baru dengan data laporan", async () => {
    const hasil = await struktur(await buat("JARTAPLOK_PS", ["PASANG_BARU"]));
    const baris = [...hasil.barisTabel.entries()].find(([judul]) =>
      judul.toLowerCase().startsWith("daftar pemohon pasang baru"),
    )?.[1];

    expect(baris?.slice(0, 3).map((b) => b[1])).toEqual([
      "WO-001",
      "WO-002",
      "WO-003",
    ]);
  });

  // Kolom keempat berbeda antar-parameter; menyamakannya melaporkan waktu yang salah.
  it("pasang baru memakai waktu persetujuan, pemulihan memakai waktu penyelesaian", async () => {
    const hasil = await struktur(
      await buat("JARTAPLOK_PS", ["PASANG_BARU", "PEMULIHAN_LAYANAN"]),
    );
    const ambil = (awalan: string) =>
      [...hasil.barisTabel.entries()].find(([judul]) =>
        judul.toLowerCase().startsWith(awalan),
      )?.[1];

    expect(ambil("daftar pemohon pasang baru")?.[0][3]).toBe(
      "01/03/2025 10:00:00",
    );
    expect(ambil("daftar pemohon pemulihan layanan")?.[0][3]).toBe(
      "03/03/2025 14:30:00",
    );
  });

  // Data pengukuran jaringan berasal dari uji lapangan, bukan operasional;
  // baris contoh Komdigi dibiarkan agar jelas harus diisi manual.
  it("tabel pengukuran jaringan dibiarkan apa adanya", async () => {
    const asli = await struktur(
      path.join(
        process.cwd(),
        "modules",
        "regulatory",
        "templates",
        TEMPLATE.JARTAPLOK_PS,
      ),
    );
    const hasil = await struktur(await buat("JARTAPLOK_PS", ["PASANG_BARU"]));

    const judulJaringan = "Sampel Packet Loss (Drop Rate)";
    expect(hasil.barisTabel.get(judulJaringan)).toEqual(
      asli.barisTabel.get(judulJaringan),
    );
  });
});
