import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const radiusFake = vi.hoisted(() => ({
  nas: new Map<string, { id: number; nasname: string }>(),
}));

// Basis data RADIUS terpisah dan di luar cakupan: hanya repositori RADIUS yang
// ditiru, supaya yang dibuktikan di sini adalah SQL router/VPN di Postgres.
vi.mock("@/modules/network/repositories/RadiusRepository", () => {
  class RadiusRepository {
    async getNasByIp(ip: string) {
      return radiusFake.nas.get(ip) ?? null;
    }
    async updateNas(id: number, data: { nasname: string }) {
      for (const [ip, row] of radiusFake.nas) {
        if (row.id === id) radiusFake.nas.delete(ip);
      }
      radiusFake.nas.set(data.nasname, { id, nasname: data.nasname });
    }
    async createNas(data: { nasname: string }) {
      radiusFake.nas.set(data.nasname, {
        id: radiusFake.nas.size + 1,
        nasname: data.nasname,
      });
    }
  }
  return { RadiusRepository, default: RadiusRepository };
});

const coreMock = vi.hoisted(() => ({
  getRouter: vi.fn(),
  setRouterHubs: vi.fn(),
  routerScript: vi.fn(),
}));

vi.mock("@/modules/network/vpn/VpnCoreClient", async (importActual) => ({
  ...(await importActual<object>()),
  getVpnCoreClient: () => coreMock,
}));

import { prismaAuth } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";
import { MikroTikRouterVpnMigrationRepository } from "@/modules/network/repositories/MikroTikRouterVpnMigrationRepository";
import { MikroTikRouterVpnRepository } from "@/modules/network/repositories/MikroTikRouterVpnRepository";
import { VpnCoreRouterTombstoneRepository } from "@/modules/network/repositories/VpnCoreRouterTombstoneRepository";
import { VpnServerRepository } from "@/modules/network/repositories/VpnServerRepository";
import { VpnRouterService } from "@/modules/network/services/VpnRouterService";
import { VpnRouterBusyError } from "@/modules/network/vpn/errors";
import type { VpnMigrationRouterRecord } from "@/modules/network/domain/ports/IVpnRouterMigrationRepository";

/**
 * Tes integrasi terhadap Postgres sungguhan untuk integrasi VPN. Tiruan Prisma
 * tidak bisa membuktikan unique, urutan prioritas, kunci baris, atau isolasi
 * tenant lewat ekstensi. Dilewati tanpa `TEST_DATABASE_URL`.
 */
const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const TENANT = "tenant-uji-vpn";
const TENANT_LAIN = "tenant-uji-vpn-lain";
const SERVERS = ["uji-vpn-a", "uji-vpn-b", "uji-vpn-c"];
const SERVER_LAIN = "uji-vpn-lain";
const TOMBSTONES = ["uji-tomb-1", "uji-tomb-2"];

function sebagaiTenant<T>(
  callback: () => Promise<T>,
  tenantId = TENANT,
): Promise<T> {
  return runWithRequestTenantContext(
    { tenantId, isSuperAdmin: false },
    callback,
  );
}

async function bersihkan(): Promise<void> {
  const tenants = { in: [TENANT, TENANT_LAIN] };
  await prismaAuth.mikroTikRouter.deleteMany({ where: { tenantId: tenants } });
  await prismaAuth.tenantVpnServer.deleteMany({ where: { tenantId: tenants } });
  await prismaAuth.vpnServer.deleteMany({
    where: { id: { in: [...SERVERS, SERVER_LAIN] } },
  });
  await prismaAuth.vpnCoreRouterTombstone.deleteMany({
    where: { coreRouterId: { in: TOMBSTONES } },
  });
  radiusFake.nas.clear();
}

async function siapkan(): Promise<void> {
  await bersihkan();
  for (const id of [TENANT, TENANT_LAIN]) {
    await prismaAuth.tenant.upsert({
      where: { id },
      update: {},
      create: { id, name: id },
    });
  }
  for (const id of [...SERVERS, SERVER_LAIN]) {
    await prismaAuth.vpnServer.create({
      data: {
        id,
        name: id.toUpperCase(),
        publicHost: `${id}.example.com`,
        listenPort: 51820,
        status: "online",
      },
    });
  }
  await prismaAuth.tenantVpnServer.createMany({
    data: [
      ...SERVERS.map((vpnServerId) => ({ tenantId: TENANT, vpnServerId })),
      { tenantId: TENANT_LAIN, vpnServerId: SERVER_LAIN },
    ],
  });
}

let urutan = 0;

