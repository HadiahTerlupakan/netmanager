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
  resolveIsolirProvisioning,
  splitIsolirTarget,
} from "@/modules/network/isolir/isolir-provisioning";
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
    mocks.resolveIsolirContent.mockReset();
    mocks.resolveIsolirContent.mockResolvedValue(content);
  });

  it("REDIRECT membawa host dan path tanpa skema", async () => {
    await expect(
      resolveIsolirProvisioning({
        isolirMode: "REDIRECT",
        isolirUrl: "https://isolir.x.id/abc",
        tenantId: "t1",
      }),
    ).resolves.toEqual({ mode: "REDIRECT", target: "isolir.x.id/abc" });
    expect(mocks.resolveIsolirContent).not.toHaveBeenCalled();
  });

  it("ROUTER_PAGE memakai HTML renderer dari isi tenant router", async () => {
    const result = await resolveIsolirProvisioning({
      isolirMode: "ROUTER_PAGE",
      isolirUrl: null,
      tenantId: "t1",
    });

    const rendered = renderIsolirPage(content);
    expect(result).toEqual({
      mode: "ROUTER_PAGE",
      html: rendered.html,
      hash: rendered.hash,
    });
    expect(mocks.resolveIsolirContent).toHaveBeenCalledWith("t1");
  });

  it.each([null, "", "   "])(
    "REDIRECT dengan URL kosong (%j) jatuh ke ROUTER_PAGE",
    async (isolirUrl) => {
      const result = await resolveIsolirProvisioning({
        isolirMode: "REDIRECT",
        isolirUrl,
        tenantId: null,
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
});
