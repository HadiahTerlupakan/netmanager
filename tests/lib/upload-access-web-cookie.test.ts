import { encode } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mobile-auth", () => ({ verifyMobileToken: vi.fn() }));

import { pembacaUploadDariSesi } from "@/lib/upload/upload-access";

/**
 * `server.ts` menyajikan `/uploads/` dengan request Node mentah: cookie hanya
 * ada di header, tanpa `req.cookies`. `getToken` next-auth v4 tidak membaca
 * header itu sendiri, sehingga setiap foto privat yang dibuka dari web balas
 * 401 walaupun penggunanya sedang login.
 */
const SECRET = "upload-access-test-secret";

describe("pembaca upload dari cookie web", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_URL", "https://radpro.id");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads the session cookie from a raw Node request", async () => {
    const sessionToken = await encode({
      token: { sub: "user-1", tenantId: "tenant-a", isSuperAdmin: false },
      secret: SECRET,
    });

    const pembaca = await pembacaUploadDariSesi({
      headers: {
        cookie: `theme=dark; __Secure-next-auth.session-token=${sessionToken}`,
      },
    });

    expect(pembaca).toEqual({ tenantId: "tenant-a", isSuperAdmin: false });
  });

  it("still reads the session when another cookie is not valid URI encoding", async () => {
    const sessionToken = await encode({
      token: { sub: "user-1", tenantId: "tenant-a", isSuperAdmin: false },
      secret: SECRET,
    });

    const pembaca = await pembacaUploadDariSesi({
      headers: {
        cookie: `promo=100%; __Secure-next-auth.session-token=${sessionToken}`,
      },
    });

    expect(pembaca?.tenantId).toBe("tenant-a");
  });
});
