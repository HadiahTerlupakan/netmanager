import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  runProvisioningConnection: vi.fn(async () => undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { ApiUserService } from "@/modules/network/services/mikrotik/ApiUserService";
import { MikroTikConnectionHelper } from "@/modules/network/services/mikrotik/MikroTikConnectionHelper";
import { createProvisioningApiUser } from "@/modules/network/services/mikrotik-provisioning.api-user";

// The router's API user is a real login on the customer's MikroTik, so its
// credentials must not follow Math.random(), whose output can be predicted.
// Pinning Math.random makes any credential still built from it repeat.
describe("MikroTik API user credentials", () => {
  afterEach(() => vi.restoreAllMocks());

  it("provisioning creates a fresh username and password every time", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const router = { ip: "10.0.0.1" } as never;

    const first = await createProvisioningApiUser(router);
    const second = await createProvisioningApiUser(router);

    expect(first.success && second.success).toBe(true);
    expect(first.password).toHaveLength(16);
    expect(first.password).not.toBe(second.password);
    expect(first.username).toMatch(/^netmanager_[a-z0-9]{6}$/);
    expect(first.username).not.toBe(second.username);
  });

  it("the API user service creates a fresh username and password every time", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const helper = new MikroTikConnectionHelper();
    vi.spyOn(helper, "delay").mockResolvedValue();
    const service = new ApiUserService(helper);
    const conn = { write: vi.fn(async () => []) } as never;

    const first = await service.createApiUser(conn);
    const second = await service.createApiUser(conn);

    expect(first.success && second.success).toBe(true);
    expect(first.password).toHaveLength(16);
    expect(first.password).not.toBe(second.password);
    expect(first.username).toMatch(/^netmanager_[a-z0-9]{6}$/);
    expect(first.username).not.toBe(second.username);
  });
});
