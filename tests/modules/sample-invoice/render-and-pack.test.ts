import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { generateSampleSet } from "@/modules/sample-invoice/domain/generate-sample-set";
import { createRandom } from "@/modules/sample-invoice/domain/random";
import type {
  SampleGenerateInput,
  SampleInvoice,
} from "@/modules/sample-invoice/domain/types";
import {
  packSampleZip,
  planZipParts,
  zipFileName,
} from "@/modules/sample-invoice/services/pack-sample-zip";
import { renderSamplePdf } from "@/modules/sample-invoice/services/render-sample-pdf";

/** Teks yang dicetak jsPDF: operan string dari operator Tj. */
function pdfText(pdf: Buffer) {
  return [...pdf.toString("latin1").matchAll(/\((.*?)\) Tj/g)]
    .map((match) => match[1])
    .join("\n");
}

const input: SampleGenerateInput = {
  mitraId: "m1",
  mitraName: "Mitra Selawangi",
  issuer: {
    name: "PT Contoh Net",
    address: "Jl. Raya Bogor 1",
    phone: "0251-123",
  },
  packages: [{ name: "Home 20", speed: "20 Mbps", price: 250000 }],
  customerCount: 3,
  fromMonth: "2026-09",
  toMonth: "2026-10",
  center: { lat: -6.5091, lng: 107.1352 },
  radiusM: 2000,
  dueDay: 10,
  payDate: { mode: "random" },
  ppn: "inclusive",
  streets: Array.from({ length: 5 }, (_, i) => ({
    name: `Jalan ${i}`,
    city: "Bogor",
  })),
};
const set = generateSampleSet(input, {
  today: "2026-10-28",
  random: createRandom(7),
});

function invoicesFor(months: string[], perMonth: number): SampleInvoice[] {
  return months.flatMap((month) =>
    Array.from({ length: perMonth }, (_, i) => ({
      ...set.invoices[0],
      month,
      number: `CTH/${month.replace("-", "/")}/${String(i + 1).padStart(4, "0")}`,
    })),
  );
}

describe("planZipParts", () => {
  it("one part when everything fits in one ZIP", () => {
    const parts = planZipParts(
      invoicesFor(["2026-08", "2026-09", "2026-10"], 10),
    );
    expect(parts.map((p) => p.key)).toEqual(["all"]);
    expect(parts[0].invoiceNumbers).toHaveLength(30);
  });

  it("splits per month when the total is above 2000", () => {
    const parts = planZipParts(
      invoicesFor(["2026-08", "2026-09", "2026-10"], 900),
    );
    expect(parts.map((p) => p.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("splits a month that alone is above 2000 into numbered parts", () => {
    const parts = planZipParts(invoicesFor(["2026-10"], 4500));
    expect(parts.map((p) => [p.key, p.invoiceNumbers.length])).toEqual([
      ["2026-10-1", 2000],
      ["2026-10-2", 2000],
      ["2026-10-3", 500],
    ]);
  });
});

describe("renderSamplePdf", () => {
  const render = (ppn: SampleGenerateInput["ppn"]) =>
    pdfText(
      renderSamplePdf({
        issuer: input.issuer,
        customer: set.customers[0],
        pkg: input.packages[0],
        invoice: set.invoices[0],
        ppn,
      }),
    );

  it("always carries the sample marks, status and masked phone", () => {
    const text = render("inclusive");
    expect(text).toContain("BUKAN TAGIHAN ASLI");
    expect(text).toContain("CONTOH");
    expect(text).toContain("LUNAS");
    expect(text).toContain(set.invoices[0].number);
    expect(text).toContain(set.customers[0].phoneMasked);
    expect(text).toContain("PT Contoh Net");
    expect(text).toContain(
      "Dokumen ini dibuat otomatis sebagai contoh format. Nama, alamat, dan transaksi bersifat fiktif.",
    );
    expect(text).toContain("PPN 11%");
  });

  it("names the package once when its name is its speed", () => {
    const text = pdfText(
      renderSamplePdf({
        issuer: input.issuer,
        customer: set.customers[0],
        pkg: { name: "150MB", speed: "150MB", price: 400000 },
        invoice: set.invoices[0],
        ppn: "inclusive",
      }),
    );
    expect(text).toContain("150MB");
    expect(text).not.toContain("150MB - 150MB");
  });

  it("prints each add-on as its own line", () => {
    const text = pdfText(
      renderSamplePdf({
        issuer: input.issuer,
        customer: set.customers[0],
        pkg: {
          name: "Home 20",
          speed: "20 Mbps",
          price: 250000,
          addons: [{ name: "Sewa modem", price: 25000 }],
        },
        invoice: { ...set.invoices[0], dpp: 275000, ppn: 0, total: 275000 },
        ppn: "none",
      }),
    );
    expect(text).toContain("Sewa modem");
    expect(text).toContain("Rp25.000");
    expect(text).toContain("Rp275.000");
  });

  it("prints no PPN line without PPN", () => {
    expect(render("none")).not.toContain("PPN");
  });

  it("prints no coordinates", () => {
    const text = render("inclusive");
    expect(text).not.toMatch(/-?\d+\.\d{4,}/);
    expect(text.toLowerCase()).not.toContain("koordinat");
  });
});

describe("packSampleZip", () => {
  it("one PDF per invoice, grouped per month", () => {
    const [part] = planZipParts(set.invoices);
    const zip = new AdmZip(
      packSampleZip({
        set,
        packages: input.packages,
        issuer: input.issuer,
        ppn: "inclusive",
        part,
      }),
    );
    const names = zip
      .getEntries()
      .map((entry) => entry.entryName)
      .sort();
    expect(names).toHaveLength(6);
    expect(names[0]).toBe("2026-09/CTH-0001.pdf");
    expect(names[5]).toBe("2026-10/CTH-0003.pdf");
  });
});

describe("zipFileName", () => {
  it("names the whole set by mitra and month range", () => {
    expect(
      zipFileName(
        "Mitra Selawangi",
        { key: "all", label: "", invoiceNumbers: [] },
        "2026-05",
        "2026-10",
        true,
      ),
    ).toBe("contoh-invoice-mitra-selawangi-202605-202610.zip");
  });

  it("names a part by its key", () => {
    expect(
      zipFileName(
        "Mitra Selawangi",
        { key: "2026-09", label: "", invoiceNumbers: [] },
        "2026-05",
        "2026-10",
        false,
      ),
    ).toBe("contoh-invoice-mitra-selawangi-2026-09.zip");
  });
});
