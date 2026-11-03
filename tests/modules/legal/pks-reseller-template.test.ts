import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGAL_TEMPLATES,
  PKS_RESELLER_TEMPLATE_NAME,
} from "@/modules/legal/domain/default-templates";
import {
  fillTemplateBlocks,
  type TemplateBlock,
} from "@/modules/legal/domain/template-content";
import { LegalTemplateRenderer } from "@/modules/legal/services/LegalTemplateRenderer";
import { templateContentSchema } from "@/modules/legal/validators/legal-template.validator";

const pksReseller = DEFAULT_LEGAL_TEMPLATES.find(
  (template) => template.name === PKS_RESELLER_TEMPLATE_NAME,
);

function articleTitles(blocks: TemplateBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "article" ? [block.title] : [],
  );
}

function articleText(blocks: TemplateBlock[], title: string): string {
  const article = blocks.find(
    (block) => block.type === "article" && block.title === title,
  );
  return article?.type === "article" ? article.text : "";
}

function allText(blocks: TemplateBlock[]): string {
  return JSON.stringify(blocks);
}

describe("template bawaan PKS Reseller (model agen)", () => {
  const content = pksReseller?.content ?? [];

  it("tersedia sebagai template KONTRAK", () => {
    expect(pksReseller?.documentType).toBe("KONTRAK");
  });

  it("memuat semua pasal wajib PM 5/2021 Pasal 223 ayat (2) dan pasal pendukung", () => {
    expect(articleTitles(content)).toEqual(
      expect.arrayContaining([
        "Perizinan PIHAK KEDUA",
        "Merek Dagang",
        "Standar Kualitas Layanan",
        "Pendapatan dan Penagihan",
        "Komisi",
        "Alamat IP dan ASN",
        "Keberlangsungan Layanan",
        "Perlindungan Konsumen dan Penanganan Keluhan",
        "Data Pribadi Pelanggan",
        "Larangan Sub-Reseller",
        "Sanksi dan Pengakhiran",
        "Penyelesaian Perselisihan",
      ]),
    );
  });

  it("pendapatan dibukukan ISP dan tagihan diterbitkan atas merek ISP", () => {
    const revenue = articleText(content, "Pendapatan dan Penagihan");
    expect(revenue).toContain(
      "menjadi pendapatan dari dan dibukukan oleh PIHAK PERTAMA",
    );
    expect(revenue).toContain("mencantumkan merek dagang PIHAK PERTAMA");
    expect(revenue).toContain("dilarang menerbitkan tagihan sendiri");
  });

  it("merek ISP wajib, co-branding opsional", () => {
    const brand = articleText(content, "Merek Dagang");
    expect(brand).toContain("merek dagang PIHAK PERTAMA");
    expect(brand).toContain("co-branding");
  });

  it("IP publik dan ASN milik ISP, reseller dilarang memakai miliknya sendiri", () => {
    const ip = articleText(content, "Alamat IP dan ASN");
    expect(ip).toContain(
      "IP publik dan Autonomous System Number (ASN) milik PIHAK PERTAMA",
    );
    expect(ip).toContain(
      "dilarang memakai alamat IP publik atau ASN milik sendiri",
    );
  });

  it("komisi dihitung dari DPP tanpa PPN dan atas tagihan yang lunas", () => {
    const commission = articleText(content, "Komisi");
    expect(commission).toContain("tagihan Pelanggan yang telah lunas");
    expect(commission).toContain(
      "sebelum Pajak Pertambahan Nilai (Dasar Pengenaan Pajak)",
    );
  });

  it("ISP menjamin keberlangsungan layanan saat kerja sama dihentikan", () => {
    expect(articleText(content, "Keberlangsungan Layanan")).toContain(
      "menjamin keberlangsungan layanan kepada seluruh Pelanggan",
    );
  });

  it("izin reseller dicabut memberi hak pengakhiran", () => {
    expect(articleText(content, "Perizinan PIHAK KEDUA")).toContain(
      "Sertifikat Standar",
    );
    expect(articleText(content, "Sanksi dan Pengakhiran")).toContain(
      "perizinan PIHAK KEDUA dicabut",
    );
  });

  it("menyebut dasar hukum dan catatan wajib tinjau konsultan hukum", () => {
    const text = allText(content);
    for (const law of [
      "Undang-Undang Nomor 36 Tahun 1999",
      "Undang-Undang Nomor 6 Tahun 2023",
      "Peraturan Pemerintah Nomor 46 Tahun 2021",
      "Peraturan Menteri Komunikasi dan Informatika Nomor 5 Tahun 2021",
      "Peraturan Menteri Komunikasi dan Digital Nomor 15 Tahun 2025",
      "Undang-Undang Nomor 27 Tahun 2022",
    ]) {
      expect(text).toContain(law);
    }
    expect(text).toContain("Wajib ditinjau konsultan hukum");
  });

  it("sub-reseller dilarang mutlak; outlet terdaftar bagian dari PIHAK KEDUA", () => {
    const clause = articleText(content, "Larangan Sub-Reseller");
    expect(clause).toContain("(sub-reseller), tanpa pengecualian");
    expect(clause).toMatch(/\(2\) PIHAK KEDUA dilarang mengalihkan hak/);
    expect(clause).toContain("bukan sub-reseller");
    expect(clause).toContain(
      "bertanggung jawab penuh atas tindakan gerai/outlet",
    );
  });

  it("disediakan juga untuk tenant lama yang belum memilikinya", () => {
    expect(pksReseller?.isSeededForExistingTenants).toBe(true);
  });

  it.each(
    DEFAULT_LEGAL_TEMPLATES.map(
      (template) => [template.name, template.content] as const,
    ),
  )(
    "template bawaan %s lolos validasi editor (templateContentSchema)",
    (_name, templateContent) => {
      expect(templateContentSchema.safeParse(templateContent).success).toBe(
        true,
      );
    },
  );

  it("tidak lagi memakai model grosir (reseller membukukan pendapatan sendiri)", () => {
    expect(allText(content)).not.toMatch(
      /PIHAK KEDUA (membukukan|menagih Pelanggan atas)/,
    );
  });

  it("hanya memakai karakter yang dapat dicetak font PDF standar", async () => {
    const output = await PDFDocument.create();
    const font = await output.embedFont(StandardFonts.Helvetica);
    const supported = new Set(font.getCharacterSet());
    const unsupported = Array.from(allText(content)).filter(
      (char) => !supported.has(char.codePointAt(0)!),
    );

    expect(unsupported).toEqual([]);
  });

  it("terisi dan tercetak menjadi PDF berhalaman banyak", async () => {
    const filled = fillTemplateBlocks(content, {
      "perusahaan.nama": "PT RadPro Net",
      "pihak.nama": "CV Maju",
    });

    const pdf = await new LegalTemplateRenderer().render(filled, {
      companyName: "PT RadPro Net",
      address: "Cianjur",
      phone: "0812",
      email: "legal@radpro.id",
      logo: null,
    });

    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(1);
  });
});
