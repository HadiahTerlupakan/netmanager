import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveIsolirContent: vi.fn(),
  connection: { write: vi.fn() },
}));

vi.mock("@/modules/network/isolir/isolir-content", () => ({
  resolveIsolirContent: mocks.resolveIsolirContent,
}));
vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
  runProvisioningConnection: async (params: {
    operation: (connection: unknown) => Promise<unknown>;
  }) => params.operation(mocks.connection),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  buildIsolirPageSync,
  resolveIsolirProvisioning,
  splitIsolirTarget,
} from "@/modules/network/isolir/isolir-provisioning";
import { logger } from "@/lib/logger";
import { renderIsolirPage } from "@/modules/network/isolir/isolir-render";
import type { IsolirContent } from "@/modules/network/isolir/isolir-page.types";
import { writeIsolirPageFile } from "@/modules/network/services/mikrotik-provisioning.isolir-page";
import { MikroTikProvisioningService } from "@/modules/network/services/MikroTikProvisioningService";

const PAGE_FILE = "webproxy/error.html";

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

describe("splitIsolirTarget", () => {
  it("memisahkan host untuk address list dari host beserta path", () => {
    expect(splitIsolirTarget("http://a.b/c/d")).toEqual({
      host: "a.b",
      target: "a.b/c/d",
    });
  });

  it("membuang query dan fragment dari host maupun target", () => {
    expect(splitIsolirTarget("https://a.b/c?x=1#y")).toEqual({
      host: "a.b",
      target: "a.b/c",
    });
    expect(splitIsolirTarget("https://a.b?x=1")).toEqual({
      host: "a.b",
      target: "a.b",
    });
  });
});

describe("resolveIsolirProvisioning", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.resolveIsolirContent.mockReset();
    mocks.resolveIsolirContent.mockResolvedValue(content);
  });

  it("REDIRECT membawa host dan path tanpa skema", async () => {
    await expect(
      resolveIsolirProvisioning({
        isolirMode: "REDIRECT",
        isolirUrl: "https://isolir.x.id/abc",
        tenantId: "t1",
        connectionMode: "PUBLIC",
      }),
    ).resolves.toEqual({ mode: "REDIRECT", target: "isolir.x.id/abc" });
    expect(mocks.resolveIsolirContent).not.toHaveBeenCalled();
  });

  it("ROUTER_PAGE memakai HTML renderer dari isi tenant router", async () => {
    const result = await resolveIsolirProvisioning({
      isolirMode: "ROUTER_PAGE",
      isolirUrl: null,
      tenantId: "t1",
      connectionMode: "PUBLIC",
    });

    const rendered = renderIsolirPage(content);
    expect(result).toEqual({
      mode: "ROUTER_PAGE",
      html: rendered.html,
      hash: rendered.hash,
    });
    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith("t1");
  });

  it("ISOLIR_SERVICE pada router VPN memakai alamat core VPN", async () => {
    vi.stubEnv("VPN_CORE_ADDRESS", "10.50.0.1");

    await expect(
      resolveIsolirProvisioning({
        isolirMode: "ISOLIR_SERVICE",
        isolirUrl: null,
        tenantId: "t1",
        connectionMode: "VPN",
      }),
    ).resolves.toEqual({ mode: "ISOLIR_SERVICE", address: "10.50.0.1" });
    expect(mocks.resolveIsolirContent).not.toHaveBeenCalled();
  });

  it("ISOLIR_SERVICE pada router publik jatuh ke ROUTER_PAGE dengan peringatan", async () => {
    const result = await resolveIsolirProvisioning({
      isolirMode: "ISOLIR_SERVICE",
      isolirUrl: null,
      tenantId: "t1",
      connectionMode: "PUBLIC",
    });

    expect(result.mode).toBe("ROUTER_PAGE");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ISOLIR_SERVICE"),
    );
  });

  it.each([null, "", "   "])(
    "REDIRECT dengan URL kosong (%j) jatuh ke ROUTER_PAGE",
    async (isolirUrl) => {
      const result = await resolveIsolirProvisioning({
        isolirMode: "REDIRECT",
        isolirUrl,
        tenantId: null,
        connectionMode: "PUBLIC",
      });

      expect(result.mode).toBe("ROUTER_PAGE");
      expect(mocks.resolveIsolirContent).toHaveBeenCalledWith(null);
    },
  );
});

type FileRow = { ".id": string; name: string; contents?: string };

// /file/print mengembalikan file setelah `appearAfter` kali dibaca, meniru
// RouterOS yang membuat folder webproxy sesaat setelah reset-html.
function fakeFileRouter(file: FileRow | null, appearAfter = 0) {
  let prints = 0;
  const write = vi.fn(async (path: string) => {
    if (path !== "/file/print") return [];
    prints += 1;
    return file && prints > appearAfter ? [file] : [];
  });
  return { write };
}

