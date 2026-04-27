import { describe, expect, it } from "vitest";

import { mapDashboardSectionResult } from "@/lib/dashboard/section-result";

describe("mapDashboardSectionResult", () => {
  it("returns ready section for fulfilled result", () => {
    const result = Promise.resolve({ total: 3 });

    return result.then((value) => {
      expect(
        mapDashboardSectionResult(
          { status: "fulfilled", value },
          "Gagal memuat data",
        ),
      ).toEqual({ state: "ready", data: { total: 3 } });
    });
  });

  it("returns error section with original error message", () => {
    expect(
      mapDashboardSectionResult(
        { status: "rejected", reason: new Error("Koneksi gagal") },
        "Gagal memuat data",
      ),
    ).toEqual({
      state: "error",
      data: null,
      message: "Koneksi gagal",
    });
  });

  it("returns fallback message for non-error rejection", () => {
    expect(
      mapDashboardSectionResult(
        { status: "rejected", reason: "unknown" },
        "Gagal memuat data",
      ),
    ).toEqual({
      state: "error",
      data: null,
      message: "Gagal memuat data",
    });
  });
});
