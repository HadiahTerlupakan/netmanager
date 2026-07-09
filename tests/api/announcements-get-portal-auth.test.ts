import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperAdminRole: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: mockFns.requireAuth,
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: mockFns.hasPermission,
}));

vi.mock("@/lib/auth/helpers", () => ({
  isSuperAdminRole: mockFns.isSuperAdminRole,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logActivity: vi.fn(),
    logActivitySafe: vi.fn(),
    logAuth: vi.fn(),
    apiRequest: vi.fn(),
    dbOperation: vi.fn(),
  },
}));

import { GET } from "@/app/api/announcements/route";

describe("GET /api/announcements — portal authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFns.isSuperAdminRole.mockReturnValue(false);
    prismaMock.announcement.findMany.mockResolvedValue([]);
  });

  it("menolak akses tanpa portal jika tidak punya permission announcement:read", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/announcements"),
    );

    expect(response.status).toBe(403);
  });

  it("mengizinkan akses tanpa portal jika punya permission announcement:read", async () => {
    mockFns.hasPermission.mockResolvedValue(true);

    const response = await GET(
      new NextRequest("http://localhost/api/announcements"),
    );

    expect(response.status).toBe(200);
  });

  it("menolak portal=admin jika tidak punya permission dan bukan admin panel user", async () => {
    mockFns.hasPermission.mockResolvedValue(false);
    mockFns.requireAuth.mockResolvedValue({
      user: { id: "user-1", accessAdminPanel: false, isSuperAdmin: false },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/announcements?portal=admin"),
    );

    expect(response.status).toBe(403);
  });

  it("mengizinkan portal=admin jika punya permission announcement:read", async () => {
    mockFns.hasPermission.mockResolvedValue(true);

    const response = await GET(
      new NextRequest("http://localhost/api/announcements?portal=admin"),
    );

    expect(response.status).toBe(200);
  });

  it("mengizinkan portal=admin jika accessAdminPanel=true meski tanpa permission", async () => {
    mockFns.hasPermission.mockResolvedValue(false);
    mockFns.requireAuth.mockResolvedValue({
      user: { id: "user-1", accessAdminPanel: true, isSuperAdmin: false },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/announcements?portal=admin"),
    );

    expect(response.status).toBe(200);
  });

  it("mengizinkan portal=customer untuk user authenticated tanpa permission khusus", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/announcements?portal=customer"),
    );

    expect(response.status).toBe(200);
  });

  it("mengizinkan portal=employee untuk user authenticated tanpa permission khusus", async () => {
    mockFns.hasPermission.mockResolvedValue(false);

    const response = await GET(
      new NextRequest("http://localhost/api/announcements?portal=employee"),
    );

    expect(response.status).toBe(200);
  });
});
