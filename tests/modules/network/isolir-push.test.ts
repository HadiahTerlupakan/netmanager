import { beforeEach, describe, expect, it, vi } from "vitest";

type RouterFixture = {
  id: string;
  name: string;
  tenantId: string | null;
  isolirMode: "ROUTER_PAGE" | "REDIRECT";
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  isolirPageHash: string | null;
};

const mocks = vi.hoisted(() => ({
  routers: [] as RouterFixture[],
  findMany: vi.fn(),
  update: vi.fn(),
  resolveIsolirContent: vi.fn(),
  connect: vi.fn(),
  contextDuringQuery: [] as unknown[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mikroTikRouter: { findMany: mocks.findMany, update: mocks.update },
  },
}));
// Setup global memalsukan tenant-context; di sini konteks sistem yang asli
// dipakai supaya tes bisa memastikan query berjalan di dalamnya.
vi.mock("@/lib/tenant-context", async () =>
  vi.importActual("@/lib/tenant-context"),
);
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: mocks.resolveIsolirContent,
}));
vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
  runProvisioningConnection: mocks.connect,
}));

import { getTenantIdFromContext } from "@/lib/tenant-context";
import { pushIsolirPageToTenantRouters } from "@/modules/network/isolir/isolir-push";
import { renderIsolirPage } from "@/modules/network/isolir/isolir-render";
import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";

const content: IsolirContent = {
  ispName: "Net Tenant",
  title: "Layanan Internet Anda Sedang Diisolir",
  message: "Silakan bayar.",
  logoDataUri: null,
  payments: [],
  whatsapp: null,
  link: null,
  contactText: null,
  primaryColor: "#1d4ed8",
};
const { html, hash } = renderIsolirPage(content);

function router(overrides: Partial<RouterFixture>): RouterFixture {
  return {
    id: "r1",
    name: "Router 1",
    tenantId: "t1",
    isolirMode: "ROUTER_PAGE",
    ipAddress: "10.0.0.1",
    apiPort: 8728,
    apiUsername: "admin",
    apiPassword: "rahasia",
    apiUsernameGenerated: null,
    apiPasswordGenerated: null,
    isolirPageHash: null,
    ...overrides,
  };
}

/** Koneksi palsu: file halaman sudah ada, jadi penulisan memakai /file/set. */
function fakeConnection(log: string[], ip: string) {
  return {
    write: vi.fn(async (command: string, args: string[] = []) => {
      log.push(`${ip} ${command}`);
      if (command === "/file/print") {
        return [{ ".id": "*1", name: "webproxy/error.html", contents: "" }];
      }
      if (command === "/file/set") {
        expect(args).toContain(`=contents=${html}`);
      }
      return [];
    }),
  };
}

