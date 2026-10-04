import { describe, expect, it } from "vitest";

import {
  describeApiError,
  describeTiming,
  formatDate,
  formatMoney,
  isUrgent,
  labelOf,
  STATUS_LABEL,
  toDateInput,
} from "@/app/admin/legal/components/legal-format";
import {
  buildDocumentListUrl,
  countPages,
  EMPTY_DOCUMENT_FILTERS,
} from "@/app/admin/legal/dokumen/document-list-query";

describe("legal-format — waktu tenggat", () => {
  it("menulis waktu relatif hari ini, mendatang, dan lewat", () => {
    expect(describeTiming(0)).toBe("hari ini");
    expect(describeTiming(12)).toBe("dalam 12 hari");
    expect(describeTiming(-3)).toBe("lewat 3 hari");
  });

  it("menandai mendesak bila lewat atau tinggal ≤ 7 hari", () => {
    expect(isUrgent(-1)).toBe(true);
    expect(isUrgent(7)).toBe(true);
    expect(isUrgent(8)).toBe(false);
  });
});

describe("legal-format — pemformat", () => {
  it("memakai label dikenal dan jatuh ke nilai mentah", () => {
    expect(labelOf(STATUS_LABEL, "SEGERA_BERAKHIR")).toBe("Segera berakhir");
    expect(labelOf(STATUS_LABEL, "LAINNYA")).toBe("LAINNYA");
  });

  it("memformat tanggal Indonesia dan strip untuk kosong", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("2026-10-04T00:00:00.000Z")).toMatch(/4 Okt 2026/);
  });

  it("memformat rupiah tanpa desimal nol", () => {
    expect(formatMoney("1500000.00", "IDR").replace(/\s/g, " ")).toBe(
      "Rp 1.500.000",
    );
  });

  it("mengubah ISO menjadi nilai input tanggal", () => {
    expect(toDateInput("2026-12-31T00:00:00.000Z")).toBe("2026-12-31");
    expect(toDateInput(null)).toBe("");
  });

  it("menggabungkan pesan galat dengan detail validasi pertama", () => {
    expect(
      describeApiError(
        { error: "Validasi gagal", details: { endDate: "Wajib" } },
        "Gagal",
      ),
    ).toBe("Validasi gagal: Wajib");
    expect(describeApiError({}, "Gagal menyimpan")).toBe("Gagal menyimpan");
  });
});

describe("document-list-query", () => {
  it("hanya mengirim filter terisi beserta halaman dan batas", () => {
    const url = buildDocumentListUrl(
      { ...EMPTY_DOCUMENT_FILTERS, status: "KEDALUWARSA", search: "  tower " },
      2,
    );

    expect(url).toBe(
      "/api/admin/legal/documents?status=KEDALUWARSA&search=tower&page=2&limit=20",
    );
  });

  it("menghitung jumlah halaman minimal satu", () => {
    expect(countPages(0, 20)).toBe(1);
    expect(countPages(41, 20)).toBe(3);
  });
});
