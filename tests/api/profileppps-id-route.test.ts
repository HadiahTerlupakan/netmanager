import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  deleteProfilePPPFromRequest: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

vi.mock("@/modules/network", () => ({
  ProfilePPPService: class MockProfilePPPService {
    deleteProfilePPPFromRequest = mockFns.deleteProfilePPPFromRequest;
  },
}));

describe("DELETE /api/profileppps/[id]", () => {
  let DELETE: (typeof import("@/app/api/profileppps/[id]/route"))["DELETE"];
  const session = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      tenantId: "tenant-1",
      permissions: ["profileppp:delete"],
    },
  };

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/profileppps/[id]/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.requireAuth.mockResolvedValue(session);
  });

  it("meneruskan error service sebagai response 403", async () => {
    mockFns.deleteProfilePPPFromRequest.mockResolvedValue({
      success: false,
      status: 403,
      error: "Akses ditolak",
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/profileppps/profile-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "profile-1" }) },
    );

    const json = (await response.json()) as { error?: string };

    expect(mockFns.deleteProfilePPPFromRequest).toHaveBeenCalledWith({
      session,
      id: "profile-1",
    });
    expect(response.status).toBe(403);
    expect(json.error).toBe("Akses ditolak");
  });

  it("meneruskan error service sebagai response 502", async () => {
    mockFns.deleteProfilePPPFromRequest.mockResolvedValue({
      success: false,
      status: 502,
      error: "router timeout",
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/profileppps/profile-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "profile-1" }) },
    );

    const json = (await response.json()) as {
      error?: string;
      message?: string;
    };

    expect(mockFns.deleteProfilePPPFromRequest).toHaveBeenCalledWith({
      session,
      id: "profile-1",
    });
    expect(response.status).toBe(502);
    expect(json.error).toBe("router timeout");
  });

  it("meneruskan sukses service sebagai response 200", async () => {
    mockFns.deleteProfilePPPFromRequest.mockResolvedValue({
      success: true,
      message: "Profile PPP berhasil dihapus",
    });

    const response = await DELETE(
      new NextRequest("http://localhost/api/profileppps/profile-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "profile-1" }) },
    );

    const json = (await response.json()) as { message: string };

    expect(mockFns.deleteProfilePPPFromRequest).toHaveBeenCalledWith({
      session,
      id: "profile-1",
    });
    expect(response.status).toBe(200);
    expect(json.message).toBe("Profile PPP berhasil dihapus");
  });
});
