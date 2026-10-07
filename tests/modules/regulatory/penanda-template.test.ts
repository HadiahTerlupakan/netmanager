import { readFileSync } from "fs";
import path from "path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";

import { catalogOf, LICENSE_SCHEMES, parametersOf } from "@/modules/regulatory";

/**
 * Penanda di katalog harus sama persis dengan yang ada di berkas template.
 *
 * Penanda yang tidak dikenal template akan diam-diam hilang — dokumen tetap
 * terbit, hanya saja kolom capaiannya kosong. Kegagalan seperti itu baru
 * ketahuan setelah laporan dikirim ke regulator, jadi dikunci di sini.
 */

const DIREKTORI = path.join(
  process.cwd(),
  "modules",
  "regulatory",
  "templates",
);

function penandaTemplate(berkas: string): Set<string> {
  const zip = new PizZip(readFileSync(path.join(DIREKTORI, berkas)));
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  // Penanda bisa terpotong beberapa <w:t>; buang tag dulu agar utuh kembali.
  const teks = xml.replace(/<[^>]+>/g, "");
  return new Set([...teks.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
}

/** Penanda di luar parameter: identitas penyelenggara dan tanda tangan. */
const PENANDA_UMUM = [
  "tahun",
  "nama_penyelenggara",
  "jenis_izin",
  "alamat_penyelenggara",
  "nomor_izin",
  "tanggal_izin",
  "link_lampiran_izin",
  "kop_nama",
  "tempat",
  "tanggal_tanda_tangan",
  "nama_direktur",
];

describe.each(LICENSE_SCHEMES)("template %s", (skema) => {
  const berkas = catalogOf(skema).templateFile;

  it("berkas templatenya ada", () => {
    expect(() => penandaTemplate(berkas)).not.toThrow();
  });

  it("memuat seluruh penanda identitas & tanda tangan", () => {
    const ada = penandaTemplate(berkas);
    for (const penanda of PENANDA_UMUM) {
      expect(
        ada.has(penanda),
        `penanda {${penanda}} hilang dari ${berkas}`,
      ).toBe(true);
    }
  });

  it("memuat penanda capaian & link tiap parameter", () => {
    const ada = penandaTemplate(berkas);
    for (const parameter of parametersOf(skema)) {
      expect(
        ada.has(parameter.placeholder),
        `{${parameter.placeholder}} hilang dari ${berkas}`,
      ).toBe(true);
      expect(
        ada.has(`link_${parameter.placeholder}`),
        `{link_${parameter.placeholder}} hilang dari ${berkas}`,
      ).toBe(true);
    }
  });

  it("tidak memuat penanda yang tidak dikenal katalog", () => {
    const ada = penandaTemplate(berkas);
    const dikenal = new Set([
      ...PENANDA_UMUM,
      ...parametersOf(skema).flatMap((p) => [
        p.placeholder,
        `link_${p.placeholder}`,
      ]),
    ]);

    const asing = [...ada].filter((penanda) => !dikenal.has(penanda));
    expect(
      asing,
      `penanda tanpa pasangan di katalog: ${asing.join(", ")}`,
    ).toEqual([]);
  });
});

describe("penanda antar-skema", () => {
  it("unik dalam satu skema", () => {
    for (const skema of LICENSE_SCHEMES) {
      const penanda = parametersOf(skema).map((p) => p.placeholder);
      expect(new Set(penanda).size).toBe(penanda.length);
    }
  });
});
