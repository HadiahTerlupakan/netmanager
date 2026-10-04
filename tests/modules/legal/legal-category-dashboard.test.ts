import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: async () => ({ tenantId: "tenant-1", isSuperAdmin: false }),
}));

import { DEFAULT_LEGAL_CATEGORIES } from "@/modules/legal/domain/default-categories";
import { LegalCategoryService } from "@/modules/legal/services/LegalCategoryService";
import { LegalDashboardService } from "@/modules/legal/services/LegalDashboardService";
import { buildLegalRepository, legalDocument, wib } from "./legal-fixtures";

const ACCESS = { canViewConfidential: false };
let repository: ReturnType<typeof buildLegalRepository>;

beforeEach(() => {
  repository = buildLegalRepository();
});

describe("LegalCategoryService", () => {
  it("membuat kategori bawaan saat tenant pertama kali membuka modul", async () => {
    repository.countCategories.mockResolvedValue(0);

    await new LegalCategoryService(repository as never).list(ACCESS);

    const created = repository.createCategories.mock.calls[0][0] as Array<{
      name: string;
      tenantId: string;
      isBuiltIn: boolean;
    }>;
    expect(created).toHaveLength(DEFAULT_LEGAL_CATEGORIES.length);
    expect(created.every((item) => item.tenantId === "tenant-1" && item.isBuiltIn)).toBe(true);
  });

  it("tidak membuat ulang bila kategori sudah ada", async () => {
    await new LegalCategoryService(repository as never).list(ACCESS);

    expect(repository.createCategories).not.toHaveBeenCalled();
  });

  it("akta & RUPS bawaan berkategori rahasia", () => {
    const confidential = DEFAULT_LEGAL_CATEGORIES.filter(
      (category) => category.confidentiality === "RAHASIA",
    ).map((category) => category.name);

    expect(confidential).toEqual(["Akta Perusahaan", "Notulen RUPS"]);
  });

  it.each([
    ["tidak ada", null, /tidak ditemukan/],
    ["nonaktif", { documentType: "KONTRAK", isActive: false }, /nonaktif/],
    ["beda jenis", { documentType: "IZIN", isActive: true }, /tidak sesuai/],
  ])("menolak kategori yang %s", async (_label, category, message) => {
    repository.findCategoryById.mockResolvedValue(category);

    await expect(
      new LegalCategoryService(repository as never).assertUsable("cat-1", "KONTRAK", ACCESS),
    ).rejects.toThrow(message);
  });
});

describe("LegalDashboardService", () => {
  const NOW = new Date("2026-10-04T03:00:00.000Z");

  it("menghitung status dan mengurutkan tindakan dari yang paling mendesak", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ id: "lama", title: "Izin tiang", endDate: wib("2026-09-20") }),
      legalDocument({ id: "dekat", title: "Sewa lahan", endDate: wib("2026-10-08") }),
      legalDocument({ id: "jauh", title: "NIB", endDate: wib("2027-08-01") }),
    ]);

    const summary = await new LegalDashboardService(repository as never).summary(ACCESS, NOW);

    expect(summary).toMatchObject({ soonCount: 1, expiredCount: 1, dueThisWeekCount: 1 });
    expect(summary.actionItems.map((item) => item.documentId)).toEqual(["lama", "dekat"]);
    expect(repository.findMonitoredDocuments).toHaveBeenCalledWith(ACCESS);
  });
});
