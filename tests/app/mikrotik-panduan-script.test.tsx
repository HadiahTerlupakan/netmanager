// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tombol "Panduan Dasar" dan "SCRIPT GENERATOR" di halaman tambah dan edit
 * router: panduan benar-benar terbuka, dan script router publik dibuat dari
 * isi form, bukan template berplaceholder.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "r1" }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { ClientComponent as MikrotikNewClient } from "@/app/admin/network/mikrotik/new/MikrotikNewClient";
import { ClientComponent as MikrotikEditClient } from "@/app/admin/network/mikrotik/[id]/edit/MikrotikEditClient";

import {
  bongkarPanggung,
  cari,
  isiMedan,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tombolBerteks,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

const GUIDE_BUTTON = "Panduan Dasar";
const SCRIPT_BUTTON = "</> SCRIPT GENERATOR";
const GUIDE_TITLE = "Panduan Dasar Menambah Router";

type Route = () => Response;
type PppMode = "RADIUS" | "MIKROTIK_API";

function stubFetch(routes: Record<string, Route>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url}`;
      const route = routes[key];
      if (!route) throw new Error(`fetch tak dikenal: ${key}`);
      return route();
    }),
  );
}

function settingsRoutes(pppConnectionMode: PppMode = "RADIUS") {
  return {
    "GET /api/settings/general": () =>
      responsJson(200, { data: { pppConnectionMode } }),
    "GET /api/settings/radius-defaults": () =>
      responsJson(200, { authPort: 1812, accountingPort: 1813 }),
  };
}

function editRoutes(connectionMode: "PUBLIC" | "VPN") {
  return {
    ...settingsRoutes(),
    "GET /api/mikrotik-routers/r1": () =>
      responsJson(200, {
        success: true,
        data: {
          router: {
            name: "RB-1",
            ipAddress: "198.51.100.7",
            timezone: "+07:00 Asia/Jakarta",
            apiPort: 8728,
            apiUsername: "admin",
            apiPassword: "rahasia",
            connectionMode,
            rosVersion: connectionMode === "VPN" ? "V7" : "V6",
            publicIpAddress: null,
          },
        },
      }),
    "GET /api/mikrotik-routers/r1/vpn": () =>
      responsJson(200, {
        success: true,
        data: {
          servers: [{ id: "aa11", name: "VPS Jakarta", priority: 0 }],
          activeServerId: "aa11",
          isOnBackup: false,
          lastHandshakeAt: null,
          events: [],
          scriptStale: false,
          protocol: "WIREGUARD",
        },
      }),
    "GET /api/vpn-servers": () =>
      responsJson(200, { success: true, data: { servers: [] } }),
  };
}

/** Teks dialog yang terbuka; modal dirender lewat portal ke `document.body`. */
function dialogText(): string {
  return cari('[role="dialog"]')?.textContent ?? "";
}

function scriptText(): string | undefined {
  return cari('[role="dialog"] pre')?.textContent;
}

describe("Panduan Dasar dan SCRIPT GENERATOR", () => {
  let panggung: Panggung;

  beforeEach(() => {
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  async function openEditPage(connectionMode: "PUBLIC" | "VPN") {
    stubFetch(editRoutes(connectionMode));
    await render(panggung, <MikrotikEditClient />);
    await tungguSampai(
      () => tombolBerteks(SCRIPT_BUTTON) !== undefined,
      "halaman edit selesai dimuat",
    );
  }

  it("halaman tambah: Panduan Dasar membuka panduan", async () => {
    stubFetch(settingsRoutes());
    await render(panggung, <MikrotikNewClient />);

    await klikTombol(GUIDE_BUTTON);

    expect(dialogText()).toContain(GUIDE_TITLE);
  });

  it("halaman tambah: tanpa username/password tidak ada script untuk ditempel", async () => {
    stubFetch(settingsRoutes());
    await render(panggung, <MikrotikNewClient />);

    await klikTombol(SCRIPT_BUTTON);

    expect(dialogText()).toContain("Isi Username API dan Password API");
    expect(scriptText()).toBeUndefined();
  });

  it.each([
    { mode: "RADIUS" as const, hasUseRadius: true },
    { mode: "MIKROTIK_API" as const, hasUseRadius: false },
  ])(
    "halaman tambah ($mode): script dibuat dari port, username, dan password di form",
    async ({ mode, hasUseRadius }) => {
      stubFetch(settingsRoutes(mode));
      await render(panggung, <MikrotikNewClient />);
      await tungguSampai(
        () => cari("h1")?.textContent.includes("[NAS]") === hasUseRadius,
        `mode PPP ${mode} termuat`,
      );
      await isiMedan("#mikrotik-api-port", "8729");
      await isiMedan("#mikrotik-api-username", "teknisi");
      await isiMedan("#mikrotik-api-password", "rahasia");

      await klikTombol(SCRIPT_BUTTON);

      const script = scriptText();
      expect(script).toContain(
        "/ip service set [find name=api] disabled=no port=8729",
      );
      expect(script).toContain(
        '/user add name="teknisi" group=full password="rahasia"',
      );
      expect(script?.includes("/ppp aaa set use-radius=yes")).toBe(
        hasUseRadius,
      );
    },
  );

  it("halaman edit: Panduan Dasar membuka panduan", async () => {
    await openEditPage("PUBLIC");

    await klikTombol(GUIDE_BUTTON);

    expect(dialogText()).toContain(GUIDE_TITLE);
  });

  it("halaman edit router publik: script memakai port dan kredensial tersimpan", async () => {
    await openEditPage("PUBLIC");

    await klikTombol(SCRIPT_BUTTON);

    const script = scriptText();
    expect(script).toContain(
      "/ip service set [find name=api] disabled=no port=8728",
    );
    expect(script).toContain('/user add name="admin" group=full');
  });

  it("halaman edit router VPN: SCRIPT GENERATOR dimatikan", async () => {
    await openEditPage("VPN");

    expect(tombolBerteks(SCRIPT_BUTTON)?.disabled).toBe(true);
  });
});
