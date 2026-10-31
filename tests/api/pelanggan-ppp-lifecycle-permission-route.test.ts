import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Aksi status pelanggan (status, suspend, activate) mengubah akses PPPoE
 * pelanggan di RADIUS/router, jadi menuntut izin yang sama dengan edit
 * pelanggan (`pelanggan:update`), bukan sekadar sesi login atau akses panel
 * admin. Token pelanggan (aplikasi mobile) tidak membawa izin itu.
 */

const palsu = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  getMobileTokenDetails: vi.fn(),
  verifyMobileToken: vi.fn(),
  updateCustomerStatus: vi.fn(),
  suspendCustomer: vi.fn(),
  activateCustomer: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: palsu.getServerSession }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  getUserPermissions: palsu.getUserPermissions,
}));

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenDetails: palsu.getMobileTokenDetails,
  verifyMobileToken: palsu.verifyMobileToken,
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileRequestVersionCode: (): undefined => undefined,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  PelangganPppRouteService: class {
    updateCustomerStatus = palsu.updateCustomerStatus;
    suspendCustomer = palsu.suspendCustomer;
    activateCustomer = palsu.activateCustomer;
  },
  RouteServiceError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));

import { PATCH as patchStatus } from "@/app/api/pelanggan-ppp/[id]/status/route";
import { POST as postSuspend } from "@/app/api/pelanggan-ppp/[id]/suspend/route";
import { POST as postActivate } from "@/app/api/pelanggan-ppp/[id]/activate/route";

type RouteFn = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

const ROUTES: Array<{
  name: string;
  handler: RouteFn;
  method: string;
  path: string;
  body: unknown;
  service: ReturnType<typeof vi.fn>;
}> = [
  {
    name: "PATCH status",
    handler: patchStatus as RouteFn,
    method: "PATCH",
    path: "status",
    body: { status: "ISOLIR" },
    service: palsu.updateCustomerStatus,
  },
  {
    name: "POST suspend",
    handler: postSuspend as RouteFn,
    method: "POST",
    path: "suspend",
    body: { suspensionType: "PAYMENT", reason: "Tunggakan" },
    service: palsu.suspendCustomer,
  },
  {
    name: "POST activate",
    handler: postActivate as RouteFn,
    method: "POST",
    path: "activate",
    body: {},
    service: palsu.activateCustomer,
  },
];

function panggil(
  route: (typeof ROUTES)[number],
  headers: Record<string, string> = {},
) {
  return route.handler(
    new NextRequest(`http://localhost/api/pelanggan-ppp/pel-1/${route.path}`, {
      method: route.method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(route.body),
    }),
    { params: Promise.resolve({ id: "pel-1" }) },
  );
}

function sesiStaf(permissions: string[]) {
  palsu.getServerSession.mockResolvedValue({
    user: {
      id: "staf-1",
      email: "staf@example.com",
      name: "Staf",
      role: "ADMIN",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      accessAdminPanel: true,
      permissions,
    },
  });
}

describe.each(ROUTES)("$name — izin", (route) => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.service.mockResolvedValue({
      pelanggan: { id: "pel-1", nama: "TES", status: "AKTIF" },
      updatedPelanggan: { id: "pel-1", status: "ISOLIR" },
      message: "ok",
      success: true,
    });
  });

  it("401 tanpa sesi", async () => {
    palsu.getServerSession.mockResolvedValue(null);

    const response = await panggil(route);

    expect(response.status).toBe(401);
    expect(route.service).not.toHaveBeenCalled();
  });

  it("403 untuk token aplikasi pelanggan", async () => {
    palsu.getServerSession.mockResolvedValue(null);
    palsu.getMobileTokenDetails.mockResolvedValue({
      versionAccess: { isSupported: true },
    });
    // Bentuk payload yang dihasilkan verifyCustomerToken di lib/mobile-auth.
    palsu.verifyMobileToken.mockResolvedValue({
      userId: "pel-2",
      role: "CUSTOMER",
      tenantId: "tenant-1",
      permissions: ["customer:read", "customer:write"],
    });

    const response = await panggil(route, {
      Authorization: "Bearer token-pelanggan",
    });

    expect(response.status).toBe(403);
    expect(route.service).not.toHaveBeenCalled();
  });

  it("403 untuk staf panel admin yang hanya boleh membaca pelanggan", async () => {
    sesiStaf(["pelanggan:read", "pelanggan:site_only"]);

    const response = await panggil(route);

    expect(response.status).toBe(403);
    expect(route.service).not.toHaveBeenCalled();
  });

  it("lolos dengan pelanggan:update dan meneruskan izin untuk cek site", async () => {
    sesiStaf(["pelanggan:update", "pelanggan:site_only"]);

    const response = await panggil(route);

    expect(response.status).toBe(200);
    expect(route.service).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pel-1",
        session: expect.objectContaining({
          user: expect.objectContaining({
            tenantId: "tenant-1",
            permissions: ["pelanggan:update", "pelanggan:site_only"],
          }),
        }),
      }),
    );
  });

  it("lolos dengan alias ppp:update (peran NOC / Network)", async () => {
    sesiStaf(["ppp:update"]);

    const response = await panggil(route);

    expect(response.status).toBe(200);
  });
});
