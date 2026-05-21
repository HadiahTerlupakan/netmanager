import { describe, it, expect } from "vitest";
import { Money } from "@/modules/salary-v2/core/domain/value-objects/Money";
import { Period } from "@/modules/salary-v2/core/domain/value-objects/Period";
import {
  PtkpStatus,
  PTKP_CATEGORIES,
} from "@/modules/salary-v2/core/domain/value-objects/PtkpStatus";

describe("Value Objects", () => {
  describe("Money", () => {
    it("should create money with amount", () => {
      const money = Money.of(5000000);
      expect(money.amount).toBe(5000000);
    });

    it("should add two money values", () => {
      const a = Money.of(3000000);
      const b = Money.of(2000000);
      expect(a.add(b).amount).toBe(5000000);
    });

    it("should subtract money values", () => {
      const a = Money.of(5000000);
      const b = Money.of(2000000);
      expect(a.subtract(b).amount).toBe(3000000);
    });

    it("should multiply by factor", () => {
      const money = Money.of(1000000);
      expect(money.multiply(1.5).amount).toBe(1500000);
    });

    it("should round to nearest integer (floor)", () => {
      const money = Money.of(1000000);
      const result = money.multiply(0.333);
      expect(result.amount).toBe(333000);
    });

    it("should compare money values", () => {
      const a = Money.of(5000000);
      const b = Money.of(3000000);
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isGreaterThan(a)).toBe(false);
      expect(a.isZero()).toBe(false);
      expect(Money.of(0).isZero()).toBe(true);
    });

    it("should cap at maximum", () => {
      const money = Money.of(15000000);
      const capped = money.capAt(12000000);
      expect(capped.amount).toBe(12000000);
    });

    it("should not cap if below maximum", () => {
      const money = Money.of(8000000);
      const capped = money.capAt(12000000);
      expect(capped.amount).toBe(8000000);
    });

    it("should create zero money", () => {
      expect(Money.zero().amount).toBe(0);
    });
  });

  describe("Period", () => {
    it("should create period with start and end dates", () => {
      const start = new Date("2026-04-26");
      const end = new Date("2026-05-25");
      const period = Period.of(start, end);
      expect(period.start).toEqual(start);
      expect(period.end).toEqual(end);
    });

    it("should calculate total days", () => {
      const period = Period.of(new Date("2026-05-01"), new Date("2026-05-31"));
      expect(period.totalDays).toBe(31);
    });

    it("should check if date is within period", () => {
      const period = Period.of(new Date("2026-05-01"), new Date("2026-05-31"));
      expect(period.contains(new Date("2026-05-15"))).toBe(true);
      expect(period.contains(new Date("2026-06-01"))).toBe(false);
    });

    it("should throw if start is after end", () => {
      expect(() =>
        Period.of(new Date("2026-05-31"), new Date("2026-05-01")),
      ).toThrow();
    });

    it("should calculate overlap days with another period", () => {
      const a = Period.of(new Date("2026-05-01"), new Date("2026-05-31"));
      const b = Period.of(new Date("2026-05-15"), new Date("2026-06-15"));
      expect(a.overlapDays(b)).toBe(17);
    });
  });

  describe("PtkpStatus", () => {
    it("should have all PTKP categories", () => {
      expect(PTKP_CATEGORIES).toContain("TK_0");
      expect(PTKP_CATEGORIES).toContain("TK_1");
      expect(PTKP_CATEGORIES).toContain("TK_2");
      expect(PTKP_CATEGORIES).toContain("TK_3");
      expect(PTKP_CATEGORIES).toContain("K_0");
      expect(PTKP_CATEGORIES).toContain("K_1");
      expect(PTKP_CATEGORIES).toContain("K_2");
      expect(PTKP_CATEGORIES).toContain("K_3");
    });

    it("should create valid PtkpStatus", () => {
      const status = PtkpStatus.of("TK_0");
      expect(status.value).toBe("TK_0");
      expect(status.isMarried()).toBe(false);
      expect(status.dependents).toBe(0);
    });

    it("should identify married status", () => {
      const status = PtkpStatus.of("K_2");
      expect(status.isMarried()).toBe(true);
      expect(status.dependents).toBe(2);
    });

    it("should throw for invalid PTKP status", () => {
      expect(() => PtkpStatus.of("INVALID")).toThrow();
    });
  });
});
