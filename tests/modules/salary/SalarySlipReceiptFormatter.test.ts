import { describe, expect, it } from "vitest";

import {
  formatSalarySlipReceipt,
  mapSalaryReceiptData,
} from "@/modules/salary/services/SalarySlipReceiptFormatter";

describe("formatSalarySlipReceipt", () => {
  it("formats salary data into receipt text", () => {
    const receipt = formatSalarySlipReceipt(createSalaryReceiptData());

    expect(receipt).toContain("SLIP GAJI");
    expect(receipt).toContain("April 2026");
    expect(receipt).toContain("Nama");
    expect(receipt).toContain("Budi");
    expect(receipt).toContain("PENDAPATAN:");
    expect(receipt).toContain("Gaji Pokok");
    expect(receipt).toContain("POTONGAN:");
    expect(receipt).toContain("Kasbon (1x)");
    expect(receipt).toContain("GAJI BERSIH");
    expect(receipt.replace(/\s/g, "")).toContain("Rp2.750.000");
  });

  it("maps salary service result into receipt data", () => {
    const result = mapSalaryReceiptData(createSalaryReceiptData());

    expect(result).toEqual(createSalaryReceiptData());
  });
});

function createSalaryReceiptData() {
  return {
    month: 4,
    year: 2026,
    user: {
      name: "Budi",
      employeeType: "KARYAWAN",
      departments: { name: "Teknis" },
      sites: { name: "Site Timur" },
    },
    details: [
      { type: "EARNING" as const, name: "Gaji Pokok", amount: 3_000_000 },
      {
        type: "DEDUCTION" as const,
        name: "Kasbon",
        amount: 250_000,
        quantity: 1,
      },
    ],
    totalEarnings: 3_000_000,
    totalDeductions: 250_000,
    netSalary: 2_750_000,
    status: "PAID",
    paidAt: new Date("2026-04-30T00:00:00.000Z"),
  };
}
