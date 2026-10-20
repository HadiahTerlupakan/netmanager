import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@/modules/network/services/mikrotik-router.activity",
  async (importActual) => ({
    ...(await importActual<object>()),
    logRouterUpdateActivity: vi.fn(),
  }),
);

import { updateRouterMutation } from "@/modules/network/services/mikrotik-router.mutations";
import { mikrotikRouterUpdateSchema } from "@/lib/validations/mikrotik";

function runUpdate(connectionMode: "PUBLIC" | "VPN") {
  const routerRepository = {
    findById: vi.fn().mockResolvedValue({ id: "router-1", connectionMode }),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const networkRepository = {
    findSettingByKey: vi.fn().mockResolvedValue({ value: "secret" }),
    findUserSite: vi.fn(),
  };
  return updateRouterMutation({
    id: "router-1",
    data: mikrotikRouterUpdateSchema.parse({ rosVersion: "V7" }),
    userId: "u1",
    tenantId: "t1",
    restrictedToOwnSite: false,
    routerRepository: routerRepository as never,
    networkRepository: networkRepository as never,
  }).then(() => routerRepository.update.mock.calls[0][1]);
}

describe("router update rosVersion", () => {
  it("saves the RouterOS version of a public router", async () => {
    expect(await runUpdate("PUBLIC")).toMatchObject({ rosVersion: "V7" });
  });

  it("never changes the RouterOS version of a VPN router", async () => {
    expect((await runUpdate("VPN")).rosVersion).toBeUndefined();
  });
});