function paths(router: { write: ReturnType<typeof vi.fn> }) {
  return router.write.mock.calls.map(([path]) => path);
}

describe("writeIsolirPageFile", () => {
  const html = "<html>isolir</html>";

  it("file belum ada: reset-html, tunggu file muncul, lalu set contents", async () => {
    const router = fakeFileRouter({ ".id": "*f1", name: PAGE_FILE }, 3);

    await writeIsolirPageFile(router as never, html, []);

    expect(router.write).toHaveBeenCalledWith("/file/print", [
      `?name=${PAGE_FILE}`,
    ]);
    expect(paths(router).filter((p) => p === "/ip/proxy/reset-html")).toEqual([
      "/ip/proxy/reset-html",
    ]);
    expect(router.write).toHaveBeenLastCalledWith("/file/set", [
      "=.id=*f1",
      `=contents=${html}`,
    ]);
  });

  it("file tidak pernah muncul setelah reset-html: gagal tanpa menulis", async () => {
    const router = fakeFileRouter(null);

    await expect(
      writeIsolirPageFile(router as never, html, []),
    ).rejects.toThrow(PAGE_FILE);
    expect(paths(router)).not.toContain("/file/set");
  });

  it("isi sama: tidak menulis", async () => {
    const router = fakeFileRouter({
      ".id": "*f1",
      name: PAGE_FILE,
      contents: html,
    });

    await writeIsolirPageFile(router as never, html, []);

    expect(paths(router)).toEqual(["/file/print"]);
  });

  it.each([
    ["isi beda", "<html>lama</html>"],
    ["contents tidak dikirim router", undefined],
  ])("%s: menulis ulang dengan /file/set", async (_case, contents) => {
    const router = fakeFileRouter({ ".id": "*f1", name: PAGE_FILE, contents });

    await writeIsolirPageFile(router as never, html, []);

    expect(paths(router)).toEqual(["/file/print", "/file/set"]);
    expect(router.write).toHaveBeenLastCalledWith("/file/set", [
      "=.id=*f1",
      `=contents=${html}`,
    ]);
  });
});

describe("deprovisionRadius", () => {
  const allowList = [
    { ".id": "*a1", list: "netmanager_allow", address: "10.99.0.1" },
    { ".id": "*a2", list: "netmanager_allow", address: "isolir.lama.id" },
    {
      ".id": "*a3",
      list: "netmanager_allow",
      address: "203.0.113.9",
      dynamic: "true",
    },
  ];

  beforeEach(() => {
    mocks.connection.write.mockReset();
    mocks.connection.write.mockImplementation(
      async (path: string, args: string[] = []) => {
        if (path === "/ip/firewall/address-list/print") {
          return args.includes("?list=netmanager_allow") ? allowList : [];
        }
        if (path === "/ip/proxy/access/print") {
          return [{ ".id": "*p1" }, { ".id": "*p2" }];
        }
        if (
          path === "/ip/firewall/filter/print" &&
          args.includes("?comment=netmanager-proxy-guard")
        ) {
          return [{ ".id": "*g1" }];
        }
        return [];
      },
    );
  });

  function removed(path: string) {
    return mocks.connection.write.mock.calls
      .filter(([p]) => p === path)
      .map(([, args]) => args);
  }

  it("menghapus seluruh netmanager_allow dan proxy access billing, lalu mengembalikan error.html", async () => {
    const result = await new MikroTikProvisioningService().deprovisionRadius(
      { ip: "203.0.113.20", port: 8728, username: "u", password: "p" },
      "10.99.0.1",
    );

    expect(result.success).toBe(true);
    // Entri dinamis hasil resolve DNS ikut hilang bersama entri domainnya;
    // RouterOS menolak bila dihapus langsung.
    expect(removed("/ip/firewall/address-list/remove")).toEqual([
      ["=.id=*a1"],
      ["=.id=*a2"],
    ]);
    expect(removed("/ip/proxy/access/print")).toEqual([
      ["?comment=added by netmanager - 10.127.0.0/18"],
    ]);
    expect(removed("/ip/proxy/access/remove")).toEqual([
      ["=.id=*p1"],
      ["=.id=*p2"],
    ]);
    expect(removed("/ip/proxy/reset-html")).toHaveLength(1);
    const order = mocks.connection.write.mock.calls.map(([p]) => p);
    const disableAt = mocks.connection.write.mock.calls.findIndex(
      ([p, args]) => p === "/ip/proxy/set" && args?.includes("=enabled=no"),
    );
    expect(disableAt).toBeGreaterThan(-1);
    expect(order.indexOf("/ip/proxy/reset-html")).toBeLessThan(disableAt);
  });

  function proxyDisableIndex() {
    return mocks.connection.write.mock.calls.findIndex(
      ([p, args]) => p === "/ip/proxy/set" && args?.includes("=enabled=no"),
    );
  }

  function guardRemoveIndex() {
    return mocks.connection.write.mock.calls.findIndex(
      ([p, args]) =>
        p === "/ip/firewall/filter/remove" && args?.includes("=.id=*g1"),
    );
  }

  it("mematikan web proxy sebelum membuang guard 8181", async () => {
    await new MikroTikProvisioningService().deprovisionRadius(
      { ip: "203.0.113.20", port: 8728, username: "u", password: "p" },
      "10.99.0.1",
    );

    expect(proxyDisableIndex()).toBeGreaterThan(-1);
    expect(guardRemoveIndex()).toBeGreaterThan(proxyDisableIndex());
  });

  it("rule proxy yang gagal dibuang dicatat dan teardown berlanjut", async () => {
    const base = mocks.connection.write.getMockImplementation()!;
    mocks.connection.write.mockImplementation(
      async (path: string, args: string[] = []) => {
        if (path === "/ip/proxy/access/remove") throw new Error("busy");
        return base(path, args);
      },
    );

    const result = await new MikroTikProvisioningService().deprovisionRadius(
      { ip: "203.0.113.20", port: 8728, username: "u", password: "p" },
      "10.99.0.1",
    );

    expect(result.success).toBe(true);
    expect(result.logs).toContain(
      "Failed to remove Web Proxy Access Rule: busy",
    );
    expect(proxyDisableIndex()).toBeGreaterThan(-1);
    expect(guardRemoveIndex()).toBeGreaterThan(proxyDisableIndex());
    expect(removed("/ip/firewall/nat/print").length).toBeGreaterThan(0);
  });
});

