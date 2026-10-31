import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getHealth: vi.fn(),
  isSandboxGatewayLive: vi.fn(),
}));

vi.mock("@/modules/network", () => ({
  HealthCheckRouteService: class {
    getHealth = mockFns.getHealth;
  },
}));

vi.mock("@/modules/payment-gateway/api", () => ({
  isSandboxGatewayLive: mockFns.isSandboxGatewayLive,
}));

import { GET } from "@/app/api/health/route";

const healthRequest = (secret?: string) =>
  new NextRequest("http://localhost/api/health", {
    headers: secret ? { "x-internal-request": secret } : {},
  });

describe("GET /api/health: penanda gateway sandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INTERNAL_HEALTH_SECRET", "rahasia-health");
    mockFns.getHealth.mockResolvedValue({ status: "healthy" });
    mockFns.isSandboxGatewayLive.mockResolvedValue(true);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("health internal menandai gateway yang masih sandbox", async () => {
    const response = await GET(healthRequest("rahasia-health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.paymentGateway).toEqual({ sandboxInProduction: true });
    expect(mockFns.isSandboxGatewayLive).toHaveBeenCalledWith(null);
  });

  // Penanda publik akan memberi tahu siapa pun bahwa pembayaran bisa
  // "dilunasi" dari halaman demo sandbox Duitku.
  it("health publik tidak membocorkannya", async () => {
    const response = await GET(healthRequest());
    const body = await response.json();

    expect(body.data).toEqual({ status: "ok", timestamp: expect.any(String) });
    expect(mockFns.isSandboxGatewayLive).not.toHaveBeenCalled();
  });
});
