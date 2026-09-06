import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { buildSignOutCallbackUrl, resolveLoginPath } from "@/lib/auth/sign-out";

/**
 * `signOut()` tanpa `callbackUrl` memakai origin `NEXTAUTH_URL` (apex), jadi
 * logout dari subdomain melempar pengguna ke landing page.
 */
describe("resolveLoginPath", () => {
  it("mengarahkan portal karyawan ke login karyawan", () => {
    expect(resolveLoginPath("/karyawan/absensi")).toBe("/karyawan/login");
  });

  it("mengarahkan portal admin ke login admin", () => {
    expect(resolveLoginPath("/admin/pelanggan/ppp")).toBe("/admin/login");
  });
});

describe("buildSignOutCallbackUrl", () => {
  it("tetap di host yang sedang dipakai", () => {
    expect(
      buildSignOutCallbackUrl("https://admin.radpro.id", "/admin/planning"),
    ).toBe("https://admin.radpro.id/admin/login");
  });

  it("tetap di host karyawan", () => {
    expect(
      buildSignOutCallbackUrl("https://karyawan.radpro.id", "/karyawan"),
    ).toBe("https://karyawan.radpro.id/karyawan/login");
  });
});
