import { describe, expect, it } from "vitest";
import {
  buildSlugCandidate,
  buildSlugVariant,
  isReservedSlug,
} from "@/modules/tenant";

/**
 * Slug tenant dipakai sebagai label DNS (`<slug>.<domain>`), jadi aturannya
 * lebih ketat daripada nama tenant yang bebas bentuk.
 */
describe("buildSlugCandidate", () => {
  it("menormalkan nama tenant menjadi label DNS", () => {
    expect(buildSlugCandidate("PT. Akses Cepat Nusantara")).toBe(
      "pt-akses-cepat-nusantara",
    );
  });

  it("membuang tanda hubung di pangkal dan ujung", () => {
    expect(buildSlugCandidate("!! Akses !!")).toBe("akses");
  });

  // Label DNS maksimal 63 karakter dan tidak boleh berakhir dengan tanda hubung.
  it("memotong nama panjang tanpa menyisakan tanda hubung di ujung", () => {
    const slug = buildSlugCandidate("a".repeat(60) + " berikutnya");

    expect(slug.length).toBeLessThanOrEqual(63);
    expect(slug.endsWith("-")).toBe(false);
  });

  // Nama yang seluruhnya karakter non-DNS tetap harus menghasilkan slug yang
  // sah — bukan string kosong yang lolos ke database.
  it("memakai awalan cadangan saat nama tidak menyisakan karakter", () => {
    expect(buildSlugCandidate("株式会社")).toBe("tenant");
  });

  it("memenuhi panjang minimum untuk nama yang terlalu pendek", () => {
    expect(buildSlugCandidate("PT").length).toBeGreaterThanOrEqual(3);
  });
});

describe("buildSlugVariant", () => {
  it("menambahkan pembeda angka", () => {
    expect(buildSlugVariant("akses", 2)).toBe("akses-2");
  });

  // Pemotongan di pangkal, bukan di ekor: kalau pembeda ikut terpotong, slug
  // ke-10 dan ke-11 bisa jadi sama dan tabrakan tidak pernah selesai.
  it("mempertahankan pembeda saat slug sudah sepanjang batas", () => {
    const panjang = "a".repeat(63);

    expect(buildSlugVariant(panjang, 11)).toMatch(/-11$/);
    expect(buildSlugVariant(panjang, 11).length).toBeLessThanOrEqual(63);
  });
});

describe("isReservedSlug", () => {
  // Host portal ditulis ulang `proxy.ts`, jadi tenant dengan slug ini tidak
  // akan pernah bisa diakses.
  it.each(["admin", "karyawan", "pelanggan", "investor", "admin-staging"])(
    "memesan subdomain portal %s",
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
    },
  );

  it.each(["www", "api", "staging"])(
    "memesan nama infrastruktur %s",
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
    },
  );

  it("membiarkan slug tenant biasa", () => {
    expect(isReservedSlug("akses-cepat")).toBe(false);
  });
});
