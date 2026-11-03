import { describe, expect, it } from "vitest";
import { startOfWibDay } from "@/modules/reseller/domain/wib-day";

describe("startOfWibDay", () => {
  it("pagi WIB → 00:00 WIB hari yang sama", () => {
    expect(startOfWibDay(new Date("2026-11-03T00:00:00.000Z"))).toEqual(
      new Date("2026-11-02T17:00:00.000Z"),
    );
  });

  it("malam UTC yang sudah lewat tengah malam WIB → hari WIB berikutnya", () => {
    expect(startOfWibDay(new Date("2026-11-03T18:30:00.000Z"))).toEqual(
      new Date("2026-11-03T17:00:00.000Z"),
    );
  });

  it("tepat 00:00 WIB tidak bergeser", () => {
    const midnight = new Date("2026-11-02T17:00:00.000Z");
    expect(startOfWibDay(midnight)).toEqual(midnight);
  });
});
