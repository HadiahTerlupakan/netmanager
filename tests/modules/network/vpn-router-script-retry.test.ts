import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isVpnConfigured: vi.fn() }));

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: <T>(_reason: string, callback: () => Promise<T>) =>
    callback(),
  runWithRequestTenantContext: <T>(_ctx: unknown, callback: () => Promise<T>) =>
    callback(),
}));
vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  isVpnConfigured: mocks.isVpnConfigured,
}));

import {
  retryStaleVpnScripts,
  VPN_SCRIPT_RETRY_BATCH_SIZE,
} from "@/modules/network/services/VpnRouterScriptRetry";
import { VpnCoreError } from "@/modules/network/vpn";

const routerRecord = (id: string) => ({ id }) as never;

function makeDeps(tenantIds: string[]) {
  return {
    tenants: {
      findActiveTenants: vi
        .fn()
        .mockResolvedValue(tenantIds.map((id) => ({ id }))),
    },
    repo: { findStaleOnline: vi.fn() },
    service: { retryStaleScript: vi.fn().mockResolvedValue(true) },
  };
}

describe("retryStaleVpnScripts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isVpnConfigured.mockReturnValue(true);
  });

  it("retries a bounded batch of stale online routers per tenant", async () => {
    const deps = makeDeps(["t1", "t2"]);
    deps.repo.findStaleOnline
      .mockResolvedValueOnce([routerRecord("r1")])
      .mockResolvedValueOnce([routerRecord("r2")]);

    await retryStaleVpnScripts(deps);

    expect(deps.repo.findStaleOnline).toHaveBeenCalledWith(
      "t1",
      VPN_SCRIPT_RETRY_BATCH_SIZE,
    );
    expect(deps.service.retryStaleScript).toHaveBeenCalledWith(
      routerRecord("r1"),
      "t1",
    );
    expect(deps.service.retryStaleScript).toHaveBeenCalledWith(
      routerRecord("r2"),
      "t2",
    );
  });

  it("stops at the first core error, including later tenants", async () => {
    const deps = makeDeps(["t1", "t2"]);
    deps.repo.findStaleOnline.mockResolvedValue([
      routerRecord("r1"),
      routerRecord("r2"),
    ]);
    deps.service.retryStaleScript.mockRejectedValueOnce(
      new VpnCoreError(502, "unreachable"),
    );

    await retryStaleVpnScripts(deps);

    expect(deps.service.retryStaleScript).toHaveBeenCalledTimes(1);
    expect(deps.repo.findStaleOnline).toHaveBeenCalledTimes(1);
  });

  it("moves on to the next router after a non-core failure", async () => {
    const deps = makeDeps(["t1"]);
    deps.repo.findStaleOnline.mockResolvedValue([
      routerRecord("r1"),
      routerRecord("r2"),
    ]);
    deps.service.retryStaleScript.mockRejectedValueOnce(new Error("db"));

    await retryStaleVpnScripts(deps);

    expect(deps.service.retryStaleScript).toHaveBeenCalledTimes(2);
  });

  it("does nothing when VPN is not configured", async () => {
    mocks.isVpnConfigured.mockReturnValue(false);
    const deps = makeDeps(["t1"]);

    await retryStaleVpnScripts(deps);

    expect(deps.tenants.findActiveTenants).not.toHaveBeenCalled();
  });
});
