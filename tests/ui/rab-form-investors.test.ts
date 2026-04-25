import { describe, expect, it } from "vitest";

import { normalizeInvestorListResponse } from "@/app/admin/integrations/mixradius/expenses/RABForm";

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
