import { describe, expect, it } from "vitest";

import {
  calculateEffectiveRabTargetSubscribers,
  calculateRabProjectedRevenue,
  calculateRabUnitCosts,
} from "@/modules/finance";

describe("RAB target basis", () => {
  it("uses target subscribers directly for homeconnect basis", () => {
    const targetSubscribers = calculateEffectiveRabTargetSubscribers({
      targetBasis: "HOMECONNECT",
      targetSubscribers: 120,
      targetHomepass: 300,
      targetTakeUpRatePercent: 40,
    });

    expect(targetSubscribers).toBe(120);
  });

  it("converts homepass target into revenue-producing homeconnect target", () => {
    const targetSubscribers = calculateEffectiveRabTargetSubscribers({
      targetBasis: "HOMEPASS",
      targetSubscribers: 0,
      targetHomepass: 500,
      targetTakeUpRatePercent: 40,
    });

    expect(targetSubscribers).toBe(200);
  });

  it("calculates projected revenue from effective homeconnect target", () => {
    const projectedRevenue = calculateRabProjectedRevenue({
      targetBasis: "HOMEPASS",
      targetSubscribers: 0,
      targetHomepass: 500,
      targetTakeUpRatePercent: 40,
      arpu: 150_000,
    });

    expect(projectedRevenue).toBe(30_000_000);
  });

  it("calculates unit costs for homepass and effective homeconnect target", () => {
    const unitCosts = calculateRabUnitCosts({
      totalCapex: 500_000_000,
      targetHomepass: 1_000,
      targetSubscribers: 400,
    });

    expect(unitCosts.costPerHomepass).toBe(500_000);
    expect(unitCosts.costPerHomeconnectRevenue).toBe(1_250_000);
  });

  it("returns zero unit costs when target denominator is empty", () => {
    const unitCosts = calculateRabUnitCosts({
      totalCapex: 500_000_000,
      targetHomepass: 0,
      targetSubscribers: 0,
    });

    expect(unitCosts.costPerHomepass).toBe(0);
    expect(unitCosts.costPerHomeconnectRevenue).toBe(0);
  });
});
