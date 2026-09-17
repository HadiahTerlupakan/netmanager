import { describe, expect, it } from "vitest";

import { buildExpenseCsvContent } from "@/app/admin/pengeluaran/expense-csv";

describe("expense csv", () => {
  it("keeps header and row column counts aligned and includes petugas", () => {
    const csv = buildExpenseCsvContent([
      {
        date: "2026-01-01T00:00:00.000Z",
        amount: "250000",
        category: "OPEX",
        expenseCategoryName: "Maintenance",
        rabText: "RAB A",
        description: "Perbaikan kabel",
        siteName: "Site A",
        petugas: "Budi",
      },
    ]);

    const [header, row] = csv.split("\n");
    expect(header.split(",").length).toBe(row.split(",").length);
    expect(row).toContain("Budi");
  });

  it("escapes formulas and quotes in text fields", () => {
    const csv = buildExpenseCsvContent([
      {
        date: "2026-01-01T00:00:00.000Z",
        amount: "1",
        category: '=HYPERLINK("bad")',
        expenseCategoryName: '"Quoted"',
        rabText: "RAB",
        description: "@danger",
        siteName: "Site",
        petugas: "+cmd",
      },
    ]);

    expect(csv).toContain("'=");
    expect(csv).toContain('""Quoted""');
    expect(csv).toContain("'@danger");
    expect(csv).toContain("'+cmd");
  });
});
