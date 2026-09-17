import { describe, expect, it } from "vitest";

import {
  normalizeInvestorListResponse,
  shouldShowOpexBufferSafety,
} from "@/app/admin/pengeluaran/RABForm/utils/rabFormHelpers";

describe("shouldShowOpexBufferSafety", () => {
  it("hides safety margin for full funding modes", () => {
    expect(shouldShowOpexBufferSafety("INVESTOR")).toBe(false);
    expect(shouldShowOpexBufferSafety("COMPANY")).toBe(false);
  });

  it("shows safety margin for partial funding modes", () => {
    expect(shouldShowOpexBufferSafety("SHARED_PERCENTAGE")).toBe(true);
    expect(shouldShowOpexBufferSafety("FIXED")).toBe(true);
  });
});

describe("normalizeInvestorListResponse", () => {
  it("reads investors from apiSuccess wrapped responses", () => {
    const investors = normalizeInvestorListResponse({
      success: true,
      data: [
        { id: "investor-1", namaLengkap: "Investor Satu" },
        { id: "investor-2", namaLengkap: "Investor Dua" },
      ],
    });

    expect(investors).toEqual([
      { id: "investor-1", namaLengkap: "Investor Satu" },
      { id: "investor-2", namaLengkap: "Investor Dua" },
    ]);
  });

  it("keeps malformed investor payloads from reaching map rendering", () => {
    const investors = normalizeInvestorListResponse({
      success: true,
      data: [
        { id: "investor-1", namaLengkap: "Investor Satu" },
        { id: "investor-2" },
        "invalid-investor",
      ],
    });

    expect(investors).toEqual([
      { id: "investor-1", namaLengkap: "Investor Satu" },
    ]);
  });
});
