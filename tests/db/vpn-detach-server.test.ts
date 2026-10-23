import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prismaAuth } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { VpnServerRepository } from "@/modules/network/repositories/VpnServerRepository";

/** Dilewati tanpa `TEST_DATABASE_URL`; Postgres sungguhan membuktikan kunci baris dan lintas tenant. */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT_A = "tenant-uji-detach-a";
const TENANT_B = "tenant-uji-detach-b";
const [TARGET, S1, S2] = [
  "uji-detach-target",
  "uji-detach-s1",
  "uji-detach-s2",
];

/** Superadmin menjalankan penghapusan lintas tenant. */
function sebagaiSuperadmin<T>(callback: () => Promise<T>): Promise<T> {
  return runWithRequestTenantContext(
    { tenantId: null, isSuperAdmin: true },
    callback,
  );
}

async function bersihkan(): Promise<void> {
  await prismaAuth.mikroTikRouter.deleteMany({
    where: { tenantId: { in: [TENANT_A, TENANT_B] } },
  });
  await prismaAuth.vpnServer.deleteMany({
    where: { id: { in: [TARGET, S1, S2] } },
  });
}

let urutan = 0;

async function buatRouter(tenantId: string, servers: string[]) {
  urutan += 1;
  const router = await prismaAuth.mikroTikRouter.create({
    data: {
      id: `uji-detach-r${urutan}`,
      name: `Router detach ${urutan}`,
      ipAddress: `10.202.0.${urutan}`,
      apiUsername: "u",
      apiPassword: "p",
      secretRadius: "rahasia",
      updatedAt: new Date(),
      tenantId,
      connectionMode: "VPN",
      vpnCoreRouterId: `core-detach-${urutan}`,
    },
  });
  await prismaAuth.mikroTikRouterVpnServer.createMany({
    data: servers.map((vpnServerId, priority) => ({
      routerId: router.id,
      vpnServerId,
      priority,
    })),
  });
  return router;
}

async function daftar(routerId: string) {
  const rows = await prismaAuth.mikroTikRouterVpnServer.findMany({
    where: { routerId },
    orderBy: { priority: "asc" },
  });
  return rows.map((r) => [r.vpnServerId, r.priority]);
}

async function stale(routerId: string) {
  const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
    where: { id: routerId },
  });
  return row.vpnScriptStale;
}

describeDb("VpnServerRepository.detachServerFromRouters (DB nyata)", () => {
  beforeEach(async () => {
    await bersihkan();
    for (const id of [TENANT_A, TENANT_B]) {
      await prismaAuth.tenant.upsert({
        where: { id },
        update: {},
        create: { id, name: `Nama ${id}` },
      });
    }
    for (const id of [TARGET, S1, S2]) {
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

  it("mengeluarkan server lintas tenant, merapatkan prioritas, dan melaporkan router satu-satunya", async () => {
    const repo = new VpnServerRepository();
    const a = await buatRouter(TENANT_A, [S1, TARGET, S2]);
    const sendiri = await buatRouter(TENANT_B, [TARGET]);
    const b = await buatRouter(TENANT_B, [TARGET, S2]);
    const tanpa = await buatRouter(TENANT_B, [S1]);

    const hasil = await sebagaiSuperadmin(() =>
      repo.detachServerFromRouters(TARGET),
    );

    expect(hasil.detached).toBe(2);
    expect(hasil.onlyServer).toEqual([
      { id: sendiri.id, name: sendiri.name, tenantName: `Nama ${TENANT_B}` },
    ]);
    expect(await daftar(a.id)).toEqual([
      [S1, 0],
      [S2, 1],
    ]);
    expect(await daftar(b.id)).toEqual([[S2, 0]]);
    expect(await daftar(sendiri.id)).toEqual([[TARGET, 0]]);
    expect(await stale(a.id)).toBe(true);
    expect(await stale(b.id)).toBe(true);
    expect(await stale(sendiri.id)).toBe(false);
    expect(await stale(tanpa.id)).toBe(false);
  });

  it("tanpa router pemakai mengembalikan nol", async () => {
    const hasil = await sebagaiSuperadmin(() =>
      new VpnServerRepository().detachServerFromRouters(TARGET),
    );
    expect(hasil).toEqual({ detached: 0, onlyServer: [] });
  });
});
