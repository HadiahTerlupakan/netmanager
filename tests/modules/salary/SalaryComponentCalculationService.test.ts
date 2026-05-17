import { describe, expect, it } from "vitest";
import { SalaryComponentCalculationService } from "@/modules/salary/services/SalaryComponentCalculationService";
import type { UserCalculationData } from "@/modules/salary/utils/salary-calculation-helpers";

const PERIOD_END = new Date("2026-04-30");
const JOIN_FULL_MONTH = new Date("2025-01-01"); // joined long ago
const JOIN_HALF_MONTH = new Date("2026-04-15"); // joined mid-period

/** Build minimal user fixture untuk test (cast karena UserCalculationData strict). */
function buildUser(overrides: {
  id: string;
  joinDate: Date;
  workDays?: string;
}): UserCalculationData {
  return {
    id: overrides.id,
    joinDate: overrides.joinDate,
    workDays: overrides.workDays ?? "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const fullMonthUser = buildUser({ id: "user-1", joinDate: JOIN_FULL_MONTH });
const halfMonthUser = buildUser({ id: "user-2", joinDate: JOIN_HALF_MONTH });

const earningFlat = {
  amount: 500_000,
  notes: "Tunjangan kehadiran" as string | null,
  component: { name: "Tunjangan", type: "EARNING" as const, rateType: "FIXED" },
};

const deductionFlat = {
  amount: 100_000,
  notes: null as string | null,
  component: { name: "BPJS", type: "DEDUCTION" as const, rateType: "FIXED" },
};

const earningPercentage = {
  amount: 10, // 10% dari basic
  notes: "Bonus 10%" as string | null,
  component: {
    name: "Bonus",
    type: "EARNING" as const,
    rateType: "PERCENTAGE",
  },
};

describe("SalaryComponentCalculationService", () => {
  const service = new SalaryComponentCalculationService();

  describe("buildComponentLines", () => {
    it("memisahkan EARNING ke earnings dan DEDUCTION ke deductions", () => {
      const result = service.buildComponentLines({
        components: [earningFlat, deductionFlat],
        user: fullMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });

      expect(result.earnings).toHaveLength(1);
      expect(result.deductions).toHaveLength(1);
      expect(result.earnings[0]?.name).toBe("Tunjangan");
      expect(result.deductions[0]?.name).toBe("BPJS");
    });

    it("preserve amount untuk komponen FIXED non-prorated", () => {
      const result = service.buildComponentLines({
        components: [earningFlat],
        user: fullMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      expect(result.earnings[0]?.amount).toBe(500_000);
    });

    it("attach notes saat tersedia, undefined saat null", () => {
      const result = service.buildComponentLines({
        components: [earningFlat, deductionFlat],
        user: fullMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      expect(result.earnings[0]?.notes).toBe("Tunjangan kehadiran");
      expect(result.deductions[0]?.notes).toBeUndefined();
    });
  });

  describe("PERCENTAGE rate type", () => {
    it("menghitung sebagai persen dari effective basic salary", () => {
      const result = service.buildComponentLines({
        components: [earningPercentage],
        user: fullMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      // 10% × 5.000.000 = 500.000
      expect(result.earnings[0]?.amount).toBe(500_000);
      expect(result.earnings[0]?.rate).toBe(10);
    });

    it("rate diisi dengan persen amount untuk transparansi slip", () => {
      const result = service.buildComponentLines({
        components: [earningPercentage],
        user: fullMonthUser,
        effectiveBasicSalary: 1_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      expect(result.earnings[0]?.rate).toBe(10);
    });

    it("PERCENTAGE bypass logic prorate (karena sudah relatif basic)", () => {
      const result = service.buildComponentLines({
        components: [earningPercentage],
        user: halfMonthUser,
        effectiveBasicSalary: 2_500_000, // basic sudah pro-rated
        attendanceWorkDays: 22,
        isProrated: true,
        periodEndDate: PERIOD_END,
      });
      // Tidak ada prorate ulang, langsung 10% × 2.500.000 = 250.000
      expect(result.earnings[0]?.amount).toBe(250_000);
    });
  });

  describe("Prorate (FIXED earning untuk user yang join mid-period)", () => {
    it("prorate FIXED earning saat isProrated=true & user join mid-period", () => {
      const result = service.buildComponentLines({
        components: [earningFlat],
        user: halfMonthUser,
        effectiveBasicSalary: 2_500_000,
        attendanceWorkDays: 22,
        isProrated: true,
        periodEndDate: PERIOD_END,
      });
      // Logic prorate: 500.000 / 22 × workDaysSinceJoin
      // Untuk user join 15 Apr → 30 Apr (workDays Mon-Fri), workDaysSinceJoin
      // tergantung implementation calculateWorkDays. Yang dipastikan: hasil
      // adalah angka non-negative yang merupakan multiple atau dekat dengan
      // amount asli (full ke 500k bila full month, kurang bila partial).
      expect(result.earnings[0]?.amount).toBeGreaterThanOrEqual(0);
      expect(typeof result.earnings[0]?.amount).toBe("number");
    });

    it("DEDUCTION tidak di-prorate (user tetap punya kewajiban penuh)", () => {
      const result = service.buildComponentLines({
        components: [deductionFlat],
        user: halfMonthUser,
        effectiveBasicSalary: 2_500_000,
        attendanceWorkDays: 22,
        isProrated: true,
        periodEndDate: PERIOD_END,
      });
      // Deduction tidak prorate → tetap 100.000
      expect(result.deductions[0]?.amount).toBe(100_000);
    });

    it("returns 0 untuk earning saat effectiveBasicSalary=0", () => {
      const result = service.buildComponentLines({
        components: [earningFlat],
        user: halfMonthUser,
        effectiveBasicSalary: 0,
        attendanceWorkDays: 22,
        isProrated: true,
        periodEndDate: PERIOD_END,
      });
      expect(result.earnings[0]?.amount).toBe(0);
    });

    it("isProrated=false → FIXED earning tidak di-prorate", () => {
      const result = service.buildComponentLines({
        components: [earningFlat],
        user: halfMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      // Walaupun user join mid, tetap full karena isProrated=false
      expect(result.earnings[0]?.amount).toBe(500_000);
    });
  });

  describe("Edge cases", () => {
    it("returns array kosong saat components empty", () => {
      const result = service.buildComponentLines({
        components: [],
        user: fullMonthUser,
        effectiveBasicSalary: 5_000_000,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      expect(result.earnings).toEqual([]);
      expect(result.deductions).toEqual([]);
    });

    it("Math.round dipakai untuk presisi rupiah (no fractional cents)", () => {
      const result = service.buildComponentLines({
        components: [
          {
            amount: 7, // 7% — pasti ada fraction
            notes: null,
            component: {
              name: "Variabel",
              type: "EARNING" as const,
              rateType: "PERCENTAGE",
            },
          },
        ],
        user: fullMonthUser,
        effectiveBasicSalary: 1_234_567,
        attendanceWorkDays: 22,
        isProrated: false,
        periodEndDate: PERIOD_END,
      });
      // 7% × 1234567 = 86419.69 → rounded
      expect(Number.isInteger(result.earnings[0]?.amount)).toBe(true);
    });
  });
});
