import { describe, expect, it } from "vitest";
import { buildEligibleBillingQuery } from "@/modules/pelanggan/repositories/pelanggan-repository-automation.helpers";

const range = {
  dueDateStart: new Date(2026, 8, 8, 0, 0, 0, 0),
  dueDateEnd: new Date(2026, 8, 15, 23, 59, 59, 999),
  batchSize: 100,
  offset: 0,
};

describe("buildEligibleBillingQuery", () => {
  // Regresi: query lama memakai EXTRACT(DAY FROM jatuhTempo) = targetDay,
  // tanpa batas bulan/tahun. Pelanggan dengan jatuh tempo bulan atau tahun
  // lain dengan tanggal sama ikut cocok dan ditagih dengan periode salah.
  it("tidak lagi mencocokkan hanya tanggal-dalam-bulan", () => {
    const query = buildEligibleBillingQuery(range);

    expect(query.sql).not.toContain("EXTRACT(DAY");
  });

  it("membatasi jatuh tempo dengan rentang tanggal", () => {
    const query = buildEligibleBillingQuery(range);
    const normalized = query.sql.replace(/\s+/g, " ");

    expect(normalized).toContain('p."jatuhTempo" >=');
    expect(normalized).toContain('p."jatuhTempo" <=');
  });

  it("meneruskan batas rentang sebagai parameter query", () => {
    const query = buildEligibleBillingQuery(range);

    expect(query.values).toContain(range.dueDateStart);
    expect(query.values).toContain(range.dueDateEnd);
  });

  it("tetap membatasi status pelanggan yang layak ditagih", () => {
    const query = buildEligibleBillingQuery(range);
    const normalized = query.sql.replace(/\s+/g, " ");

    expect(normalized).toContain("AKTIF");
    expect(normalized).toContain("ISOLIR");
  });

  it("tetap paginasi dengan limit dan offset", () => {
    const query = buildEligibleBillingQuery(range);

    expect(query.values).toContain(range.batchSize);
    expect(query.values).toContain(range.offset);
  });
});
