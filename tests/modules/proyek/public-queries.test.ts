import { describe, expect, it } from "vitest";

import * as proyekPublicQueries from "@/modules/proyek/public-queries";

describe("pintu publik module proyek", () => {
  it("menyediakan lima query yang dipakai module investor", () => {
    expect(typeof proyekPublicQueries.findRabInvestmentSummaries).toBe(
      "function",
    );
    expect(typeof proyekPublicQueries.findRabInvestmentList).toBe("function");
    expect(typeof proyekPublicQueries.findRabInvestmentDetail).toBe("function");
    expect(typeof proyekPublicQueries.findRabInvestmentsWithSite).toBe(
      "function",
    );
    expect(typeof proyekPublicQueries.findRabProjectsForProfitShare).toBe(
      "function",
    );
  });
});
