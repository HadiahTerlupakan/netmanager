import { describe, expect, it } from "vitest";

import { buildUserSiteCondition } from "@/modules/overtime/repositories/OvertimeReportRepository";

/**
 * Raw SQL laporan lembur dulu hanya mengenal `u."siteId" = <satu site>`.
 * Lingkup admin multi-site harus menjadi `IN` terparameter, dan daftar kosong
 * harus gagal tertutup (`AND FALSE`), bukan SQL tidak valid atau tanpa filter.
 */
describe("buildUserSiteCondition", () => {
  it("satu site memakai kesetaraan terparameter", () => {
    const condition = buildUserSiteCondition("site-a");

    expect(condition.sql).toBe('AND u."siteId" = ?');
    expect(condition.values).toEqual(["site-a"]);
  });

  it("daftar site memakai IN terparameter", () => {
    const condition = buildUserSiteCondition({ in: ["site-a", "site-b"] });

    expect(condition.sql).toBe('AND u."siteId" IN (?,?)');
    expect(condition.values).toEqual(["site-a", "site-b"]);
  });

  it("daftar kosong gagal tertutup", () => {
    const condition = buildUserSiteCondition({ in: [] });

    expect(condition.sql).toBe("AND FALSE");
    expect(condition.values).toEqual([]);
  });
});
