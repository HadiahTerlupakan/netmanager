import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { permissionListAllows } from "@/lib/rbac";

/** Gerbang dokumen legal rahasia memakai daftar izin sesi tanpa query ulang. */
describe("permissionListAllows", () => {
  it("lolos bila izin dimiliki", () => {
    expect(
      permissionListAllows({ permissions: ["legal:read", "legal_rahasia:read"] }, "legal_rahasia:read"),
    ).toBe(true);
  });

  it("menolak bila hanya punya izin legal biasa", () => {
    expect(permissionListAllows({ permissions: ["legal:read"] }, "legal_rahasia:read")).toBe(false);
  });

  it("super admin dan wildcard selalu lolos", () => {
    expect(permissionListAllows({ permissions: [], isSuperAdmin: true }, "legal_rahasia:read")).toBe(true);
    expect(permissionListAllows({ permissions: ["*"] }, "legal_rahasia:read")).toBe(true);
  });
});