function dataRouter(overrides: Record<string, unknown> = {}) {
  urutan += 1;
  return {
    name: `Router uji ${urutan}`,
    ipAddress: `10.200.0.${urutan}`,
    apiUsername: "u",
    apiPassword: "p",
    secretRadius: "rahasia",
    tenantId: TENANT,
    ...overrides,
  };
}

function vpnData(coreId: string, overrides: Record<string, unknown> = {}) {
  return dataRouter({
    connectionMode: "VPN" as const,
    vpnAddress: `10.100.0.${urutan}`,
    vpnCoreRouterId: coreId,
    ...overrides,
  });
}

async function urutanServer(routerId: string): Promise<string[]> {
  const rows = await prismaAuth.mikroTikRouterVpnServer.findMany({
    where: { routerId },
    orderBy: { priority: "asc" },
  });
  return rows.map((r) => r.vpnServerId);
}

describeDb("integrasi DB nyata — VPN", () => {
  beforeEach(siapkan);
  afterAll(async () => {
    await bersihkan();
  });

  describe("MikroTikRouterRepository.create", () => {
    it("menyimpan router VPN dengan daftar server berurutan prioritas", async () => {
      const repo = new MikroTikRouterRepository();
      const urut = [SERVERS[2], SERVERS[0], SERVERS[1]];

      const { id } = await sebagaiTenant(() =>
        repo.create(vpnData("core-uji-1"), urut),
      );

      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      expect(row.connectionMode).toBe("VPN");
      expect(row.vpnCoreRouterId).toBe("core-uji-1");
      expect(await urutanServer(id)).toEqual(urut);
      const prioritas = await prismaAuth.mikroTikRouterVpnServer.findMany({
        where: { routerId: id },
        orderBy: { priority: "asc" },
      });
      expect(prioritas.map((r) => r.priority)).toEqual([0, 1, 2]);
    });

    it("menolak router kedua dengan vpnCoreRouterId yang sama dan tidak meninggalkan sisa", async () => {
      const repo = new MikroTikRouterRepository();
      await sebagaiTenant(() =>
        repo.create(vpnData("core-uji-dup"), [SERVERS[0]]),
      );

      await expect(
        sebagaiTenant(() => repo.create(vpnData("core-uji-dup"), [SERVERS[1]])),
      ).rejects.toMatchObject({ code: "P2002" });

      expect(
        await prismaAuth.mikroTikRouter.count({
          where: { vpnCoreRouterId: "core-uji-dup" },
        }),
      ).toBe(1);
      expect(
        await prismaAuth.mikroTikRouterVpnServer.count({
          where: { vpnServerId: SERVERS[1] },
        }),
      ).toBe(0);
    });
  });

  describe("isolasi tenant", () => {
    it("TenantVpnServer dari konteks tenant hanya mengembalikan server tenant itu", async () => {
      const repo = new VpnServerRepository();

      const milikTenant = await sebagaiTenant(() => repo.tenantServers(TENANT));
      const milikLain = await sebagaiTenant(
        () => repo.tenantServers(TENANT_LAIN),
        TENANT_LAIN,
      );

      expect(milikTenant.map((s) => s.id).sort()).toEqual(SERVERS);
      expect(milikLain.map((s) => s.id)).toEqual([SERVER_LAIN]);
      const dicobaLintas = await sebagaiTenant(
        async () => await repo.tenantServerIds(TENANT_LAIN),
      );
      expect(dicobaLintas).not.toContain(SERVER_LAIN);
    });

    it("daftar server router tenant lain tidak terbaca lewat repositori", async () => {
      const routerRepo = new MikroTikRouterRepository();
      const vpnRepo = new MikroTikRouterVpnRepository();
      const { id } = await sebagaiTenant(() =>
        routerRepo.create(vpnData("core-uji-iso"), [SERVERS[0], SERVERS[1]]),
      );

      const sendiri = await sebagaiTenant(() =>
        vpnRepo.listServers(id, TENANT),
      );
      const orangLain = await sebagaiTenant(
        () => vpnRepo.listServers(id, TENANT_LAIN),
        TENANT_LAIN,
      );

      expect(sendiri.map((s) => s.id)).toEqual([SERVERS[0], SERVERS[1]]);
      expect(orangLain).toEqual([]);
      expect(
        await sebagaiTenant(
          async () => await vpnRepo.findRouter(id, TENANT_LAIN),
          TENANT_LAIN,
        ),
      ).toBeNull();
    });

    it("replaceServersAsStale tidak menulis apa pun untuk router tenant lain", async () => {
      const routerRepo = new MikroTikRouterRepository();
      const vpnRepo = new MikroTikRouterVpnRepository();
      const { id } = await sebagaiTenant(() =>
        routerRepo.create(vpnData("core-uji-iso2"), [SERVERS[0]]),
      );

      await sebagaiTenant(
        () => vpnRepo.replaceServersAsStale(id, TENANT_LAIN, [SERVERS[1]]),
        TENANT_LAIN,
      );

      expect(await urutanServer(id)).toEqual([SERVERS[0]]);
      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      expect(row.vpnScriptStale).toBe(false);
    });
  });

  describe("MikroTikRouterVpnRepository.setActiveServer", () => {
    async function aktif(id: string): Promise<string | null> {
      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      return row.vpnActiveServerId;
    }

    it("menyimpan server aktif router VPN", async () => {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(vpnData("core-uji-aktif"), [
          SERVERS[0],
        ]),
      );

      await sebagaiTenant(() =>
        new MikroTikRouterVpnRepository().setActiveServer(
          id,
          TENANT,
          SERVERS[0],
        ),
      );

      expect(await aktif(id)).toBe(SERVERS[0]);
    });

    it("tidak menulis server aktif ke router yang sudah kembali ke PUBLIC", async () => {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(dataRouter(), []),
      );

      await sebagaiTenant(() =>
        new MikroTikRouterVpnRepository().setActiveServer(
          id,
          TENANT,
          SERVERS[0],
        ),
      );

      expect(await aktif(id)).toBeNull();
    });
  });

  describe("MikroTikRouterVpnRepository.setVpnProtocol", () => {
    async function protokol(id: string) {
      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      return row.vpnProtocol;
    }

    it("menyimpan protokol router VPN milik tenant saja", async () => {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(vpnData("core-uji-protokol"), [
          SERVERS[0],
        ]),
      );
      const repo = new MikroTikRouterVpnRepository();

      await sebagaiTenant(
        () => repo.setVpnProtocol(id, TENANT_LAIN, "L2TP"),
        TENANT_LAIN,
      );
      expect(await protokol(id)).toBe("WIREGUARD");

      await sebagaiTenant(() => repo.setVpnProtocol(id, TENANT, "L2TP"));
      expect(await protokol(id)).toBe("L2TP");
    });

    it("tidak mengubah protokol router PUBLIC", async () => {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(dataRouter(), []),
      );

      await sebagaiTenant(() =>
        new MikroTikRouterVpnRepository().setVpnProtocol(id, TENANT, "L2TP"),
      );

      expect(await protokol(id)).toBe("WIREGUARD");
    });
  });

  describe("MikroTikRouterVpnMigrationRepository", () => {
    async function routerPublik(): Promise<VpnMigrationRouterRecord> {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(dataRouter()),
      );
      const repo = new MikroTikRouterVpnMigrationRepository();
      const record = await sebagaiTenant(() => repo.findRouter(id, TENANT));
      if (!record) throw new Error("router uji tidak ditemukan");
      radiusFake.nas.set(record.ipAddress, {
        id: 1,
        nasname: record.ipAddress,
      });
      return record;
    }

    it("PUBLIC -> VPN -> PUBLIC mengembalikan kolom dan membersihkan baris server", async () => {
      const repo = new MikroTikRouterVpnMigrationRepository();
      const awal = await routerPublik();

      await sebagaiTenant(() =>
        repo.switchToVpn(awal, {
          tunnelAddress: "10.100.9.9",
          coreRouterId: "core-uji-mig",
          vpnProtocol: "WIREGUARD",
          serverIds: [SERVERS[1], SERVERS[0]],
        }),
      );

      const vpn = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id: awal.id },
      });
      expect(vpn).toMatchObject({
        connectionMode: "VPN",
        ipAddress: "10.100.9.9",
        vpnAddress: "10.100.9.9",
        publicIpAddress: awal.ipAddress,
        vpnCoreRouterId: "core-uji-mig",
        vpnActiveServerId: null,
        vpnScriptStale: false,
      });
      expect(await urutanServer(awal.id)).toEqual([SERVERS[1], SERVERS[0]]);
      expect(radiusFake.nas.has("10.100.9.9")).toBe(true);

      const diVpn = await sebagaiTenant(() => repo.findRouter(awal.id, TENANT));
      await sebagaiTenant(() => repo.switchToPublic(diVpn!));

      const publik = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id: awal.id },
      });
      expect(publik).toMatchObject({
        connectionMode: "PUBLIC",
        ipAddress: awal.ipAddress,
        publicIpAddress: null,
        vpnAddress: null,
        vpnCoreRouterId: null,
      });
      expect(await urutanServer(awal.id)).toEqual([]);
      expect(radiusFake.nas.has(awal.ipAddress)).toBe(true);
    });

    it("switchToVpn kedua pada router yang sudah VPN melempar VpnRouterBusyError dan tidak mengubah apa pun", async () => {
      const repo = new MikroTikRouterVpnMigrationRepository();
      const awal = await routerPublik();
      const change = {
        tunnelAddress: "10.100.9.10",
        coreRouterId: "core-uji-busy",
        vpnProtocol: "WIREGUARD" as const,
        serverIds: [SERVERS[0]],
      };
      await sebagaiTenant(() => repo.switchToVpn(awal, change));

      await expect(
        sebagaiTenant(() =>
          repo.switchToVpn(awal, {
            ...change,
            tunnelAddress: "10.100.9.11",
            coreRouterId: "core-uji-busy-2",
            vpnProtocol: "WIREGUARD",
            serverIds: [SERVERS[2]],
          }),
        ),
      ).rejects.toBeInstanceOf(VpnRouterBusyError);

      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id: awal.id },
      });
      expect(row.vpnCoreRouterId).toBe("core-uji-busy");
      expect(row.ipAddress).toBe("10.100.9.10");
      expect(await urutanServer(awal.id)).toEqual([SERVERS[0]]);
    });

    it("switchToPublic pada router yang sudah PUBLIC melempar VpnRouterBusyError", async () => {
      const repo = new MikroTikRouterVpnMigrationRepository();
      const awal = await routerPublik();

      await expect(
        sebagaiTenant(() =>
          repo.switchToPublic({ ...awal, publicIpAddress: "203.0.113.5" }),
        ),
      ).rejects.toBeInstanceOf(VpnRouterBusyError);
    });
  });

  describe("compare-and-set pengiriman skrip (I5)", () => {
    const vpnRepo = new MikroTikRouterVpnRepository();
    const writer = { writeSwitchScript: vi.fn(), writeFirstServer: vi.fn() };

    async function siapkanService() {
      const { id } = await sebagaiTenant(() =>
        new MikroTikRouterRepository().create(vpnData("core-uji-cas"), [
          SERVERS[0],
          SERVERS[1],
        ]),
      );
      coreMock.getRouter.mockResolvedValue({
        id: "core-uji-cas",
        hubs: [
          { hubId: SERVERS[0], priority: 0 },
          { hubId: SERVERS[1], priority: 1 },
          { hubId: SERVERS[2], priority: 2 },
        ],
      });
      coreMock.setRouterHubs.mockResolvedValue(undefined);
      coreMock.routerScript.mockResolvedValue("script");
      const service = new VpnRouterService(
        vpnRepo,
        new VpnServerRepository(),
        writer,
      );
      return { id, service };
    }

    beforeEach(() => {
      vi.clearAllMocks();
      writer.writeSwitchScript.mockResolvedValue(undefined);
    });

    it("menyelesaikan transaksi dengan kunci baris, memanggil core dan menurunkan flag stale", async () => {
      const { id, service } = await siapkanService();
      const baru = [SERVERS[1], SERVERS[0]];

      const hasil = await sebagaiTenant(() =>
        service.updateServers(id, TENANT, baru),
      );

      expect(hasil).toEqual({ scriptStale: false });
      expect(await urutanServer(id)).toEqual(baru);
      expect(coreMock.setRouterHubs).toHaveBeenLastCalledWith(
        "core-uji-cas",
        baru,
      );
      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      expect(row.vpnScriptStale).toBe(false);
    });

    it("melewati finalize dan membiarkan stale bila daftar diganti request lain di tengah pengiriman", async () => {
      const { id, service } = await siapkanService();
      const kiriman = [SERVERS[1], SERVERS[0]];
      const pemenang = [SERVERS[2]];
      writer.writeSwitchScript.mockImplementation(async () => {
        await vpnRepo.replaceServersAsStale(id, TENANT, pemenang);
      });

      const hasil = await sebagaiTenant(() =>
        service.updateServers(id, TENANT, kiriman),
      );

      expect(hasil).toEqual({ scriptStale: true });
      expect(await urutanServer(id)).toEqual(pemenang);
      const row = await prismaAuth.mikroTikRouter.findUniqueOrThrow({
        where: { id },
      });
      expect(row.vpnScriptStale).toBe(true);
      expect(coreMock.setRouterHubs).not.toHaveBeenCalledWith(
        "core-uji-cas",
        kiriman,
      );
    });

    it("completeScriptSend mengembalikan false tanpa menjalankan finalize untuk router tenant lain", async () => {
      const { id } = await siapkanService();
      const finalize = vi.fn();

      const hasil = await sebagaiTenant(
        () =>
          vpnRepo.completeScriptSend(id, TENANT_LAIN, [SERVERS[0]], finalize),
        TENANT_LAIN,
      );

      expect(hasil).toBe(false);
      expect(finalize).not.toHaveBeenCalled();
    });
  });

  describe("kunci daftar server per router (I5)", () => {
    const vpnRepo = new MikroTikRouterVpnRepository();
    const ROUTER_KUNCI = "uji-kunci-1";
    const ROUTER_KUNCI_LAIN = "uji-kunci-2";

    // Memegang kunci router sampai `lepas` dipanggil; `masuk` selesai saat fn berjalan.
    function tahanKunci(routerId: string) {
      let lepas!: () => void;
      let tandaiMasuk!: () => void;
      const dilepas = new Promise<void>((resolve) => (lepas = resolve));
      const masuk = new Promise<void>((resolve) => (tandaiMasuk = resolve));
      const hasil = vpnRepo.withServerListLock(routerId, async () => {
        tandaiMasuk();
        await dilepas;
        return "pemegang";
      });
      return { hasil, masuk, lepas };
    }

    it("hanya satu dari dua pengiriman bersamaan pada router yang sama mendapat kunci", async () => {
      const pertama = tahanKunci(ROUTER_KUNCI);
      await pertama.masuk;
      const fnKedua = vi.fn(async () => "kedua");

      const kedua = await vpnRepo.withServerListLock(ROUTER_KUNCI, fnKedua);
      pertama.lepas();

      expect(kedua).toEqual({ acquired: false });
      expect(fnKedua).not.toHaveBeenCalled();
      expect(await pertama.hasil).toEqual({
        acquired: true,
        value: "pemegang",
      });
    });

    it("router berbeda mendapat kuncinya masing-masing", async () => {
      const pertama = tahanKunci(ROUTER_KUNCI);
      await pertama.masuk;

      const lain = await vpnRepo.withServerListLock(
        ROUTER_KUNCI_LAIN,
        async () => "lain",
      );
      pertama.lepas();

      expect(lain).toEqual({ acquired: true, value: "lain" });
      expect((await pertama.hasil).acquired).toBe(true);
    });

    // Dibaca dari koneksi lain: kunci level sesi yang bocor ke pool tetap terlihat.
    async function jumlahKunci(routerId: string): Promise<number> {
      const [row] = await prismaAuth.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_locks
        WHERE locktype = 'advisory' AND granted AND objsubid = 1
          AND ((classid::bigint << 32) | objid::bigint)
            = hashtextextended('vpn-server-list:' || ${routerId}, 0)`;
      return row.n;
    }

    it("melepas kunci saat fn melempar", async () => {
      let terpegang = -1;
      await expect(
        vpnRepo.withServerListLock(ROUTER_KUNCI, async () => {
          terpegang = await jumlahKunci(ROUTER_KUNCI);
          throw new Error("router gagal");
        }),
      ).rejects.toThrow("router gagal");

      expect(terpegang).toBe(1);
      expect(await jumlahKunci(ROUTER_KUNCI)).toBe(0);

      await expect(
        vpnRepo.withServerListLock(ROUTER_KUNCI, async () => "lagi"),
      ).resolves.toEqual({ acquired: true, value: "lagi" });
      expect(await jumlahKunci(ROUTER_KUNCI)).toBe(0);
    });
  });

  describe("VpnCoreRouterTombstoneRepository", () => {
    it("menambah, mendaftar, dan menghapus di luar konteks tenant (jalur monitor)", async () => {
      const repo = new VpnCoreRouterTombstoneRepository();

      await repo.add(TOMBSTONES[0]);
      await repo.add(TOMBSTONES[0]);
      await repo.add(TOMBSTONES[1]);

      const daftar = (await repo.listOldest(1000)).filter((id) =>
        TOMBSTONES.includes(id),
      );
      expect(daftar).toEqual(TOMBSTONES);
      expect(await repo.has(TOMBSTONES[0])).toBe(true);

      await repo.remove(TOMBSTONES[0]);
      await repo.remove(TOMBSTONES[0]);

      expect(await repo.has(TOMBSTONES[0])).toBe(false);
      expect(await repo.has(TOMBSTONES[1])).toBe(true);
    });
  });
});
