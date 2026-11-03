import { describe, expect, it } from "vitest";

import {
  evaluateCompliance,
  isEligibleForCommissionAt,
  isPartnershipActive,
  type PksContractSnapshot,
  requiresStatusReason,
  summarizePks,
} from "@/modules/reseller/domain/reseller-compliance";

const END = new Date("2027-01-31T00:00:00.000Z");

function contract(
  overrides: Partial<PksContractSnapshot> = {},
): PksContractSnapshot {
  return {
    documentId: "doc-1",
    startDate: null,
    endDate: END,
    daysLeft: 120,
    hasStarted: true,
    ...overrides,
  };
}

const COMPLETE_LICENSE = {
  nib: "1234567890123",
  kbliCode: "61994",
  standardCertificateNumber: "SS-001",
  licenseVerifiedAt: new Date("2026-11-01T00:00:00.000Z"),
};

describe("summarizePks", () => {
  it("NONE bila reseller tidak punya kontrak", () => {
    expect(summarizePks([])).toEqual({
      status: "NONE",
      documentId: null,
      startDate: null,
      endDate: null,
      daysLeft: null,
    });
  });

  it("ACTIVE bila masih lebih dari 30 hari", () => {
    expect(summarizePks([contract({ daysLeft: 31 })]).status).toBe("ACTIVE");
  });

  it("EXPIRING mulai 30 hari sebelum berakhir, termasuk hari terakhir", () => {
    expect(summarizePks([contract({ daysLeft: 30 })]).status).toBe("EXPIRING");
    expect(summarizePks([contract({ daysLeft: 0 })]).status).toBe("EXPIRING");
  });

  it("ACTIVE tanpa tanggal akhir", () => {
    const summary = summarizePks([contract({ endDate: null, daysLeft: null })]);
    expect(summary).toMatchObject({ status: "ACTIVE", daysLeft: null });
  });

  it("EXPIRED bila hanya ada kontrak yang sudah lewat", () => {
    const summary = summarizePks([
      contract({ documentId: "old", daysLeft: -40 }),
      contract({ documentId: "recent", daysLeft: -2 }),
    ]);
    expect(summary).toMatchObject({ status: "EXPIRED", documentId: "recent" });
  });

  it("PKS yang belum mulai berstatus PENDING, bukan NONE", () => {
    const start = new Date("2026-12-01T00:00:00.000Z");
    const summary = summarizePks([
      contract({ hasStarted: false, startDate: start }),
    ]);
    expect(summary).toMatchObject({ status: "PENDING", startDate: start });
  });

  it("PENDING memilih PKS yang paling dekat mulainya", () => {
    const summary = summarizePks([
      contract({
        documentId: "later",
        hasStarted: false,
        startDate: new Date("2027-03-01T00:00:00.000Z"),
      }),
      contract({
        documentId: "sooner",
        hasStarted: false,
        startDate: new Date("2026-12-01T00:00:00.000Z"),
      }),
    ]);
    expect(summary.documentId).toBe("sooner");
  });

  it("PKS berlaku mengalahkan pengganti yang belum mulai", () => {
    const summary = summarizePks([
      contract({ documentId: "current", daysLeft: 400 }),
      contract({ documentId: "renewal", hasStarted: false }),
    ]);
    expect(summary).toMatchObject({ status: "ACTIVE", documentId: "current" });
  });

  it("PKS belum mulai mengalahkan PKS lama yang kedaluwarsa", () => {
    const summary = summarizePks([
      contract({ documentId: "old", daysLeft: -3 }),
      contract({ documentId: "renewal", hasStarted: false }),
    ]);
    expect(summary.status).toBe("PENDING");
  });

  it("memilih kontrak berlaku dengan masa berlaku terpanjang", () => {
    const summary = summarizePks([
      contract({ documentId: "short", daysLeft: 10 }),
      contract({ documentId: "long", daysLeft: 200 }),
      contract({ documentId: "expired", daysLeft: -1 }),
    ]);
    expect(summary).toMatchObject({ status: "ACTIVE", documentId: "long" });
  });

  it("kontrak tanpa tanggal akhir mengalahkan yang bertanggal", () => {
    const summary = summarizePks([
      contract({ documentId: "dated", daysLeft: 500 }),
      contract({ documentId: "open", endDate: null, daysLeft: null }),
    ]);
    expect(summary.documentId).toBe("open");
  });
});