describe("pushIsolirPageToTenantRouters", () => {
  let log: string[];

  beforeEach(() => {
    log = [];
    mocks.contextDuringQuery = [];
    mocks.findMany.mockReset();
    mocks.update.mockReset();
    mocks.connect.mockReset();
    mocks.resolveIsolirContent.mockReset();
    mocks.resolveIsolirContent.mockResolvedValue(content);
    mocks.update.mockResolvedValue({});
    mocks.findMany.mockImplementation(
      async (args: { where: { tenantId: string; isolirMode: string } }) => {
        mocks.contextDuringQuery.push(await getTenantIdFromContext());
        return mocks.routers.filter(
          (r) =>
            r.tenantId === args.where.tenantId &&
            r.isolirMode === args.where.isolirMode,
        );
      },
    );
    mocks.connect.mockImplementation(
      async (params: {
        routerDetails: { ip: string };
        operation: (connection: unknown) => Promise<unknown>;
      }) => {
        log.push(`${params.routerDetails.ip} connect`);
        try {
          return await params.operation(
            fakeConnection(log, params.routerDetails.ip),
          );
        } finally {
          log.push(`${params.routerDetails.ip} close`);
        }
      },
    );
  });

  it("hanya mengirim ke router ROUTER_PAGE milik tenant itu", async () => {
    mocks.routers = [
      router({ id: "mine", ipAddress: "10.0.0.1" }),
      router({ id: "other", tenantId: "t2", ipAddress: "10.0.0.2" }),
      router({ id: "redir", isolirMode: "REDIRECT", ipAddress: "10.0.0.3" }),
    ];

    const summary = await pushIsolirPageToTenantRouters("t1");

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", isolirMode: "ROUTER_PAGE" },
      }),
    );
    const selected = mocks.findMany.mock.calls[0][0].select;
    expect(selected).not.toHaveProperty("pingStatus");
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.connect.mock.calls[0][0].routerDetails.ip).toBe("10.0.0.1");
    expect(summary).toEqual({ total: 1, sent: 1, skipped: 0, failed: [] });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "mine" },
      data: {
        isolirPageHash: hash,
        isolirPageError: null,
        isolirPageSyncedAt: expect.any(Date),
      },
    });
  });

  it("berjalan dalam konteks sistem karena dipanggil setelah respons HTTP", async () => {
    mocks.routers = [];
    await pushIsolirPageToTenantRouters("t1");
    expect(mocks.contextDuringQuery).toEqual([
      { tenantId: null, isSuperAdmin: true },
    ]);
  });

  it("melewati router yang hash halamannya sudah sama", async () => {
    mocks.routers = [
      router({ id: "same", isolirPageHash: hash, ipAddress: "10.0.0.1" }),
      router({ id: "old", isolirPageHash: "lama", ipAddress: "10.0.0.2" }),
    ];

    const summary = await pushIsolirPageToTenantRouters("t1");

    expect(summary).toEqual({ total: 2, sent: 1, skipped: 1, failed: [] });
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.connect.mock.calls[0][0].routerDetails.ip).toBe("10.0.0.2");
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0].where).toEqual({ id: "old" });
  });

  it("router yang gagal dicatat dan router berikutnya tetap dikirimi", async () => {
    mocks.routers = [
      router({ id: "down", ipAddress: "10.0.0.1" }),
      router({ id: "up", ipAddress: "10.0.0.2" }),
    ];
    mocks.connect.mockImplementationOnce(async () => {
      throw new Error("Timed out after 10 seconds");
    });

    const summary = await pushIsolirPageToTenantRouters("t1");

    expect(summary).toEqual({
      total: 2,
      sent: 1,
      skipped: 0,
      failed: [{ routerId: "down", error: "Timed out after 10 seconds" }],
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "down" },
      data: {
        isolirPageHash: null,
        isolirPageError: "Timed out after 10 seconds",
      },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "up" },
      data: expect.objectContaining({ isolirPageHash: hash }),
    });
  });

  it("mengirim berurutan, satu koneksi per router", async () => {
    mocks.routers = [
      router({ id: "a", ipAddress: "10.0.0.1" }),
      router({ id: "b", ipAddress: "10.0.0.2" }),
    ];

    await pushIsolirPageToTenantRouters("t1");

    const lifecycle = log.filter((l) => /connect|close/.test(l));
    expect(lifecycle).toEqual([
      "10.0.0.1 connect",
      "10.0.0.1 close",
      "10.0.0.2 connect",
      "10.0.0.2 close",
    ]);
    expect(log).toContain("10.0.0.1 /file/set");
    expect(log).toContain("10.0.0.2 /file/set");
  });

  it("memakai user API generated bila ada, selain itu kredensial manual", async () => {
    mocks.routers = [
      router({
        id: "gen",
        ipAddress: "10.0.0.1",
        apiPort: 8729,
        apiUsernameGenerated: "netmanager-api",
        apiPasswordGenerated: "acak",
      }),
      router({ id: "manual", ipAddress: "10.0.0.2" }),
    ];

    await pushIsolirPageToTenantRouters("t1");

    expect(mocks.connect.mock.calls.map((c) => c[0].routerDetails)).toEqual([
      {
        ip: "10.0.0.1",
        port: 8729,
        username: "netmanager-api",
        password: "acak",
      },
      { ip: "10.0.0.2", port: 8728, username: "admin", password: "rahasia" },
    ]);
  });
});
