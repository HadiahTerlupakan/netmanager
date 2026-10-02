import { describe, expect, it } from "vitest";

import { keTeksIsian, susunIsianCapaian } from "@/app/admin/pengeluaran/rabActualInput";

const FORM = {
  actualSubscribers: 7,
  actualRevenue: "",
  actualOpex: "",
  manualRecoveryInstallment: "",
  manualInvestorShare: "",
  manualCompanyShare: "",
  manualInvestorProfitSharePercent: "",
};

describe("isian capaian bulanan RAB", () => {
  it("pendapatan berdesimal dibulatkan, bukan dikali 10 (bug lama: titik dibuang)", () => {
    const hasil = susunIsianCapaian({ ...FORM, actualRevenue: "1136362.5" });
    expect(hasil).toMatchObject({ ok: true, data: { actualRevenue: 1136363 } });
  });

  it("kolom kosong = tidak diisi (null); OPEX aktual 0 tetap 0", () => {
    const hasil = susunIsianCapaian({ ...FORM, actualRevenue: "5000000", actualOpex: "0" });
    expect(hasil).toEqual({
      ok: true,
      data: {
        actualSubscribers: 7,
        actualRevenue: 5000000,
        actualOpex: 0,
        manualRecoveryInstallment: null,
        manualInvestorShare: null,
        manualCompanyShare: null,
        manualInvestorProfitSharePercent: null,
      },
    });
  });

  it("menolak pendapatan kosong, angka negatif, dan persen di luar 0–100", () => {
    expect(susunIsianCapaian(FORM)).toEqual({ ok: false, pesan: "Pendapatan wajib diisi" });
    expect(susunIsianCapaian({ ...FORM, actualRevenue: "-1" })).toMatchObject({ ok: false });
    expect(
      susunIsianCapaian({ ...FORM, actualRevenue: "1", manualInvestorProfitSharePercent: "150" }),
    ).toEqual({ ok: false, pesan: "Persen bagi hasil harus 0–100" });
  });

  it("persen manual 0% tidak hilang saat disunting ulang", () => {
    expect(keTeksIsian(0)).toBe("0");
    expect(keTeksIsian(null)).toBe("");
    const hasil = susunIsianCapaian({ ...FORM, actualRevenue: "1", manualInvestorProfitSharePercent: "0" });
    expect(hasil).toMatchObject({ ok: true, data: { manualInvestorProfitSharePercent: 0 } });
  });
});
