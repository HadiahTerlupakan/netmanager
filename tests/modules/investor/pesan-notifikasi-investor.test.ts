import { describe, expect, it } from "vitest";

import {
  formatRupiahNotifikasi,
  labelPeriodeNotifikasi,
  susunPesanInvestor,
} from "@/modules/investor/domain/pesan-notifikasi-investor";

describe("pesan notifikasi investor", () => {
  it("modal diterima menyebut jenis & nominal, membuka bagian Modal", () => {
    expect(
      susunPesanInvestor("investor:deposit.completed", {
        depositId: "dep-1",
        investorId: "inv-1",
        tenantId: "tenant-1",
        amount: "50000000",
        depositType: "TAMBAHAN_MODAL",
      }),
    ).toEqual({
      investorId: "inv-1",
      tenantId: "tenant-1",
      kunciUnik: "setoran-diterima:dep-1",
      judul: "Modal sudah diterima",
      isi: "Setoran tambahan modal Rp 50.000.000 sudah kami terima. Terima kasih.",
      url: "/(investor)/keuangan?bagian=modal",
    });
  });

  it("tenantId kosong dari publisher dibaca sebagai investor tanpa tenant", () => {
    const pesan = susunPesanInvestor("investor:payout.completed", {
      payoutId: "po-9",
      investorId: "inv-1",
      tenantId: "",
      amount: "1000",
    });
    expect(pesan?.tenantId).toBeNull();
  });

  it("setoran ditolak menyertakan alasan", () => {
    const pesan = susunPesanInvestor("investor:deposit.rejected", {
      depositId: "dep-2",
      investorId: "inv-1",
      amount: "10000000",
      reason: "Bukti transfer buram",
    });
    expect(pesan?.isi).toBe(
      "Setoran Rp 10.000.000 ditolak. Alasan: Bukti transfer buram. Silakan hubungi admin.",
    );
    expect(pesan?.kunciUnik).toBe("setoran-ditolak:dep-2");
  });

  it("bagi hasil disetujui memakai nama bulan periode dan membuka bagian Bagi hasil", () => {
    const pesan = susunPesanInvestor("investor:profit_share.approved", {
      profitShareId: "ph-1",
      investorId: "inv-1",
      shareAmount: "2500000",
      periodStart: "2026-07-31T17:00:00.000Z",
      periodEnd: "2026-08-31T16:59:59.000Z",
    });
    expect(pesan?.isi).toBe(
      "Bagi hasil Agustus 2026 sebesar Rp 2.500.000 sudah disetujui dan akan segera dibayar.",
    );
    expect(pesan?.url).toBe("/(investor)/keuangan?bagian=bagi-hasil");
  });

  it("bagi hasil per proyek menyebut nama proyek dan pengembalian modal", () => {
    const pesan = susunPesanInvestor("investor:profit_share.approved", {
      profitShareId: "ph-2",
      investorId: "inv-1",
      shareAmount: "2500000",
      capitalReturnAmount: "1000000",
      projectName: "Jaringan Sukamaju",
      periodStart: "2026-07-31T17:00:00.000Z",
      periodEnd: "2026-08-31T16:59:59.000Z",
    });
    expect(pesan?.isi).toBe(
      "Bagi hasil proyek Jaringan Sukamaju Agustus 2026 sebesar Rp 2.500.000 ditambah pengembalian modal Rp 1.000.000 sudah disetujui dan akan segera dibayar.",
    );
  });

  it("uang dikirim membuka bagian Uang diterima", () => {
    const pesan = susunPesanInvestor("investor:payout.completed", {
      payoutId: "po-1",
      investorId: "inv-1",
      amount: "2000000",
    });
    expect(pesan).toMatchObject({
      judul: "Uang sudah dikirim",
      isi: "Rp 2.000.000 sudah dikirim ke rekening Anda.",
      url: "/(investor)/keuangan?bagian=diterima",
      kunciUnik: "uang-dikirim:po-1",
    });
  });

  it("event lain tidak menghasilkan pesan; payload cacat ditolak agar job diulang", () => {
    expect(susunPesanInvestor("users:user.created", {})).toBeNull();
    expect(() =>
      susunPesanInvestor("investor:payout.completed", { payoutId: "po-1", amount: "1" }),
    ).toThrow(/investorId/);
  });

  it("helper format: rupiah aman dari NaN, periode beberapa bulan jadi rentang", () => {
    expect(formatRupiahNotifikasi("bukan")).toBe("Rp 0");
    expect(labelPeriodeNotifikasi("2026-06-30T17:00:00.000Z", "2026-09-30T16:59:59.000Z")).toBe(
      "Juli–September 2026",
    );
  });
});
