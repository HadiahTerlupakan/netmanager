import { describe, expect, it } from "vitest";

import {
  hitungPorsiModal,
  persenBagiHasilInvestor,
  STATUS_PROYEK_TERLIHAT_INVESTOR,
} from "@/modules/investor/domain/porsi-investor-proyek";

describe("porsi investor di proyek", () => {
  it("bagi hasil 50% dengan dua investor bermodal sama → masing-masing 25%, bukan 50%", () => {
    const porsi = hitungPorsiModal(50_000_000n, [50_000_000n, 50_000_000n]);
    expect(porsi).toBe(0.5);
    expect(persenBagiHasilInvestor(50, porsi)).toBe(25);
  });

  it("modal tidak sama → persen mengikuti porsi modal", () => {
    const porsi = hitungPorsiModal(30_000_000n, [30_000_000n, 70_000_000n]);
    expect(persenBagiHasilInvestor(50, porsi)).toBe(15);
  });

  it("investor tunggal mendapat seluruh bagian investor", () => {
    expect(persenBagiHasilInvestor(60, hitungPorsiModal(10n, [10n]))).toBe(60);
  });

  it("total modal nol dibagi rata; tanpa investor porsi nol", () => {
    expect(hitungPorsiModal(0n, [0n, 0n, 0n])).toBeCloseTo(1 / 3);
    expect(hitungPorsiModal(0n, [])).toBe(0);
  });

  it("hanya proyek yang sudah disetujui ke atas yang tampil ke investor", () => {
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).not.toContain("DRAFT");
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).not.toContain("PENDING_APPROVAL");
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).not.toContain("REJECTED");
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).not.toContain("CANCELLED");
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).toContain("PENJUALAN");
  });

  it("proyek yang targetnya tercapai atau selesai (status otomatis cron) tetap tampil & ikut bagi hasil", () => {
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).toContain("TARGET_TERCAPAI");
    expect(STATUS_PROYEK_TERLIHAT_INVESTOR).toContain("SELESAI");
  });
});
