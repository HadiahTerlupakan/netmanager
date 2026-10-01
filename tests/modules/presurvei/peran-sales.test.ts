import { describe, expect, it } from "vitest";
import { isKepalaSalesDariIzin } from "@/modules/presurvei/domain/peran-sales";

describe("isKepalaSalesDariIzin", () => {
  it("izin rencana tanpa view_all menandai kepala sales (lingkup TIM)", () => {
    expect(
      isKepalaSalesDariIzin(["presurvei_rencana:read", "presurvei_rencana:create", "m_presurvei:read"]),
    ).toBe(true);
  });

  it("admin (lingkup SEMUA) dan teknisi bukan kepala sales", () => {
    expect(isKepalaSalesDariIzin(["*"])).toBe(false);
    expect(isKepalaSalesDariIzin(["presurvei_rencana:read", "presurvei_rencana:view_all"])).toBe(false);
    expect(isKepalaSalesDariIzin(["m_work_order:read", "m_canvasing:read"])).toBe(false);
  });
});
