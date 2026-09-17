import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RABRevisionSummaryCards from "@/app/admin/pengeluaran/RABRevisionSummaryCards";

describe("RABRevisionSummaryCards", () => {
  it("renders original, final, actual, and variance totals", () => {
    const html = renderToStaticMarkup(
      React.createElement(RABRevisionSummaryCards, {
        summary: {
          original: "100000",
          final: "120000",
          actual: "110000",
          variance: "10000",
          label: "UNTUNG",
        },
      }),
    );

    expect(html).toContain("Budget Awal");
    expect(html).toContain("Revisi Final");
    expect(html).toContain("Realisasi");
    expect(html).toContain("UNTUNG");
  });
});
