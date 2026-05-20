import { describe, expect, it } from "vitest";
import { Money } from "@/modules/accounting/domain/value-objects/Money";

describe("Money", () => {
  it("create from number with 2 decimal precision", () => {
    const m = Money.fromNumber(1000.5);
    expect(m.toString()).toBe("1000.50");
  });

  it("add two Money correctly without float drift", () => {
    const a = Money.fromString("0.1");
    const b = Money.fromString("0.2");
    expect(a.add(b).toString()).toBe("0.30");
  });

  it("subtract returns negative when b > a", () => {
    const a = Money.fromString("100");
    const b = Money.fromString("150");
    expect(a.subtract(b).toString()).toBe("-50.00");
  });

  it("equals compares value not reference", () => {
    expect(Money.fromString("10").equals(Money.fromNumber(10))).toBe(true);
  });

  it("isZero returns true for 0.00", () => {
    expect(Money.fromNumber(0).isZero()).toBe(true);
  });

  it("isPositive / isNegative", () => {
    expect(Money.fromString("5").isPositive()).toBe(true);
    expect(Money.fromString("-5").isNegative()).toBe(true);
  });

  it("multiply by scalar", () => {
    expect(Money.fromString("100").multiply(0.1).toString()).toBe("10.00");
  });

  it("zero() factory", () => {
    expect(Money.zero().toString()).toBe("0.00");
  });

  it("rejects non-finite input", () => {
    expect(() => Money.fromNumber(NaN)).toThrow();
    expect(() => Money.fromNumber(Infinity)).toThrow();
  });
});
