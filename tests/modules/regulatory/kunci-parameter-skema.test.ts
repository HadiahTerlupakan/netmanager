import { describe, expect, it } from "vitest";

import { pastikanKunciSesuaiSkema } from "@/modules/regulatory";

/**
 * Kunci parameter tidak lagi union statis — ruangnya bergantung jenis izin, dan
 * ISP memakai awalan blok. Keamanan tipe yang hilang digantikan penjaga ini:
 * tanpanya, isian satu izin bisa menyelinap ke izin lain lewat payload rakitan
 * sendiri, tersimpan diam-diam, lalu ikut tercetak ke dokumen resmi.
 */

const isian = (
  manual: Record<string, string>,
  link: Record<string, string> = {},
) => ({
  manualAchievements: manual,
  supportingLinks: link,
});

describe("pastikanKunciSesuaiSkema", () => {
  it("menerima kunci milik skemanya", () => {
    expect(() =>
      pastikanKunciSesuaiSkema(
        "JARTAPLOK_PS",
        isian({ packetLoss: "1,2" }, { restoration: "https://a.id" }),
      ),
    ).not.toThrow();

    expect(() =>
      pastikanKunciSesuaiSkema(
        "ISP",
        isian({ "seluler.packetLoss": "1,2", "jartaplok.latency": "95" }),
      ),
    ).not.toThrow();
  });

  it("menolak kunci ISP yang dikirim ke formulir Jartaplok", () => {
    expect(() =>
      pastikanKunciSesuaiSkema(
        "JARTAPLOK_PS",
        isian({ "seluler.packetLoss": "1,2" }),
      ),
    ).toThrow(/tidak dikenal untuk izin JARTAPLOK_PS/);
  });

  it("menolak kunci Jartaplok yang dikirim ke formulir ISP", () => {
    // `restoration` tidak ada di formulir ISP sama sekali.
    expect(() =>
      pastikanKunciSesuaiSkema("ISP", isian({ restoration: "90" })),
    ).toThrow(/tidak dikenal untuk izin ISP/);
  });

  it("memeriksa link dokumen pendukung, bukan hanya capaian", () => {
    expect(() =>
      pastikanKunciSesuaiSkema(
        "ISP",
        isian({}, { restoration: "https://a.id" }),
      ),
    ).toThrow(/restoration/);
  });

  it("menyebut seluruh kunci asing sekaligus, tanpa duplikat", () => {
    try {
      pastikanKunciSesuaiSkema(
        "ISP",
        isian({ restoration: "1" }, { restoration: "x", mengada: "y" }),
      );
      throw new Error("seharusnya melempar");
    } catch (error) {
      const pesan = (error as Error).message;
      expect(pesan).toContain("restoration");
      expect(pesan).toContain("mengada");
      expect(pesan.match(/restoration/g)).toHaveLength(1);
    }
  });

  it("isian kosong selalu diterima", () => {
    expect(() => pastikanKunciSesuaiSkema("ISP", isian({}))).not.toThrow();
    expect(() =>
      pastikanKunciSesuaiSkema("JARTAPLOK_PS", isian({})),
    ).not.toThrow();
  });
});
