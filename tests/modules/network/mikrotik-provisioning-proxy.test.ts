import type { RouterOSAPI } from "node-routeros-v2";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/network/services/mikrotik-provisioning.connection", () => ({
  delay: async (): Promise<void> => undefined,
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { provisionWebProxy } from "@/modules/network/services/mikrotik-provisioning.proxy";

const COMMENT = "added by netmanager - 10.127.0.0/18";

function fakeRouter(rows: Array<Record<string, string>>) {
  const write = vi.fn(async (path: string) =>
    path === "/ip/proxy/access/print" ? rows : [],
  );
  return { write };
}

function provision(router: ReturnType<typeof fakeRouter>, isolirUrl: string) {
  return provisionWebProxy({
    connection: router as unknown as RouterOSAPI,
    isolirUrl,
    logs: [],
  });
}

function accessSets(router: ReturnType<typeof fakeRouter>) {
  return router.write.mock.calls.filter(
    ([path]) => path === "/ip/proxy/access/set",
  );
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

  it("mengarahkan ulang ke domain isolir baru saat ISOLIR_URL berganti", async () => {
    const router = fakeRouter([rule]);

    await provision(router, "https://isolir.baru.id/halaman");

    expect(accessSets(router)).toEqual([
      [
        "/ip/proxy/access/set",
        [
          "=.id=*7",
          "=src-address=10.127.0.0/18",
          "=action=redirect",
          "=action-data=isolir.baru.id",
          "=disabled=no",
        ],
      ],
    ]);
  });

  it("membiarkan aturan yang sudah standar", async () => {
    const router = fakeRouter([rule]);

    await provision(router, "https://isolir.lama.id");

    expect(accessSets(router)).toEqual([]);
  });
});
