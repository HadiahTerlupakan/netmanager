import { describe, expect, it } from "vitest";
import {
  generateSignerToken,
  hashSignerToken,
  isSameTokenHash,
  isValidTokenFormat,
} from "@/modules/endorsement/services/endorsement-token";

/**
 * Token short link adalah satu-satunya bukti kepemilikan link: pihak luar tidak
 * punya akun. Karena itu dua sifatnya wajib dijaga — entropinya besar, dan yang
 * tersimpan di database hanya sidik jarinya sehingga bocornya isi tabel tidak
 * menghasilkan link yang bisa dipakai menandatangani.
 */

describe("generateSignerToken", () => {
  it("menghasilkan token base64url 43 karakter (256-bit)", () => {
    expect(generateSignerToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("tidak pernah menghasilkan token yang sama", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => generateSignerToken()),
    );

    expect(tokens.size).toBe(200);
  });

  it("tidak memuat karakter yang perlu di-escape di URL", () => {
    const token = generateSignerToken();

    expect(encodeURIComponent(token)).toBe(token);
  });
});

describe("hashSignerToken", () => {
  it("menghasilkan sha256 heksadesimal", () => {
    expect(hashSignerToken("token-uji")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stabil untuk token yang sama", () => {
    const token = generateSignerToken();

    expect(hashSignerToken(token)).toBe(hashSignerToken(token));
  });

  // Inti perlindungannya: hash tidak boleh bisa dikembalikan jadi token.
  it("tidak memuat token aslinya", () => {
    const token = generateSignerToken();

    expect(hashSignerToken(token)).not.toContain(token);
  });

  it("berbeda untuk token berbeda", () => {
    expect(hashSignerToken(generateSignerToken())).not.toBe(
      hashSignerToken(generateSignerToken()),
    );
  });
});

describe("isValidTokenFormat", () => {
  it("menerima token yang kita terbitkan", () => {
    expect(isValidTokenFormat(generateSignerToken())).toBe(true);
  });

  it.each(["", "pendek", "a".repeat(44), "token/dengan+karakter=lain"])(
    "menolak bentuk yang tidak dikenali: %s",
    (value) => {
      expect(isValidTokenFormat(value)).toBe(false);
    },
  );
});

describe("isSameTokenHash", () => {
  it("benar untuk hash identik", () => {
    const hash = hashSignerToken("token-uji");

    expect(isSameTokenHash(hash, hash)).toBe(true);
  });

  it("salah untuk hash berbeda", () => {
    expect(isSameTokenHash(hashSignerToken("a"), hashSignerToken("b"))).toBe(
      false,
    );
  });

  it("salah untuk panjang berbeda tanpa melempar", () => {
    expect(isSameTokenHash("abc", hashSignerToken("a"))).toBe(false);
  });
});
