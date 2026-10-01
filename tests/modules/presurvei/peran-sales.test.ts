import { describe, expect, it } from "vitest";
import { isKepalaSalesDariIzin, isSalesEfektif } from "@/modules/presurvei/domain/peran-sales";

describe("peran sales", () => {
  it("kepala sales (lingkup TIM) adalah sales meski kolom isSales tidak dicentang", () => {
    const izinKepala = ["presurvei_rencana:read", "presurvei_rencana:create", "m_presurvei:read"];

    expect(isKepalaSalesDariIzin(izinKepala)).toBe(true);
    expect(isSalesEfektif({ isSales: false, permissions: izinKepala })).toBe(true);
  });

  it("admin (lingkup SEMUA) dan teknisi bukan sales", () => {
    expect(isSalesEfektif({ isSales: false, permissions: ["*"] })).toBe(false);
    expect(
      isSalesEfektif({
        isSales: false,
        permissions: ["presurvei_rencana:read", "presurvei_rencana:view_all"],
      }),
    ).toBe(false);
    expect(isSalesEfektif({ isSales: false, permissions: ["m_work_order:read", "m_canvasing:read"] })).toBe(false);
  });

  it("sales yang ditandai di data tetap sales", () => {
    expect(isSalesEfektif({ isSales: true, permissions: ["m_presurvei:read"] })).toBe(true);
  });
});
