import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  hasAnyPermission: vi.fn(),
  isSandboxGatewayLive: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/rbac", () => ({ hasAnyPermission: mockFns.hasAnyPermission }));
vi.mock("@/modules/payment-gateway/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/payment-gateway/api")>()),
  isSandboxGatewayLive: mockFns.isSandboxGatewayLive,
}));

import GatewaySandboxBanner from "@/components/admin/GatewaySandboxBanner";

const STAF = { id: "user-1", tenantId: "tenant-1" };

const render = async () => {
  const element = await GatewaySandboxBanner();
  return element ? renderToStaticMarkup(element) : "";
};

describe("GatewaySandboxBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({ user: STAF });
    mockFns.hasAnyPermission.mockResolvedValue(true);
  });

  it("memperingatkan admin tenant yang Duitku-nya masih sandbox", async () => {
    mockFns.isSandboxGatewayLive.mockResolvedValue(true);

    const html = await render();

    expect(html).toContain(
      "Gateway pembayaran memakai SANDBOX — pembayaran pelanggan tidak menerima uang sungguhan",
    );
    expect(html).toContain('role="alert"');
    expect(mockFns.isSandboxGatewayLive).toHaveBeenCalledWith("tenant-1");
    expect(mockFns.hasAnyPermission).toHaveBeenCalledWith(
      [
        "payment_gateway:read",
        "payment_gateway:update",
        "manual_payments:verify",
      ],
      STAF,
    );
  });

  // Peringatan ini untuk yang bisa menindaklanjutinya; dulu tampil di layar
  // setiap pengguna portal admin, termasuk teknisi dan sales.
  it("tidak tampil untuk pengguna tanpa izin payment gateway maupun verifikasi pembayaran", async () => {
    mockFns.hasAnyPermission.mockResolvedValue(false);
    mockFns.isSandboxGatewayLive.mockResolvedValue(true);

    await expect(render()).resolves.toBe("");
    expect(mockFns.isSandboxGatewayLive).not.toHaveBeenCalled();
  });

  it("tidak tampil tanpa sesi", async () => {
    mockFns.getServerSession.mockResolvedValue(null);
    mockFns.isSandboxGatewayLive.mockResolvedValue(true);

    await expect(render()).resolves.toBe("");
    expect(mockFns.hasAnyPermission).not.toHaveBeenCalled();
  });

  it("tidak tampil untuk gateway produksi", async () => {
    mockFns.isSandboxGatewayLive.mockResolvedValue(false);

    await expect(render()).resolves.toBe("");
  });

  it("pemeriksaan yang gagal tidak menjatuhkan halaman admin", async () => {
    mockFns.isSandboxGatewayLive.mockRejectedValue(new Error("db"));

    await expect(render()).resolves.toBe("");
  });
});
