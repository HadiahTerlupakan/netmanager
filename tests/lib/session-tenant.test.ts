import { describe, expect, it } from "vitest";

import {
  requireSessionTenantId,
  requireSessionTenantIdUnlessSuperAdmin,
} from "@/lib/api/session-tenant";

type SesiUji = Parameters<typeof requireSessionTenantId>[0]["session"];

const sesi = (user: {
  tenantId?: string;
  isSuperAdmin?: boolean;
}): { session: SesiUji } => ({
  session: { user: { id: "user-1", email: "user-1@contoh.id", ...user } },
});

describe("requireSessionTenantIdUnlessSuperAdmin", () => {
  it("mengembalikan tenant sesi bila ada", () => {
    expect(
      requireSessionTenantIdUnlessSuperAdmin(sesi({ tenantId: "tenant-a" })),
    ).toBe("tenant-a");
  });

  it("tetap memakai tenant sesi super admin yang bertenant", () => {
    expect(
      requireSessionTenantIdUnlessSuperAdmin(
        sesi({ tenantId: "tenant-a", isSuperAdmin: true }),
      ),
    ).toBe("tenant-a");
  });

  it("mengembalikan null hanya untuk super admin tanpa tenant sesi", () => {
    expect(
      requireSessionTenantIdUnlessSuperAdmin(sesi({ isSuperAdmin: true })),
    ).toBeNull();
  });

  it("menolak 400 pemanggil biasa tanpa tenant sesi", () => {
    expect(() =>
      requireSessionTenantIdUnlessSuperAdmin(sesi({ isSuperAdmin: false })),
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() =>
      requireSessionTenantIdUnlessSuperAdmin({ session: null }),
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});
