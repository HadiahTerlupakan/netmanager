import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isConfigured: vi.fn() }));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  isVpnConfigured: mocks.isConfigured,
}));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: <T>(_reason: string, cb: () => Promise<T>) => cb(),
}));

import { refreshVpnServerStatuses } from "@/modules/network/services/VpnServerStatusRefresh";

describe("refreshVpnServerStatuses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyegarkan sekali bila VPN dikonfigurasi", async () => {
    mocks.isConfigured.mockReturnValue(true);
    const service = { refreshServerStatuses: vi.fn(async () => {}) };

    await refreshVpnServerStatuses(service);

    expect(service.refreshServerStatuses).toHaveBeenCalledTimes(1);
  });

  it("tidak memanggil core bila VPN belum dikonfigurasi", async () => {
    mocks.isConfigured.mockReturnValue(false);
    const service = { refreshServerStatuses: vi.fn(async () => {}) };

    await refreshVpnServerStatuses(service);

    expect(service.refreshServerStatuses).not.toHaveBeenCalled();
  });
});
