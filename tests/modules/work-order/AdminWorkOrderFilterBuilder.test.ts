import { describe, it, expect } from "vitest";

import { AdminWorkOrderFilterBuilder } from "@/modules/work-order/services/AdminWorkOrderFilterBuilder";

function buildFrom(query: Record<string, string>) {
  const builder = new AdminWorkOrderFilterBuilder();
  return builder.buildListFilters(new URLSearchParams(query));
}

describe("AdminWorkOrderFilterBuilder date range", () => {
  it("memetakan dateFrom ke awal hari", () => {
    const filters = buildFrom({ dateFrom: "2026-06-01" });
    const from = filters.dateFrom as Date;
    expect(from).toBeInstanceOf(Date);
    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([
      2026, 5, 1,
    ]);
    expect([
      from.getHours(),
      from.getMinutes(),
      from.getSeconds(),
      from.getMilliseconds(),
    ]).toEqual([0, 0, 0, 0]);
  });

  it("memetakan dateTo ke akhir hari (inklusif)", () => {
    const filters = buildFrom({ dateTo: "2026-06-30" });
    const to = filters.dateTo as Date;
    expect(to).toBeInstanceOf(Date);
    expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([
      2026, 5, 30,
    ]);
    expect([
      to.getHours(),
      to.getMinutes(),
      to.getSeconds(),
      to.getMilliseconds(),
    ]).toEqual([23, 59, 59, 999]);
  });

  it("mengabaikan tanggal yang tidak valid", () => {
    const filters = buildFrom({ dateFrom: "bukan-tanggal", dateTo: "" });
    expect(filters.dateFrom).toBeUndefined();
    expect(filters.dateTo).toBeUndefined();
  });

  it("tidak menambahkan key tanggal saat tidak ada query", () => {
    const filters = buildFrom({ status: "PENDING" });
    expect(filters).not.toHaveProperty("dateFrom");
    expect(filters).not.toHaveProperty("dateTo");
    expect(filters.status).toBe("PENDING");
  });
});
