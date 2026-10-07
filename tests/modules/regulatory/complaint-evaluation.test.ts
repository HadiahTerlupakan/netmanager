import { describe, expect, it } from "vitest";

import {
  evaluateComplaintParameter,
  isComplaintParameter,
  meetsTarget,
} from "@/modules/regulatory/domain/complaint-evaluation";
import {
  catalogOf,
  parametersOf,
  type ParameterSpec,
} from "@/modules/regulatory/domain/license-schemes";

/**
 * Rumus mengikuti `Panduan Pelaporan QoS ISP.pdf`. Yang paling mudah salah:
 * penyebutnya berpindah-pindah antar-parameter, dan separuh parameter ISP
 * berbentuk batas atas (≤) sehingga "lebih besar" berarti gagal.
 */

const parameter = (kunci: string): ParameterSpec => {
  const ditemukan = parametersOf("ISP").find((p) => p.key === kunci);
  if (!ditemukan) throw new Error(`parameter ${kunci} tidak ada di katalog`);
  return ditemukan;
};

const masukan = (
  counts: { received: number; resolved: number; resolvedWithinLimit: number },
  invoices = 0,
  customers = 0,
) => ({ counts, invoices, customers });

describe("penyebut tiap jenis perhitungan", () => {
  it("akurasi tagihan dibagi jumlah tagihan", () => {
    const hasil = evaluateComplaintParameter(
      parameter("jartaplok.billingComplaints"),
      masukan({ received: 3, resolved: 2, resolvedWithinLimit: 1 }, 100),
    );

    expect(hasil).toMatchObject({
      numerator: 3,
      denominator: 100,
      ratio: 0.03,
    });
  });

  it("laporan gangguan dibagi jumlah pelanggan", () => {
    const hasil = evaluateComplaintParameter(
      parameter("jartaplok.disruptionReports"),
      masukan({ received: 4, resolved: 4, resolvedWithinLimit: 4 }, 999, 200),
    );

    expect(hasil).toMatchObject({
      numerator: 4,
      denominator: 200,
      ratio: 0.02,
    });
  });

  it("keluhan umum dibagi keluhan yang diterima", () => {
    const hasil = evaluateComplaintParameter(
      parameter("jartaplok.generalComplaints"),
      masukan({ received: 20, resolved: 19, resolvedWithinLimit: 10 }),
    );

    expect(hasil).toMatchObject({
      numerator: 19,
      denominator: 20,
      ratio: 0.95,
    });
  });

  it("penyelesaian dalam batas waktu dibagi yang terselesaikan", () => {
    const hasil = evaluateComplaintParameter(
      parameter("seluler.postpaidComplaintResolution"),
      masukan({ received: 30, resolved: 20, resolvedWithinLimit: 18 }),
    );

    expect(hasil).toMatchObject({ numerator: 18, denominator: 20, ratio: 0.9 });
  });
});

describe("arah tolok ukur", () => {
  it("batas atas: lebih kecil berarti memenuhi", () => {
    expect(meetsTarget(0.01, 0.02, "MAX")).toBe(true);
    expect(meetsTarget(0.02, 0.02, "MAX")).toBe(true);
    expect(meetsTarget(0.03, 0.02, "MAX")).toBe(false);
  });

  it("batas bawah: lebih besar berarti memenuhi", () => {
    expect(meetsTarget(0.96, 0.95, "MIN")).toBe(true);
    expect(meetsTarget(0.95, 0.95, "MIN")).toBe(true);
    expect(meetsTarget(0.94, 0.95, "MIN")).toBe(false);
  });

  // Regresi: menilai parameter batas-atas dengan aturan batas-bawah membuat
  // pelanggaran justru terbaca "memenuhi".
  it("keluhan 3% atas tolok ≤2% dinyatakan TIDAK memenuhi", () => {
    const hasil = evaluateComplaintParameter(
      parameter("seluler.billingComplaints"),
      masukan({ received: 3, resolved: 0, resolvedWithinLimit: 0 }, 100),
    );

    expect(hasil.ratio).toBe(0.03);
    expect(hasil.meetsTarget).toBe(false);
  });
});

describe("tanpa data", () => {
  it("penyebut nol berarti belum terukur, bukan nol persen", () => {
    const hasil = evaluateComplaintParameter(
      parameter("jartaplok.billingComplaints"),
      masukan({ received: 0, resolved: 0, resolvedWithinLimit: 0 }, 0),
    );

    expect(hasil.ratio).toBeNull();
    expect(hasil.meetsTarget).toBeNull();
  });
});

describe("pengenalan parameter", () => {
  it("hanya parameter berbasis keluhan yang dikenali", () => {
    expect(isComplaintParameter(parameter("jartaplok.billingComplaints"))).toBe(
      true,
    );
    expect(isComplaintParameter(parameter("jartaplok.newInstallation"))).toBe(
      false,
    );
    expect(isComplaintParameter(parameter("jartaplok.packetLoss"))).toBe(false);
  });

  it("seluruh parameter keluhan ISP tercakup rumusnya", () => {
    const berbasisKeluhan = catalogOf("ISP")
      .blocks.flatMap((b) => b.nonNetwork)
      .filter(isComplaintParameter);

    expect(berbasisKeluhan.length).toBeGreaterThan(0);
    for (const p of berbasisKeluhan) {
      const hasil = evaluateComplaintParameter(
        p,
        masukan({ received: 5, resolved: 4, resolvedWithinLimit: 3 }, 50, 60),
      );
      expect(hasil.denominator).toBeGreaterThan(0);
      expect(hasil.ratio).not.toBeNull();
    }
  });
});
