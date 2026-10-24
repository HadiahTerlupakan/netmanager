import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prismaAuth } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { VpnServerRepository } from "@/modules/network/repositories/VpnServerRepository";

/** Dilewati tanpa `TEST_DATABASE_URL`; Postgres sungguhan membuktikan kunci baris dan isolasi tenant. */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-append";
const TENANT_LAIN = "tenant-uji-append-lain";
const [LAMA, BARU] = ["uji-append-lama", "uji-append-baru"];

function sebagaiTenant<T>(callback: () => Promise<T>): Promise<T> {
  return runWithRequestTenantContext(
    { tenantId: TENANT, isSuperAdmin: false },
    callback,
  );
}

async function bersihkan(): Promise<void> {
  const tenants = { in: [TENANT, TENANT_LAIN] };
  await prismaAuth.mikroTikRouter.deleteMany({ where: { tenantId: tenants } });
  await prismaAuth.vpnServer.deleteMany({
    where: { id: { in: [LAMA, BARU] } },
  });
}

let urutan = 0;

async function buatRouter(
  tenantId: string,
  mode: "VPN" | "PUBLIC",
  servers: string[],
  stale = false,
): Promise<string> {
  urutan += 1;
  const router = await prismaAuth.mikroTikRouter.create({
    data: {
      id: `uji-append-r${urutan}`,
      name: `Router append ${urutan}`,
      ipAddress: `10.201.0.${urutan}`,
      apiUsername: "u",
      apiPassword: "p",
      secretRadius: "rahasia",
      updatedAt: new Date(),
      tenantId,
      connectionMode: mode,
      vpnScriptStale: stale,
      ...(mode === "VPN" ? { vpnCoreRouterId: `core-append-${urutan}` } : {}),
    },
  });
  await prismaAuth.mikroTikRouterVpnServer.createMany({
    data: servers.map((vpnServerId, priority) => ({
      routerId: router.id,
      vpnServerId,
      priority,
    })),
  });
  return router.id;
}

async function daftar(routerId: string) {
  const rows = await prismaAuth.mikroTikRouterVpnServer.findMany({
    where: { routerId },
    orderBy: { priority: "asc" },
  });
  return rows.map((r) => [r.vpnServerId, r.priority]);
}

describeDb("VpnServerRepository.appendServerToTenantRouters (DB nyata)", () => {
  beforeEach(async () => {
    await bersihkan();
    for (const id of [TENANT, TENANT_LAIN]) {
      await prismaAuth.tenant.upsert({
        where: { id },
        update: {},
        create: { id, name: id },
      });
    }
    for (const id of [LAMA, BARU]) {
      await prismaAuth.vpnServer.create({
        data: {
          id,
          name: id,
          publicHost: `${id}.example.com`,
          listenPort: 51820,
          status: "online",
        },
      });
    }
  });
  afterAll(bersihkan);

  it("menambahkan server di prioritas max+1 dan menandai router stale", async () => {
    const repo = new VpnServerRepository();
    const r1 = await buatRouter(TENANT, "VPN", [LAMA]);
    const r2 = await buatRouter(TENANT, "VPN", []);

    const changed = await sebagaiTenant(() =>
      repo.appendServerToTenantRouters(TENANT, BARU, ["WIREGUARD"]),
    );

    expect(changed).toBe(2);
    expect(await daftar(r1)).toEqual([
      [LAMA, 0],
      [BARU, 1],
    ]);
    expect(await daftar(r2)).toEqual([[BARU, 0]]);
    const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
      where: { id: r1 },
    });
    expect(row.vpnScriptStale).toBe(true);
  });

  it("panggilan kedua mengembalikan 0 dan tidak mengubah router yang sudah memakainya", async () => {
    const repo = new VpnServerRepository();
    const sudah = await buatRouter(TENANT, "VPN", [BARU, LAMA]);

    expect(
      await sebagaiTenant(() =>
        repo.appendServerToTenantRouters(TENANT, BARU, ["WIREGUARD"]),
      ),
    ).toBe(0);

    expect(await daftar(sudah)).toEqual([
      [BARU, 0],
      [LAMA, 1],
    ]);
    const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
      where: { id: sudah },
    });
    expect(row.vpnScriptStale).toBe(false);
  });

  it("melewati router L2TP bila server hanya melayani WireGuard", async () => {
    const repo = new VpnServerRepository();
    const wg = await buatRouter(TENANT, "VPN", [LAMA]);
    const l2tp = await buatRouter(TENANT, "VPN", [LAMA]);
    await prismaAuth.mikroTikRouter.update({
      where: { id: l2tp },
      data: { vpnProtocol: "L2TP" },
    });

    const changed = await sebagaiTenant(() =>
      repo.appendServerToTenantRouters(TENANT, BARU, ["WIREGUARD"]),
    );

    expect(changed).toBe(1);
    expect(await daftar(wg)).toEqual([
      [LAMA, 0],
      [BARU, 1],
    ]);
    expect(await daftar(l2tp)).toEqual([[LAMA, 0]]);
  });

  it("tidak menyentuh router PUBLIC maupun router tenant lain", async () => {
    const repo = new VpnServerRepository();
    const publik = await buatRouter(TENANT, "PUBLIC", []);
    const lain = await buatRouter(TENANT_LAIN, "VPN", [LAMA]);
    await buatRouter(TENANT, "VPN", [LAMA]);

    const changed = await sebagaiTenant(() =>
      repo.appendServerToTenantRouters(TENANT, BARU, ["WIREGUARD"]),
    );

    expect(changed).toBe(1);
    expect(await daftar(publik)).toEqual([]);
    expect(await daftar(lain)).toEqual([[LAMA, 0]]);
  });
});
