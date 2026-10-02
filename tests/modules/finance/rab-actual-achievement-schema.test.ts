import { describe, expect, it } from "vitest";

import { rabActualAchievementSchema } from "@/modules/finance/validators/rabProjectSchemas";

const isianDasar = { month: 1, actualSubscribers: 10, actualRevenue: 1_000_000 };

describe("rabActualAchievementSchema", () => {
  it("isian manual null/kosong tetap null, bukan angka 0", () => {
    const hasil = rabActualAchievementSchema.parse({
      ...isianDasar,
      actualOpex: null,
      manualRecoveryInstallment: "",
      manualInvestorShare: null,
      manualCompanyShare: undefined,
    });

    expect(hasil.actualOpex).toBeNull();
    expect(hasil.manualRecoveryInstallment).toBeNull();
    expect(hasil.manualInvestorShare).toBeNull();
    expect(hasil.manualCompanyShare).toBeNull();
  });

  it("isian manual berangka dibulatkan ke rupiah utuh (BigInt)", () => {
    const hasil = rabActualAchievementSchema.parse({
      ...isianDasar,
      actualRevenue: "1136362.5",
      manualInvestorShare: 0,
      actualOpex: "250000",
    });

    expect(hasil.actualRevenue).toBe(1_136_363n);
    expect(hasil.manualInvestorShare).toBe(0n);
    expect(hasil.actualOpex).toBe(250_000n);
  });

  it("bulan di luar durasi maksimum dan rupiah negatif ditolak", () => {
    expect(() => rabActualAchievementSchema.parse({ ...isianDasar, month: 121 })).toThrow();
    expect(() => rabActualAchievementSchema.parse({ ...isianDasar, actualOpex: -1 })).toThrow();
  });
});
