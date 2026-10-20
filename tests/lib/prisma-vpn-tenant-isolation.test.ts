import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(async () => ({
    tenantId: "tenant-1",
    isSuperAdmin: false,
  })),
}));

import { withTenantIsolation } from "@/lib/prisma-extension";
import { ignoreModels } from "@/lib/prisma-ignore-models";

type RunQuery = (input: {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: unknown) => Promise<unknown>;
}) => Promise<unknown>;

const VPN_MODELS = [
  "VpnServer",
  "TenantVpnServer",
  "MikroTikRouterVpnServer",
  "VpnCoreRouterTombstone",
];

describe("isolasi tenant untuk model VPN", () => {
  let run: RunQuery;

  beforeEach(() => {
    run = withTenantIsolation(ignoreModels).query.$allModels
      .$allOperations as unknown as RunQuery;
  });

  const findMany = (model: string) =>
    run({
      model,
      operation: "findMany",
      args: { where: { id: "x" } },
      query: async (args) => args,
    });

  it("VpnServer tidak diberi filter tenantId", async () => {
    expect(await findMany("VpnServer")).toEqual({ where: { id: "x" } });
  });

  it("TenantVpnServer tetap difilter ke tenant aktif", async () => {
    expect(JSON.stringify(await findMany("TenantVpnServer"))).toContain(
      '"tenantId":"tenant-1"',
    );
  });

  it("setiap model VPN di-ignore atau punya kolom tenantId", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    for (const model of VPN_MODELS) {
      const body = new RegExp(`model ${model} \\{([^}]*)\\}`).exec(schema)?.[1];
      expect(body, `model ${model} ada di schema`).toBeDefined();
      const hasTenantId = /^\s*tenantId\s/m.test(body!);
      expect(
        hasTenantId || ignoreModels.includes(model),
        `${model} harus di-ignore atau punya tenantId`,
      ).toBe(true);
    }
  });
});
