import { describe, expect, it } from "vitest";

import {
  autoParametersOf,
  catalogOf,
  LICENSE_SCHEMES,
  manualParametersOf,
  parametersOf,
} from "@/modules/regulatory/domain/license-schemes";

/**
 * Katalog ini dikunci terhadap draf resmi Komdigi. Yang dijaga bukan sekadar
 * jumlah parameter, tapi perbedaan antar-formulir yang paling mudah luput:
 * pasang baru punya tolok ukur berbeda, dan pemulihan layanan hanya ada di
 * Jartaplok. Salah di sini berarti laporan ke regulator salah.
 */

describe("katalog Jartaplok PS", () => {
  const katalog = catalogOf("JARTAPLOK_PS");

  it("satu blok tanpa pemisahan sub-jenis", () => {
    expect(katalog.blocks).toHaveLength(1);
    expect(katalog.blocks[0].label).toBe("");
  });

  it("enam parameter: 3 jaringan + 3 non-jaringan", () => {
    expect(katalog.blocks[0].network).toHaveLength(3);
    expect(katalog.blocks[0].nonNetwork).toHaveLength(3);
    expect(parametersOf("JARTAPLOK_PS")).toHaveLength(6);
  });

  it("pasang baru bertolok ukur 90% dan dihitung sistem", () => {
    const pasangBaru = parametersOf("JARTAPLOK_PS").find(
      (p) => p.key === "newInstallation",
    );
    expect(pasangBaru?.targetRatio).toBe(0.9);
    expect(pasangBaru?.targetLabel).toBe("≥ 90%");
    expect(pasangBaru?.auto).toEqual({
      kind: "WORK_ORDER_DURATION",
      workOrder: "PASANG_BARU",
      maxDays: 7,
      dayUnit: "CALENDAR",
    });
  });

  it("memuat pemulihan layanan ≤ 2 hari kerja", () => {
    const pemulihan = parametersOf("JARTAPLOK_PS").find(
      (p) => p.key === "restoration",
    );
    expect(pemulihan?.auto).toMatchObject({
      workOrder: "PEMULIHAN_LAYANAN",
      maxDays: 2,
      dayUnit: "WORKING",
    });
  });
});

describe("katalog ISP", () => {
  const katalog = catalogOf("ISP");

  it("dua blok media akses sesuai formulir", () => {
    expect(katalog.blocks.map((b) => b.key)).toEqual([
      "SELULER",
      "JARTAPLOK_PS",
    ]);
    expect(katalog.blocks[0].label).toContain("Jaringan Bergerak Seluler");
    expect(katalog.blocks[1].label).toContain("Jaringan Tetap Lokal");
  });

  it("blok seluler: 4 parameter jaringan termasuk download & upload rate", () => {
    const jaringan = katalog.blocks[0].network.map((p) => p.title);
    expect(jaringan).toHaveLength(4);
    expect(jaringan.some((t) => t.includes("Download Successful Rate"))).toBe(
      true,
    );
    expect(jaringan.some((t) => t.includes("Upload Successful Rate"))).toBe(
      true,
    );
  });

  it("blok jartaplok: memakai network availability, bukan download/upload rate", () => {
    const jaringan = katalog.blocks[1].network.map((p) => p.title);
    expect(jaringan).toHaveLength(3);
    expect(jaringan.some((t) => t.includes("availability"))).toBe(true);
    expect(jaringan.some((t) => t.includes("Successful Rate"))).toBe(false);
  });

  it("pasang baru bertolok ukur 95%, beda dari Jartaplok", () => {
    for (const blok of katalog.blocks) {
      const pasangBaru = blok.nonNetwork.find((p) =>
        p.key.endsWith(".newInstallation"),
      );
      expect(pasangBaru?.targetRatio).toBe(0.95);
      expect(pasangBaru?.targetLabel).toBe("≥ 95%");
    }
  });

  // Pemulihan layanan tidak diminta formulir ISP; membawanya ikut akan
  // melaporkan parameter yang tidak ada dasarnya.
  it("tidak memuat pemulihan layanan", () => {
    const adaPemulihan = parametersOf("ISP").some(
      (p) =>
        p.key.includes("restoration") ||
        p.title.toLowerCase().includes("pemulihan"),
    );
    expect(adaPemulihan).toBe(false);
  });

  it("tolok ukur keluhan lebih ketat di blok seluler", () => {
    const seluler = katalog.blocks[0].nonNetwork.find(
      (p) => p.key === "seluler.billingComplaints",
    );
    const jartaplok = katalog.blocks[1].nonNetwork.find(
      (p) => p.key === "jartaplok.billingComplaints",
    );
    expect(seluler?.targetRatio).toBe(0.02);
    expect(jartaplok?.targetRatio).toBe(0.05);
  });

  it("hanya blok seluler memuat aktivasi paket data dan deposit prabayar", () => {
    const kunci = parametersOf("ISP").map((p) => p.key);
    expect(kunci).toContain("seluler.dataActivation");
    expect(kunci).toContain("seluler.prepaidDepositResolution");
    expect(kunci).not.toContain("jartaplok.dataActivation");
    expect(kunci).not.toContain("jartaplok.prepaidDepositResolution");
  });
});

describe("pembagian otomatis dan manual", () => {
  it("parameter jaringan selalu manual — menuntut uji lapangan", () => {
    for (const skema of LICENSE_SCHEMES) {
      for (const blok of catalogOf(skema).blocks) {
        for (const parameter of blok.network) {
          expect(parameter.auto).toBeUndefined();
        }
      }
    }
  });

  it("Jartaplok menghitung dua parameter dari work order", () => {
    expect(autoParametersOf("JARTAPLOK_PS").map((p) => p.key)).toEqual([
      "newInstallation",
      "restoration",
    ]);
  });

  it("ISP menghitung pasang baru dan tiga parameter keluhan per blok", () => {
    const otomatis = autoParametersOf("ISP").map((p) => p.key);
    for (const blok of ["seluler", "jartaplok"]) {
      expect(otomatis).toContain(`${blok}.newInstallation`);
      expect(otomatis).toContain(`${blok}.billingComplaints`);
      expect(otomatis).toContain(`${blok}.generalComplaints`);
      expect(otomatis).toContain(`${blok}.disruptionReports`);
    }
    // Kecepatan jawab panggilan/email tidak punya sumber data di aplikasi.
    expect(otomatis).not.toContain("jartaplok.callAnswerSpeed");
    expect(otomatis).not.toContain("jartaplok.emailAnswerSpeed");
  });

  it("setiap parameter punya kunci unik dalam skemanya", () => {
    for (const skema of LICENSE_SCHEMES) {
      const kunci = parametersOf(skema).map((p) => p.key);
      expect(new Set(kunci).size).toBe(kunci.length);
    }
  });

  it("otomatis dan manual bersama-sama mencakup seluruh parameter", () => {
    for (const skema of LICENSE_SCHEMES) {
      expect(
        autoParametersOf(skema).length + manualParametersOf(skema).length,
      ).toBe(parametersOf(skema).length);
    }
  });
});
