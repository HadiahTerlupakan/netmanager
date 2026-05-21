import { describe, it, expect } from "vitest";
import { PayrollExportService } from "@/modules/salary/reporting/export/PayrollExportService";

describe("PayrollExportService", () => {
  const service = new PayrollExportService();

  const sampleEntries = [
    {
      employeeName: "Budi Santoso",
      employeeId: "EMP-001",
      department: "Engineering",
      basicSalary: 5_000_000,
      totalEarnings: 6_000_000,
      totalDeductions: 200_000,
      totalTax: 150_000,
      netSalary: 5_650_000,
      employerCost: 400_000,
    },
    {
      employeeName: "Siti Rahayu",
      employeeId: "EMP-002",
      department: "Marketing",
      basicSalary: 4_500_000,
      totalEarnings: 5_500_000,
      totalDeductions: 180_000,
      totalTax: 120_000,
      netSalary: 5_200_000,
      employerCost: 350_000,
    },
    {
      employeeName: "Ahmad Fauzi",
      employeeId: "EMP-003",
      department: "Engineering",
      basicSalary: 7_000_000,
      totalEarnings: 8_500_000,
      totalDeductions: 350_000,
      totalTax: 300_000,
      netSalary: 7_850_000,
      employerCost: 600_000,
    },
  ];

  describe("generateSummary", () => {
    it("should map all entries to rows", () => {
      const result = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: sampleEntries,
      });

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].employeeName).toBe("Budi Santoso");
      expect(result.rows[1].employeeName).toBe("Siti Rahayu");
      expect(result.rows[2].employeeName).toBe("Ahmad Fauzi");
    });

    it("should calculate correct totals", () => {
      const result = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: sampleEntries,
      });

      expect(result.totals.totalBasicSalary).toBe(16_500_000);
      expect(result.totals.totalEarnings).toBe(20_000_000);
      expect(result.totals.totalDeductions).toBe(730_000);
      expect(result.totals.totalTax).toBe(570_000);
      expect(result.totals.totalNetSalary).toBe(18_700_000);
      expect(result.totals.totalEmployerCost).toBe(1_350_000);
      expect(result.totals.employeeCount).toBe(3);
    });

    it("should set period label", () => {
      const result = service.generateSummary({
        periodLabel: "Juni 2026",
        entries: sampleEntries,
      });

      expect(result.periodLabel).toBe("Juni 2026");
    });

    it("should set generatedAt timestamp", () => {
      const before = new Date();
      const result = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: sampleEntries,
      });
      const after = new Date();

      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(result.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should handle empty entries", () => {
      const result = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: [],
      });

      expect(result.rows).toHaveLength(0);
      expect(result.totals.employeeCount).toBe(0);
      expect(result.totals.totalBasicSalary).toBe(0);
      expect(result.totals.totalNetSalary).toBe(0);
    });

    it("should handle single entry", () => {
      const result = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: [sampleEntries[0]],
      });

      expect(result.totals.employeeCount).toBe(1);
      expect(result.totals.totalBasicSalary).toBe(5_000_000);
      expect(result.totals.totalNetSalary).toBe(5_650_000);
    });
  });

  describe("toCsvRows", () => {
    it("should include header as first row", () => {
      const data = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: sampleEntries,
      });
      const csv = service.toCsvRows(data);

      expect(csv[0]).toBe(
        "Nama,ID,Department,Gaji Pokok,Total Pendapatan,Total Potongan,Pajak,Gaji Bersih,Biaya Perusahaan",
      );
    });

    it("should have correct number of rows (header + data)", () => {
      const data = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: sampleEntries,
      });
      const csv = service.toCsvRows(data);

      expect(csv).toHaveLength(4); // 1 header + 3 data rows
    });

    it("should format data rows correctly", () => {
      const data = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: [sampleEntries[0]],
      });
      const csv = service.toCsvRows(data);

      expect(csv[1]).toBe(
        "Budi Santoso,EMP-001,Engineering,5000000,6000000,200000,150000,5650000,400000",
      );
    });

    it("should handle empty data", () => {
      const data = service.generateSummary({
        periodLabel: "Mei 2026",
        entries: [],
      });
      const csv = service.toCsvRows(data);

      expect(csv).toHaveLength(1); // header only
    });
  });
});
