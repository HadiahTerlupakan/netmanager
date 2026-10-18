import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prismaAuth: { user: { update: mockUserUpdate } },
  prismaMitra: { mitra: { update: vi.fn() } },
}));
vi.mock("@/lib/jwt", () => ({ invalidatePelangganRefreshTokens: vi.fn() }));

import {
  performMobileLogout,
  revokeMobileSessions,
} from "@/modules/users/services/MobileLogoutService";

describe("logout mobile karyawan", () => {
  beforeEach(() => {
    mockUserUpdate.mockReset();
    mockUserUpdate.mockResolvedValue({});
  });

  it("only revokes mobile sessions, leaving the web session signed in", async () => {
    await performMobileLogout({ userId: "user-1", role: "ADMIN" });

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mobileTokenVersion: { increment: 1 } },
    });
  });

  it("still revokes every session when the password changes", async () => {
    await revokeMobileSessions({ userId: "user-1", role: "ADMIN" });

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
