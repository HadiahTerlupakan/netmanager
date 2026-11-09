import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import {
  generateLinkToken,
  hashLinkToken,
  isValidLinkTokenFormat,
} from "@/lib/security/link-token";
import {
  generateSignerToken,
  hashSignerToken,
  isValidTokenFormat,
} from "@/modules/endorsement/services/endorsement-token";

describe("link-token", () => {
  it("token 43 karakter base64url dan selalu berbeda", () => {
    const first = generateLinkToken();
    const second = generateLinkToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(isValidLinkTokenFormat(first)).toBe(true);
  });

  it("hash adalah sha256 hex yang deterministik", () => {
    const token = generateLinkToken();

    expect(hashLinkToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(hashLinkToken(token)).toBe(hashLinkToken(token));
  });

  it.each([
    "",
    "pendek",
    `${"a".repeat(43)}=`,
    "a".repeat(44),
    `${"a".repeat(42)}!`,
  ])("menolak bentuk salah %j", (token) => {
    expect(isValidLinkTokenFormat(token)).toBe(false);
  });

  it("nama lama pengesahan tetap berfungsi", () => {
    const token = generateSignerToken();

    expect(isValidTokenFormat(token)).toBe(true);
    expect(hashSignerToken(token)).toBe(hashLinkToken(token));
  });
});