describe("provisionRadius", () => {
  const routerDetails = {
    ip: "203.0.113.20",
    port: 8728,
    username: "u",
    password: "p",
  };
  const page = { mode: "ROUTER_PAGE", html: "<html>x</html>", hash: "h" };

  function setRouter(fail: Partial<Record<string, string>> = {}) {
    mocks.connection.write.mockReset();
    mocks.connection.write.mockImplementation(async (path: string) => {
      if (fail[path]) throw new Error(fail[path]);
      if (path === "/file/print") return [{ ".id": "*f1", name: PAGE_FILE }];
      return [];
    });
  }

  function provision() {
    return new MikroTikProvisioningService().provisionRadius(
      routerDetails,
      "10.99.0.1",
      "secret",
      page as never,
    );
  }

  function indexOf(path: string) {
    return mocks.connection.write.mock.calls.findIndex(([p]) => p === path);
  }

  it("menulis halaman isolir setelah rule NAT terpasang", async () => {
    setRouter();

    const result = await provision();

    expect(result).toMatchObject({ success: true });
    expect(result.isolirPageError).toBeUndefined();
    expect(indexOf("/ip/firewall/nat/add")).toBeGreaterThan(-1);
    expect(indexOf("/file/set")).toBeGreaterThan(
      indexOf("/ip/firewall/nat/add"),
    );
  });

  it("halaman yang gagal ditulis tidak menahan NAT", async () => {
    setRouter({ "/file/set": "file busy" });

    const result = await provision();

    expect(result).toMatchObject({
      success: true,
      isolirPageError: "file busy",
    });
    expect(indexOf("/ip/firewall/nat/add")).toBeGreaterThan(-1);
  });

  it("web proxy yang gagal menjadi galat halaman tanpa menggagalkan provisioning", async () => {
    setRouter({ "/ip/proxy/set": "proxy down" });

    const result = await provision();

    expect(result).toMatchObject({
      success: true,
      isolirPageError: "proxy down",
    });
    expect(
      buildIsolirPageSync({ isolir: page as never, error: null }, result),
    ).toEqual({ hash: null, error: "proxy down" });
  });

  describe("mode ISOLIR_SERVICE", () => {
    const service = { mode: "ISOLIR_SERVICE", address: "10.50.0.1" };
    const GUARD = "netmanager-proxy-guard";
    let filter: Record<string, string>[];
    let proxyEnabled: boolean;
    let isConnectionDropped: boolean;

    // RouterOS mencetak boolean sebagai "true"/"false". `dropAtProxyOff`
    // memutus koneksi saat proxy hendak dimatikan: semua tulis sesudahnya gagal.
    function statefulRouter(failProxyOff = false, dropAtProxyOff = false) {
      filter = [];
      proxyEnabled = true;
      isConnectionDropped = false;
      mocks.connection.write.mockReset();
      mocks.connection.write.mockImplementation(
        async (path: string, args: string[] = []) => {
          if (isConnectionDropped) throw new Error("connection lost");
          if (path === "/ip/proxy/set") {
            if (args.includes("=enabled=no")) {
              if (dropAtProxyOff) {
                isConnectionDropped = true;
                throw new Error("connection lost");
              }
              if (failProxyOff) throw new Error("proxy busy");
              proxyEnabled = false;
            } else {
              proxyEnabled = args.includes("=enabled=yes");
            }
          }
          if (path === "/ip/firewall/filter/add") {
            filter.push({
              ".id": `*f${filter.length}`,
              comment: args.find((a) => a.startsWith("=comment="))!.slice(9),
              disabled: "false",
            });
          }
          if (path === "/ip/firewall/filter/remove") {
            const id = args[0].slice("=.id=".length);
            filter = filter.filter((r) => r[".id"] !== id);
          }
          if (path === "/ip/firewall/filter/set") {
            const id = args[0].slice("=.id=".length);
            const row = filter.find((r) => r[".id"] === id);
            if (row && args.includes("=disabled=no")) row.disabled = "false";
          }
          if (path === "/ip/firewall/filter/print") {
            const q = args.find((a) => a.startsWith("?comment="));
            return q
              ? filter.filter((r) => `?comment=${r.comment}` === q)
              : filter;
          }
          return [];
        },
      );
    }

    function run(isolir: unknown) {
      return new MikroTikProvisioningService().provisionRadius(
        routerDetails,
        "10.99.0.1",
        "secret",
        isolir as never,
      );
    }

    const hasGuard = () => filter.some((r) => r.comment === GUARD);
    const paths = () => mocks.connection.write.mock.calls.map(([p]) => p);

    it("mematikan web proxy dan membuang guard, tanpa menulis error.html", async () => {
      statefulRouter();
      await run(page);
      expect(hasGuard()).toBe(true);
      expect(proxyEnabled).toBe(true);
      mocks.connection.write.mockClear();

      const result = await run(service);

      expect(result).toMatchObject({ success: true });
      expect(result.isolirPageError).toBeUndefined();
      expect(proxyEnabled).toBe(false);
      expect(hasGuard()).toBe(false);
      expect(paths()).toContain("/ip/proxy/access/print");
      expect(paths()).not.toContain("/ip/proxy/access/add");
      expect(paths()).not.toContain("/file/set");
      expect(paths()).not.toContain("/file/print");
    });

    it("guard baru dibuang sesudah proxy dimatikan", async () => {
      statefulRouter();
      await run(page);
      mocks.connection.write.mockClear();

      await run(service);

      const calls = mocks.connection.write.mock.calls;
      const off = calls.findIndex(([, a]) => a?.includes("=enabled=no"));
      const rm = calls.findIndex(([p]) => p === "/ip/firewall/filter/remove");
      expect(off).toBeGreaterThan(-1);
      expect(rm).toBeGreaterThan(off);
    });

    it("proxy gagal dimatikan: guard dipertahankan dan galat dilaporkan", async () => {
      statefulRouter(true);
      await run(page);

      const result = await run(service);

      expect(result).toMatchObject({
        success: true,
        isolirPageError: "Web proxy gagal dimatikan; guard 8181 dipertahankan",
      });
      expect(hasGuard()).toBe(true);
    });

    it("proxy gagal dimatikan: guard yang hilang dipasang kembali", async () => {
      statefulRouter(true);

      await run(service);

      expect(hasGuard()).toBe(true);
    });

    const guardRow = () => filter.find((r) => r.comment === GUARD)!;

    it("proxy gagal dimatikan: guard yang dinonaktifkan dinyalakan lagi", async () => {
      statefulRouter(true);
      await run(page);
      guardRow().disabled = "true";

      await run(service);

      expect(proxyEnabled).toBe(true);
      expect(guardRow().disabled).toBe("false");
    });

    it("putus sebelum proxy mati: guard sudah dipulihkan langkah firewall", async () => {
      statefulRouter(false, true);
      await run(page);
      guardRow().disabled = "true";

      const result = await run(service);

      expect(result).toMatchObject({ success: false });
      expect(proxyEnabled).toBe(true);
      expect(guardRow().disabled).toBe("false");
    });

    it("kembali ke ROUTER_PAGE menyalakan proxy dan memasang guard lagi", async () => {
      statefulRouter();
      await run(service);
      expect(proxyEnabled).toBe(false);
      expect(hasGuard()).toBe(false);

      await run(page);

      expect(proxyEnabled).toBe(true);
      expect(hasGuard()).toBe(true);
    });
  });
});
