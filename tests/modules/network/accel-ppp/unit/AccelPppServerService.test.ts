import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccelPppServerService } from "@/modules/network/services/accel-ppp/AccelPppServerService";
import {
  AccelPppRadiusNasSyncError,
  AccelPppServerNotFoundError,
  AccelPppSessionNotFoundError,
  AccelPppCliCommandError,
} from "@/modules/network/domain/errors/AccelPppErrors";
import type { AccelPppServerEntity } from "@/modules/network/domain/entities/AccelPppServerEntity";

const TENANT_ID = "tenant-1";

function buildServer(
  overrides: Partial<AccelPppServerEntity> = {},
): AccelPppServerEntity {
  return {
    id: "srv-1",
    name: "ACCEL-PPP A",
    ipAddress: "10.0.0.1",
    description: "edge",
    nasIdentifier: null,
    radiusSecret: "plaintext-secret",
    authPort: 1812,
    acctPort: 1813,
    coaPort: 3799,
    cliHost: "10.0.0.1",
    cliPort: 2001,
    cliPassword: null,
    pingStatus: "offline",
    userOnline: 0,
    lastStatusCheck: null,
    siteId: null,
    tenantId: TENANT_ID,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function buildServerRepo() {
  return {
    findAll: vi.fn(),
    findWithFilters: vi.fn(),
    findById: vi.fn(),
    findByIp: vi.fn(),
    findAllForMonitor: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

function buildRadiusNasRepo() {
  return {
    createNas: vi.fn(),
    updateNas: vi.fn(),
    deleteNas: vi.fn(),
    getNasById: vi.fn(),
    getAllNas: vi.fn(),
    getNasByIp: vi.fn(),
  };
}

function buildRadiusClient(activeCount = 0) {
  return {
    radacct: {
      count: vi.fn().mockResolvedValue(activeCount),
    },
  };
}

function buildCliClient() {
  return {
    ping: vi.fn().mockResolvedValue("pong"),
    sendCommand: vi.fn().mockResolvedValue(""),
    showSessions: vi.fn().mockResolvedValue([]),
    showStat: vi.fn().mockResolvedValue({
      cpuPercent: 0,
      activeSessions: 0,
      startingSessions: 0,
      finishingSessions: 0,
      raw: {},
    }),
    terminateByUsername: vi.fn(),
  };
}

describe("AccelPppServerService.create", () => {
  let serverRepo: ReturnType<typeof buildServerRepo>;
  let radiusNasRepo: ReturnType<typeof buildRadiusNasRepo>;
  let radiusClient: ReturnType<typeof buildRadiusClient>;
  let cliClient: ReturnType<typeof buildCliClient>;
  let service: AccelPppServerService;

  beforeEach(() => {
    serverRepo = buildServerRepo();
    radiusNasRepo = buildRadiusNasRepo();
    radiusClient = buildRadiusClient();
    cliClient = buildCliClient();
    service = new AccelPppServerService(
      serverRepo as never,
      radiusNasRepo as never,
      radiusClient as never,
      () => cliClient as never,
    );
  });

  it("happy path: tulis ke Prisma + sync NAS", async () => {
    const created = buildServer();
    serverRepo.create.mockResolvedValue(created);
    radiusNasRepo.createNas.mockResolvedValue({ id: 99 });

    const result = await service.create(
      {
        name: "ACCEL-PPP A",
        ipAddress: "10.0.0.1",
        radiusSecret: "plaintext-secret",
        cliHost: "10.0.0.1",
        tenantId: TENANT_ID,
      },
      "user-1",
    );

    expect(result).toEqual(created);
    expect(serverRepo.create).toHaveBeenCalledOnce();
    expect(radiusNasRepo.createNas).toHaveBeenCalledWith(
      expect.objectContaining({
        nasname: "10.0.0.1",
        secret: "plaintext-secret",
      }),
      TENANT_ID,
    );
    expect(serverRepo.delete).not.toHaveBeenCalled();
  });

  it("rollback Prisma kalau RADIUS NAS sync gagal", async () => {
    const created = buildServer();
    serverRepo.create.mockResolvedValue(created);
    radiusNasRepo.createNas.mockRejectedValue(new Error("connection lost"));

    await expect(
      service.create(
        {
          name: "ACCEL-PPP A",
          ipAddress: "10.0.0.1",
          radiusSecret: "plaintext-secret",
          cliHost: "10.0.0.1",
          tenantId: TENANT_ID,
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(AccelPppRadiusNasSyncError);

    expect(serverRepo.delete).toHaveBeenCalledWith(created.id, TENANT_ID);
  });

  it("throw bila tenantId tidak ada — NAS multi-tenant butuh tenantId", async () => {
    const created = buildServer({ tenantId: null });
    serverRepo.create.mockResolvedValue(created);

    await expect(
      service.create(
        {
          name: "ACCEL-PPP A",
          ipAddress: "10.0.0.1",
          radiusSecret: "plaintext-secret",
          cliHost: "10.0.0.1",
          tenantId: null,
        },
        "user-1",
      ),
    ).rejects.toBeInstanceOf(AccelPppRadiusNasSyncError);

    expect(serverRepo.delete).toHaveBeenCalledWith(created.id, null);
    expect(radiusNasRepo.createNas).not.toHaveBeenCalled();
  });
});

describe("AccelPppServerService.delete", () => {
  it("blok delete kalau ada session aktif tanpa force", async () => {
    const serverRepo = buildServerRepo();
    const radiusNasRepo = buildRadiusNasRepo();
    const radiusClient = buildRadiusClient(3);
    const cliClient = buildCliClient();
    const service = new AccelPppServerService(
      serverRepo as never,
      radiusNasRepo as never,
      radiusClient as never,
      () => cliClient as never,
    );

    serverRepo.findById.mockResolvedValue(buildServer());

    await expect(
      service.delete("srv-1", TENANT_ID, "user-1"),
    ).rejects.toBeInstanceOf(AccelPppCliCommandError);

    expect(serverRepo.delete).not.toHaveBeenCalled();
    expect(radiusClient.radacct.count).toHaveBeenCalledWith({
      where: {
        acctstoptime: null,
        nasipaddress: "10.0.0.1",
        tenantId: TENANT_ID,
      },
    });
  });

  it("delete sukses dengan force walau ada session aktif", async () => {
    const serverRepo = buildServerRepo();
    const radiusNasRepo = buildRadiusNasRepo();
    const radiusClient = buildRadiusClient(5);
    const cliClient = buildCliClient();
    const service = new AccelPppServerService(
      serverRepo as never,
      radiusNasRepo as never,
      radiusClient as never,
      () => cliClient as never,
    );

    serverRepo.findById.mockResolvedValue(buildServer());
    radiusNasRepo.getNasByIp.mockResolvedValue({ id: 99 });

    await service.delete("srv-1", TENANT_ID, "user-1", { force: true });

    expect(serverRepo.delete).toHaveBeenCalledWith("srv-1", TENANT_ID);
    expect(radiusNasRepo.deleteNas).toHaveBeenCalledWith(99, TENANT_ID);
  });

  it("404 bila server tidak ada", async () => {
    const serverRepo = buildServerRepo();
    const service = new AccelPppServerService(
      serverRepo as never,
      buildRadiusNasRepo() as never,
      buildRadiusClient() as never,
      () => buildCliClient() as never,
    );

    serverRepo.findById.mockResolvedValue(null);

    await expect(
      service.delete("missing", TENANT_ID, "user-1"),
    ).rejects.toBeInstanceOf(AccelPppServerNotFoundError);
  });
});

describe("AccelPppServerService.kickSession", () => {
  it("kick sukses → return result terminated true", async () => {
    const serverRepo = buildServerRepo();
    const cliClient = buildCliClient();
    cliClient.terminateByUsername.mockResolvedValue({
      terminated: true,
      notFound: false,
      message: "terminated",
    });
    serverRepo.findById.mockResolvedValue(buildServer());

    const service = new AccelPppServerService(
      serverRepo as never,
      buildRadiusNasRepo() as never,
      buildRadiusClient() as never,
      () => cliClient as never,
    );

    const res = await service.kickSession("srv-1", "budi", TENANT_ID, "user-1");
    expect(res.terminated).toBe(true);
  });

  it("notFound → throw AccelPppSessionNotFoundError", async () => {
    const serverRepo = buildServerRepo();
    const cliClient = buildCliClient();
    cliClient.terminateByUsername.mockResolvedValue({
      terminated: false,
      notFound: true,
      message: "no sessions",
    });
    serverRepo.findById.mockResolvedValue(buildServer());

    const service = new AccelPppServerService(
      serverRepo as never,
      buildRadiusNasRepo() as never,
      buildRadiusClient() as never,
      () => cliClient as never,
    );

    await expect(
      service.kickSession("srv-1", "ghost", TENANT_ID, "user-1"),
    ).rejects.toBeInstanceOf(AccelPppSessionNotFoundError);
  });
});

describe("AccelPppServerService.update", () => {
  it("re-sync NAS bila IP berubah: hapus baris lama lalu upsert baru", async () => {
    const serverRepo = buildServerRepo();
    const radiusNasRepo = buildRadiusNasRepo();
    const before = buildServer({ ipAddress: "10.0.0.1" });
    const after = buildServer({ ipAddress: "10.0.0.2" });

    serverRepo.findById
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    radiusNasRepo.getNasByIp.mockResolvedValue({ id: 77 });

    const service = new AccelPppServerService(
      serverRepo as never,
      radiusNasRepo as never,
      buildRadiusClient() as never,
      () => buildCliClient() as never,
    );

    await service.update(
      "srv-1",
      { ipAddress: "10.0.0.2" },
      TENANT_ID,
      "user-1",
    );

    expect(radiusNasRepo.deleteNas).toHaveBeenCalledWith(77, TENANT_ID);
    expect(radiusNasRepo.createNas).toHaveBeenCalledWith(
      expect.objectContaining({ nasname: "10.0.0.2" }),
      TENANT_ID,
    );
  });

  it("tidak resync NAS kalau hanya field non-NAS yang berubah", async () => {
    const serverRepo = buildServerRepo();
    const radiusNasRepo = buildRadiusNasRepo();
    const same = buildServer();

    serverRepo.findById.mockResolvedValueOnce(same).mockResolvedValueOnce(same);

    const service = new AccelPppServerService(
      serverRepo as never,
      radiusNasRepo as never,
      buildRadiusClient() as never,
      () => buildCliClient() as never,
    );

    await service.update("srv-1", { cliPort: 2002 }, TENANT_ID, "user-1");

    expect(radiusNasRepo.createNas).not.toHaveBeenCalled();
    expect(radiusNasRepo.deleteNas).not.toHaveBeenCalled();
  });
});
