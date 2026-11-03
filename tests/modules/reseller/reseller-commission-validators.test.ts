import { describe, expect, it } from "vitest";

import {
  createResellerSettlementSchema,
  resellerCommissionSummarySchema,
} from "@/modules/reseller/validators/reseller-commission";

/**
 * Reviewer: `periodEnd` tanggal saja dulu menjadi 00:00 UTC, sehingga komisi
 * yang terbit di hari terakhir periode tidak ikut settlement maupun ringkasan.
 */
describe("reseller commission validators — akhir periode", () => {
  const COMMISSION_ON_LAST_DAY = new Date("2026-10-31T10:00:00.000Z");

  it("memperlakukan periodEnd tanggal saja sebagai akhir hari itu", () => {
    const parsed = createResellerSettlementSchema.parse({
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
    });

    expect(parsed.periodEnd.toISOString()).toBe("2026-10-31T23:59:59.999Z");
    expect(parsed.periodEnd.getTime()).toBeGreaterThan(
      COMMISSION_ON_LAST_DAY.getTime(),
    );
    expect(parsed.periodStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("menerapkan aturan yang sama pada ringkasan komisi", () => {
    const parsed = resellerCommissionSummarySchema.parse({
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
    });

    expect(parsed.periodEnd.toISOString()).toBe("2026-10-31T23:59:59.999Z");
  });

  it("membiarkan periodEnd yang sudah bertanda waktu", () => {
    const parsed = createResellerSettlementSchema.parse({
      periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-10-31T12:00:00.000Z",
    });

    expect(parsed.periodEnd.toISOString()).toBe("2026-10-31T12:00:00.000Z");
  });

  it("menolak periodEnd tanggal saja yang tidak valid", () => {
    const result = createResellerSettlementSchema.safeParse({
      periodStart: "2026-10-01",
      periodEnd: "2026-13-45",
    });

    expect(result.success).toBe(false);
  });

  it("tetap menolak periode satu hari yang terbalik", () => {
    const result = createResellerSettlementSchema.safeParse({
      periodStart: "2026-11-01",
      periodEnd: "2026-10-31",
    });

    expect(result.success).toBe(false);
  });

  it("menerima periode satu hari (awal dan akhir tanggal sama)", () => {
    const result = createResellerSettlementSchema.safeParse({
      periodStart: "2026-10-31",
      periodEnd: "2026-10-31",
    });

    expect(result.success).toBe(true);
  });
});