describe("evaluateCompliance", () => {
  it("patuh bila izin lengkap, terverifikasi, dan PKS berlaku", () => {
    const result = evaluateCompliance(
      COMPLETE_LICENSE,
      summarizePks([contract()]),
    );
    expect(result).toMatchObject({ isCompliant: true, issues: [] });
  });

  it("PKS segera berakhir masih patuh", () => {
    const result = evaluateCompliance(
      COMPLETE_LICENSE,
      summarizePks([contract({ daysLeft: 5 })]),
    );
    expect(result.isCompliant).toBe(true);
  });

  it("mendaftar setiap kekurangan", () => {
    const result = evaluateCompliance(
      {
        nib: null,
        kbliCode: null,
        standardCertificateNumber: null,
        licenseVerifiedAt: null,
      },
      summarizePks([]),
    );
    expect(result.isCompliant).toBe(false);
    expect(result.issues).toEqual([
      "NIB_MISSING",
      "KBLI_MISSING",
      "CERTIFICATE_MISSING",
      "LICENSE_NOT_VERIFIED",
      "PKS_MISSING",
    ]);
  });

  it("PKS yang belum mulai membuat reseller tidak patuh dengan pesan akurat", () => {
    const result = evaluateCompliance(
      COMPLETE_LICENSE,
      summarizePks([contract({ hasStarted: false })]),
    );
    expect(result).toMatchObject({
      isCompliant: false,
      issues: ["PKS_NOT_STARTED"],
    });
  });

  it("PKS kedaluwarsa membuat reseller tidak patuh", () => {
    const result = evaluateCompliance(
      COMPLETE_LICENSE,
      summarizePks([contract({ daysLeft: -1 })]),
    );
    expect(result.issues).toEqual(["PKS_EXPIRED"]);
  });
});

describe("status kemitraan", () => {
  it("hanya ACTIVE yang aktif", () => {
    expect(isPartnershipActive("ACTIVE")).toBe(true);
    expect(isPartnershipActive("INACTIVE")).toBe(false);
    expect(isPartnershipActive("SUSPENDED")).toBe(false);
    expect(isPartnershipActive("TERMINATED")).toBe(false);
  });

  it("SUSPENDED dan TERMINATED wajib beralasan", () => {
    expect(requiresStatusReason("SUSPENDED")).toBe(true);
    expect(requiresStatusReason("TERMINATED")).toBe(true);
    expect(requiresStatusReason("ACTIVE")).toBe(false);
    expect(requiresStatusReason("INACTIVE")).toBe(false);
  });

  it("keluar dari TERMINATED wajib beralasan", () => {
    expect(requiresStatusReason("ACTIVE", "TERMINATED")).toBe(true);
    expect(requiresStatusReason("INACTIVE", "TERMINATED")).toBe(true);
    expect(requiresStatusReason("TERMINATED", "TERMINATED")).toBe(true);
    expect(requiresStatusReason("ACTIVE", "SUSPENDED")).toBe(false);
    expect(requiresStatusReason("ACTIVE", "INACTIVE")).toBe(false);
  });
});

describe("isEligibleForCommissionAt", () => {
  const CHANGED_AT = new Date("2026-11-02T03:00:00.000Z");

  it("ACTIVE selalu berhak", () => {
    expect(isEligibleForCommissionAt("ACTIVE", null, new Date())).toBe(true);
  });

  it("pembayaran sebelum status berubah tetap berhak", () => {
    const paidBefore = new Date("2026-11-01T00:00:00.000Z");
    for (const status of ["INACTIVE", "SUSPENDED", "TERMINATED"] as const) {
      expect(isEligibleForCommissionAt(status, CHANGED_AT, paidBefore)).toBe(
        true,
      );
    }
  });

  it("pembayaran sejak status berubah tidak berhak", () => {
    expect(isEligibleForCommissionAt("SUSPENDED", CHANGED_AT, CHANGED_AT)).toBe(
      false,
    );
    expect(
      isEligibleForCommissionAt(
        "TERMINATED",
        CHANGED_AT,
        new Date("2026-11-03T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("non-ACTIVE tanpa jejak waktu perubahan tidak berhak", () => {
    expect(isEligibleForCommissionAt("INACTIVE", null, new Date(0))).toBe(
      false,
    );
  });
});
