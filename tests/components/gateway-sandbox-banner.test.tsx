import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isSandboxGatewayLive: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockFns.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/modules/payment-gateway/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/payment-gateway/api")>()),
  isSandboxGatewayLive: mockFns.isSandboxGatewayLive,
}));

import GatewaySandboxBanner from "@/components/admin/GatewaySandboxBanner";

const render = async () => {
  const element = await GatewaySandboxBanner();
  return element ? renderToStaticMarkup(element) : "";
};

describe("GatewaySandboxBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getServerSession.mockResolvedValue({
      user: { tenantId: "tenant-1" },
    });
  });

  it("memperingatkan admin tenant yang Duitku-nya masih sandbox", async () => {
    mockFns.isSandboxGatewayLive.mockResolvedValue(true);

    const html = await render();

    expect(html).toContain(
      "Gateway pembayaran memakai SANDBOX — pembayaran pelanggan tidak menerima uang sungguhan",
    );
    expect(html).toContain('role="alert"');
    expect(mockFns.isSandboxGatewayLive).toHaveBeenCalledWith("tenant-1");
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
