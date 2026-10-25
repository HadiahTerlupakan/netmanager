import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import type { IsolirProvisioning } from "@/modules/network/isolir/isolir-provisioning";
import {
  provisionWebProxy,
  removeWebProxy,
} from "@/modules/network/services/mikrotik-provisioning.proxy";

const COMMENT = "added by netmanager - 10.127.0.0/18";
const ROUTER_PAGE: IsolirProvisioning = {
  mode: "ROUTER_PAGE",
  html: "<html></html>",
  hash: "h",
};

function fakeRouter(rows: Array<Record<string, string>>) {
  const write = vi.fn(async (path: string) =>
    path === "/ip/proxy/access/print" ? rows : [],
  );
  return { write };
}

function redirect(target: string): IsolirProvisioning {
  return { mode: "REDIRECT", target };
}

function provision(
  router: ReturnType<typeof fakeRouter>,
  isolir: IsolirProvisioning,
) {
  return provisionWebProxy({
    connection: router as unknown as RouterOSAPI,
    isolir,
    logs: [],
  });
}

function callsTo(router: ReturnType<typeof fakeRouter>, path: string) {
  return router.write.mock.calls.filter(([p]) => p === path);
}

describe("provisionWebProxy", () => {
  const rule = {
    ".id": "*7",
    "src-address": "10.127.0.0/18",
    action: "redirect",
    "action-data": "isolir.lama.id",
    disabled: "false",
    comment: COMMENT,
  };

  it("mengarahkan ulang ke host dan path isolir baru saat URL berganti", async () => {
    const router = fakeRouter([rule]);

    await provision(router, redirect("isolir.baru.id/halaman"));

    expect(callsTo(router, "/ip/proxy/access/set")).toEqual([
      [
        "/ip/proxy/access/set",
        [
          "=.id=*7",
          "=src-address=10.127.0.0/18",
          "=action=redirect",
          "=action-data=isolir.baru.id/halaman",
          "=disabled=no",
        ],
      ],
    ]);
  });

  it("membiarkan aturan yang sudah standar", async () => {
    const router = fakeRouter([rule]);

    await provision(router, redirect("isolir.lama.id"));

    expect(callsTo(router, "/ip/proxy/access/set")).toEqual([]);
  });

  it("ROUTER_PAGE menambah aturan deny agar router menyajikan error.html", async () => {
    const router = fakeRouter([]);

    await provision(router, ROUTER_PAGE);

    expect(callsTo(router, "/ip/proxy/access/add")).toEqual([
      [
        "/ip/proxy/access/add",
        ["=src-address=10.127.0.0/18", "=action=deny", `=comment=${COMMENT}`],
      ],
    ]);
  });

  it("REDIRECT menambah aturan redirect ke host dan path", async () => {
    const router = fakeRouter([]);

    await provision(router, redirect("isolir.x.id/abc"));

    expect(callsTo(router, "/ip/proxy/access/add")).toEqual([
      [
        "/ip/proxy/access/add",
        [
          "=src-address=10.127.0.0/18",
          "=action=redirect",
          "=action-data=isolir.x.id/abc",
          `=comment=${COMMENT}`,
        ],
      ],
    ]);
  });

  it("router lama ber-redirect yang pindah ke ROUTER_PAGE di-set menjadi deny", async () => {
    const router = fakeRouter([rule]);

    await provision(router, ROUTER_PAGE);

    expect(callsTo(router, "/ip/proxy/access/set")).toEqual([
      [
        "/ip/proxy/access/set",
        [
          "=.id=*7",
          "=src-address=10.127.0.0/18",
          "=action=deny",
          "=disabled=no",
        ],
      ],
    ]);
  });

  it.each([
    ["ROUTER_PAGE", ROUTER_PAGE],
    ["REDIRECT", redirect("isolir.x.id")],
  ])("web proxy di-enable pada mode %s", async (_mode, isolir) => {
    const router = fakeRouter([]);

    await provision(router, isolir);

    expect(callsTo(router, "/ip/proxy/set")).toEqual([
      ["/ip/proxy/set", ["=enabled=yes", "=port=8181"]],
    ]);
  });

  it("mengembalikan pesan galat bila web proxy gagal dikonfigurasi", async () => {
    const router = fakeRouter([]);
    router.write.mockRejectedValueOnce(new Error("proxy down"));

    await expect(provision(router, ROUTER_PAGE)).resolves.toBe("proxy down");
    expect(callsTo(router, "/ip/proxy/access/add")).toEqual([]);
  });

  it("tidak mengembalikan galat saat berhasil", async () => {
    await expect(provision(fakeRouter([]), ROUTER_PAGE)).resolves.toBe(
      undefined,
    );
  });
});

describe("removeWebProxy", () => {
  function remove(router: ReturnType<typeof fakeRouter>) {
    return removeWebProxy({
      connection: router as unknown as RouterOSAPI,
      logs: [],
    });
  }

  it("melaporkan true setelah web proxy dimatikan", async () => {
    const router = fakeRouter([]);

    await expect(remove(router)).resolves.toBe(true);
    expect(callsTo(router, "/ip/proxy/set")).toEqual([
      ["/ip/proxy/set", ["=enabled=no"]],
    ]);
  });

  it("melaporkan false bila web proxy gagal dimatikan", async () => {
    const router = fakeRouter([]);
    router.write.mockImplementation(async (path: string) => {
      if (path === "/ip/proxy/set") throw new Error("timeout");
      return [];
    });

    await expect(remove(router)).resolves.toBe(false);
  });
});
