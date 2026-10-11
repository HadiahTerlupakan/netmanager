import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Wiring izin `POST /api/planning/[id]/peta/terbitkan`.
 *
 * Menerbitkan menuntut `planning:update` DAN `map:create`, dipasang lewat
 * opsi `permissionsAll` — `permissions` bersifat "salah satu dari" dan di sana
 * daftar yang sama justru akan meloloskan pemegang `map:create` saja. Tes ini
 * mengunci kombinasi yang membedakan "dan" dari "atau": hanya salah satu izin
 * tidak boleh meloloskan.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  terbitkan: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/planning", async (importActual) => {
  const actual = await importActual<typeof import("@/modules/planning")>();
  return { ...actual, planningPetaService: { terbitkan: mockFns.terbitkan } };
});

import { POST } from "@/app/api/planning/[id]/peta/terbitkan/route";

const ID_RENCANA = "plan-1";
const TENANT = "tenant-1";
const KONTEKS_ROUTE = { params: Promise.resolve({ id: ID_RENCANA }) };

function buatRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/planning/${ID_RENCANA}/peta/terbitkan`,
    { method: "POST" },
  );
}

function sesiDenganIzin(permissions: string[], isSuperAdmin = false): void {
  mockFns.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      email: "a@example.com",
      tenantId: TENANT,
      isSuperAdmin,
      permissions,
    },
  });
}

describe("POST /api/planning/[id]/peta/terbitkan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.terbitkan.mockResolvedValue({ titikTerbit: 3, jalurTerbit: 2 });
  });

  it("menerbitkan untuk sesi yang punya planning:update dan map:create", async () => {
    sesiDenganIzin(["planning:update", "map:create"]);

    const response = await POST(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(mockFns.terbitkan).toHaveBeenCalledWith("plan-1", "user-1", TENANT);
    const badan = await response.json();
    expect(badan.data).toEqual({ titikTerbit: 3, jalurTerbit: 2 });
  });

  it("menolak 403 bila hanya punya planning:update tanpa map:create", async () => {
    sesiDenganIzin(["planning:update"]);

    const response = await POST(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(403);
    expect(mockFns.terbitkan).not.toHaveBeenCalled();
  });

  it("menolak 403 bila hanya punya map:create tanpa planning:update", async () => {
    sesiDenganIzin(["map:create"]);

    const response = await POST(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(403);
    expect(mockFns.terbitkan).not.toHaveBeenCalled();
  });

  it("meloloskan super admin tanpa map:create tersurat", async () => {
    sesiDenganIzin(["planning:update"], true);

    const response = await POST(buatRequest(), KONTEKS_ROUTE);

    expect(response.status).toBe(200);
    expect(mockFns.terbitkan).toHaveBeenCalledTimes(1);
  });
});
