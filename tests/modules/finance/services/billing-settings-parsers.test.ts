import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  createDueDateRange,
  parseBillingWindowDays,
} from "@/modules/finance/services/automatic-billing.helpers";

describe("parseBillingWindowDays", () => {
  it.each([
    ["7", 7],
    ["0", 0],
    ["31", 31],
  ])("menerima setting valid %s", (value, expected) => {
    expect(parseBillingWindowDays(value)).toBe(expected);
  });

  // Regresi: sebelumnya parseInt("abc") -> NaN -> setDate(NaN) -> Invalid Date,
  // yang mematikan seluruh generate invoice harian tanpa satu error pun di log.
  it.each([
    ["abc", "bukan angka"],
    ["", "string kosong"],
    ["-1", "di bawah batas"],
    ["999", "di atas batas"],
  ])("jatuh ke default untuk %s (%s)", (value) => {
    expect(parseBillingWindowDays(value)).toBe(5);
  });

  it.each([[undefined], [null]])("jatuh ke default untuk %s", (value) => {
    expect(parseBillingWindowDays(value)).toBe(5);
  });

  it("tidak pernah mengembalikan NaN", () => {
    expect(Number.isNaN(parseBillingWindowDays("x"))).toBe(false);
  });
});

describe("createDueDateRange", () => {
  it("mencakup milidetik terakhir hari itu", () => {
    const range = createDueDateRange(new Date(2026, 8, 15, 13, 45));

    expect(range.start.getHours()).toBe(0);
    expect(range.start.getMilliseconds()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
    expect(range.end.getSeconds()).toBe(59);
    // Regresi: 23:59:59.000 membuat invoice di sub-detik terakhir lolos dari
    // pengecekan duplikat sehingga pelanggan bisa ditagih dua kali.
    expect(range.end.getMilliseconds()).toBe(999);
  });

  it("menaruh timestamp akhir hari di dalam rentang", () => {
    const endOfDay = new Date(2026, 8, 15, 23, 59, 59, 900);
    const range = createDueDateRange(endOfDay);

    expect(endOfDay >= range.start && endOfDay <= range.end).toBe(true);
  });
});
