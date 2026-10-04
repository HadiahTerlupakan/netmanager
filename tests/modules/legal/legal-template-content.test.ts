import { describe, expect, it } from "vitest";
import { DEFAULT_LEGAL_TEMPLATES } from "@/modules/legal/domain/default-templates";
import {
  EMPTY_PLACEHOLDER_MARK,
  TEMPLATE_PLACEHOLDERS,
  fillPlaceholders,
  fillTemplateBlocks,
  parseInlineBold,
  type TemplateBlock,
} from "@/modules/legal/domain/template-content";
import { buildTemplateValues, formatRupiah } from "@/modules/legal/domain/template-values";
import { templateContentSchema } from "@/modules/legal/validators/legal-template.validator";

describe("isian template", () => {
  it("mengganti {{kunci}} dan menoleransi spasi di dalam kurung", () => {
    expect(fillPlaceholders("Nomor {{ nomor }} untuk {{pihak.nama}}", {
      nomor: "PKS/01",
      "pihak.nama": "CV Maju",
    })).toBe("Nomor PKS/01 untuk CV Maju");
  });

  it("isian kosong atau tak dikenal tercetak sebagai titik-titik untuk dilengkapi", () => {
    expect(fillPlaceholders("{{nilai}} / {{tidak_ada}} / {{nomor}}", { nomor: "  " })).toBe(
      [EMPTY_PLACEHOLDER_MARK, EMPTY_PLACEHOLDER_MARK, EMPTY_PLACEHOLDER_MARK].join(" / "),
    );
  });

  it("mengisi semua teks di setiap jenis blok", () => {
    const blocks: TemplateBlock[] = [
      { type: "heading", text: "{{judul}}" },
      { type: "article", title: "Nilai", text: "Sebesar {{nilai}}" },
      { type: "list", items: ["{{pihak.nama}}"] },
      {
        type: "signatures",
        left: { label: "PIHAK PERTAMA", name: "{{perusahaan.nama}}" },
        right: { label: "PIHAK KEDUA", name: "{{pihak.nama}}" },
      },
    ];

    const filled = fillTemplateBlocks(blocks, {
      judul: "PKS",
      nilai: "Rp 1.000",
      "pihak.nama": "CV Maju",
      "perusahaan.nama": "PT Net",
    });

    expect(filled).toEqual([
      { type: "heading", text: "PKS" },
      { type: "article", title: "Nilai", text: "Sebesar Rp 1.000" },
      { type: "list", items: ["CV Maju"] },
      {
        type: "signatures",
        left: { label: "PIHAK PERTAMA", name: "PT Net" },
        right: { label: "PIHAK KEDUA", name: "CV Maju" },
      },
    ]);
  });

  it("memecah **tebal** menjadi segmen", () => {
    expect(parseInlineBold("disebut **PIHAK KEDUA**.")).toEqual([
      { text: "disebut ", isBold: false },
      { text: "PIHAK KEDUA", isBold: true },
      { text: ".", isBold: false },
    ]);
  });
});

describe("nilai isian dari data dokumen", () => {
  it("memformat tanggal Indonesia (WIB) dan rupiah", () => {
    const values = buildTemplateValues({
      title: "PKS Reseller",
      startDate: new Date("2026-10-31T17:30:00Z"), // 1 Nov 2026 WIB
      value: "15000000",
      company: { name: "PT Net", address: "Cianjur", phone: null },
      party: { name: "CV Maju", address: null, phone: "0812" },
      today: new Date("2026-10-04T03:00:00Z"),
    });

    expect(values).toMatchObject({
      judul: "PKS Reseller",
      tanggal: "4 Oktober 2026",
      tanggal_mulai: "1 November 2026",
      nilai: "Rp 15.000.000",
      "perusahaan.nama": "PT Net",
      "pihak.telepon": "0812",
    });
    expect(values.tanggal_berakhir).toBeUndefined();
    expect(values["pihak.alamat"]).toBeUndefined();
  });

  it("nilai bukan angka diabaikan, desimal dipertahankan", () => {
    expect(formatRupiah("abc")).toBeUndefined();
    expect(formatRupiah("1500.5")).toBe("Rp 1.500,5");
  });
});

describe("template bawaan", () => {
  const knownKeys = new Set<string>(TEMPLATE_PLACEHOLDERS.map((placeholder) => placeholder.key));

  it.each(DEFAULT_LEGAL_TEMPLATES.map((template) => [template.name, template]))(
    "%s lolos validasi isi dan hanya memakai isian yang dikenal",
    (_name, template) => {
      expect(templateContentSchema.safeParse(template.content).success).toBe(true);

      const usedKeys = [...JSON.stringify(template.content).matchAll(/\{\{\s*([a-z_.]+)\s*\}\}/g)]
        .map((match) => match[1]);
      expect(usedKeys.filter((key) => !knownKeys.has(key))).toEqual([]);
    },
  );
});

describe("validasi isi template", () => {
  it("menolak jenis blok yang tidak dikenal dan isi kosong", () => {
    expect(templateContentSchema.safeParse([{ type: "image", src: "x" }]).success).toBe(false);
    expect(templateContentSchema.safeParse([]).success).toBe(false);
  });

  it("menolak daftar tanpa butir", () => {
    expect(templateContentSchema.safeParse([{ type: "list", items: [] }]).success).toBe(false);
  });
});
