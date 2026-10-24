// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman edit router: toggle RouterOS v7 untuk router publik, alur
 * "Aktifkan VPN" → tempel script → "Pindahkan ke VPN", dan "Kembali ke publik".
 */

const palsu = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "r1" }),
}));

vi.mock("react-hot-toast", () => ({ toast: palsu.toast }));

import { ClientComponent as MikrotikEditClient } from "@/app/admin/network/mikrotik/[id]/edit/MikrotikEditClient";

import {
  bongkarPanggung,
  cari,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tombolBerteks,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal: test harus merah bila rute atau pesannya diganti. */
const ROUTER_URL = "/api/mikrotik-routers/r1";
const ENABLE_URL = "/api/mikrotik-routers/r1/vpn/enable";
const TUNNEL_TEST_URL = "/api/mikrotik-routers/r1/vpn/tunnel-test";
const MIGRATE_URL = "/api/mikrotik-routers/r1/vpn/migrate";
const REVERT_URL = "/api/mikrotik-routers/r1/vpn/revert";
const STATUS_URL = "/api/mikrotik-routers/vpn-draft/d1a2/status";
const SERVERS_URL = "/api/vpn-servers";
const MIGRATE_BUTTON = "Pindahkan ke VPN";

const TENANT_SERVERS = [
  {
    id: "aa11",
    name: "VPS Jakarta",
    publicHost: "jkt.vpn",
    status: "online",
    protocols: ["wireguard", "l2tp"],
  },
  {
    id: "bb22",
    name: "VPS Surabaya",
    publicHost: "sby.vpn",
    status: "offline",
    protocols: ["wireguard"],
  },
];

type Route = (init?: RequestInit) => Response | Promise<Response>;

function stubFetch(routes: Record<string, Route>) {
  const fetchPalsu = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    const route = routes[key];
    if (!route) throw new Error(`fetch tak dikenal: ${key}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchPalsu);
  return fetchPalsu;
}

function bodyOf(fetchPalsu: ReturnType<typeof stubFetch>, key: string) {
  const call = fetchPalsu.mock.calls.find(
    ([url, init]) => `${init?.method ?? "GET"} ${url}` === key,
  );
  return call ? JSON.parse(String(call[1]?.body)) : undefined;
}

function pageRoutes(router: () => Record<string, unknown>) {
  return {
    "GET /api/settings/general": () =>
      responsJson(200, { data: { pppConnectionMode: "RADIUS" } }),
    "GET /api/settings/radius-defaults": () =>
      responsJson(200, { authPort: 1812, accountingPort: 1813 }),
    [`GET ${ROUTER_URL}`]: () =>
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
            connectionMode: "PUBLIC",
            rosVersion: "V7",
            publicIpAddress: null,
            ...router(),
          },
        },
      }),
    [`GET ${SERVERS_URL}`]: () =>
      responsJson(200, { success: true, data: { servers: TENANT_SERVERS } }),
  };
}

function enableRoutes(tunnelTest: Route) {
  return {
    [`POST ${ENABLE_URL}`]: () =>
      responsJson(200, {
        success: true,
        data: { draftId: "d1a2", address: "10.100.0.10", script: "/x" },
      }),
    [`GET ${STATUS_URL}`]: () =>
      responsJson(200, { success: true, data: { stage: "tunnel_up" } }),
    [`POST ${TUNNEL_TEST_URL}`]: tunnelTest,
  };
}

describe("MikrotikEditClient VPN migration", () => {
  let panggung: Panggung;

  beforeEach(() => {
    panggung = pasangPanggung();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  async function openPage(textReady: string) {
    await render(panggung, <MikrotikEditClient />);
    await tungguSampai(
      () => document.body.textContent.includes(textReady),
      `"${textReady}" tampil`,
    );
  }

  it("router publik v7: script, test API lewat tunnel, lalu pindah ke VPN", async () => {
    let mode = "PUBLIC";
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({ connectionMode: mode })),
      ...enableRoutes(() =>
        responsJson(200, { success: true, data: { version: "7.16.2" } }),
      ),
      [`POST ${MIGRATE_URL}`]: () => {
        mode = "VPN";
        return responsJson(200, { success: true, data: { success: true } });
      },
      "GET /api/mikrotik-routers/r1/vpn": () =>
        responsJson(200, {
          success: true,
          data: {
            servers: [],
            activeServerId: null,
            isOnBackup: false,
            lastHandshakeAt: null,
            events: [],
            scriptStale: false,
            protocol: "WIREGUARD",
          },
        }),
    });
    await openPage("Aktifkan VPN");

    await klikTombol("Aktifkan VPN");
    await tungguSampai(
      () => document.body.textContent.includes("API tersambung lewat tunnel"),
      "test API lewat tunnel lulus",
    );
    expect(bodyOf(fetchPalsu, `POST ${ENABLE_URL}`)).toEqual({
      serverIds: ["aa11"],
      protocol: "WIREGUARD",
    });
    expect(bodyOf(fetchPalsu, `POST ${TUNNEL_TEST_URL}`)).toEqual({
      draftId: "d1a2",
    });
    expect(tombolBerteks(MIGRATE_BUTTON)?.disabled).toBe(false);

    await klikTombol(MIGRATE_BUTTON);
    await tungguSampai(
      () => document.body.textContent.includes("Server aktif"),
      "panel VPN tampil setelah pindah",
    );
    expect(bodyOf(fetchPalsu, `POST ${MIGRATE_URL}`)).toEqual({
      draftId: "d1a2",
      serverIds: ["aa11"],
    });
    expect(palsu.toast.success).toHaveBeenCalledWith(
      "Router dipindahkan ke VPN",
    );
  });

  it("aktivasi gagal (502) membuang draft: script berikutnya draft baru", async () => {
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({})),
      ...enableRoutes(() =>
        responsJson(200, { success: true, data: { version: "7.16.2" } }),
      ),
      [`POST ${MIGRATE_URL}`]: () =>
        responsJson(502, {
          success: false,
          error: "Gagal mengaktifkan VPN router",
        }),
    });
    await openPage("Aktifkan VPN");
    await klikTombol("Aktifkan VPN");
    await tungguSampai(
      () => document.body.textContent.includes("API tersambung lewat tunnel"),
      "test API lewat tunnel lulus",
    );

    await klikTombol(MIGRATE_BUTTON);
    await tungguSampai(
      () => !tombolBerteks(MIGRATE_BUTTON),
      "modal tertutup setelah aktivasi gagal",
    );
    expect(palsu.toast.error).toHaveBeenCalledWith(
      "Gagal mengaktifkan VPN router",
    );

    await klikTombol("Aktifkan VPN");
    await tungguSampai(
      () =>
        fetchPalsu.mock.calls.filter(
          ([url, init]) => init?.method === "POST" && url === ENABLE_URL,
        ).length === 2,
      "draft diminta ulang",
    );
    const enableBodies = fetchPalsu.mock.calls
      .filter(([url, init]) => init?.method === "POST" && url === ENABLE_URL)
      .map(([, init]) => JSON.parse(String(init?.body)));
    expect(enableBodies[1]).toEqual({
      serverIds: ["aa11"],
      protocol: "WIREGUARD",
    });
  });

  it("panel aktifkan VPN mengirim protokol", async () => {
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({ connectionMode: "PUBLIC" })),
      ...enableRoutes(() =>
        responsJson(200, { success: true, data: { version: "7.16.2" } }),
      ),
    });
    await openPage("Aktifkan VPN");

    await act(async () => {
      cari<HTMLElement>("#vpn-protocol-l2tp")!.click();
    });
    await klikTombol("Aktifkan VPN");
    await tungguSampai(
      () => document.body.textContent.includes("API tersambung lewat tunnel"),
      "test API lewat tunnel lulus",
    );

    expect(bodyOf(fetchPalsu, `POST ${ENABLE_URL}`)).toEqual({
      serverIds: ["aa11"],
      protocol: "L2TP",
    });
  });

  it("tombol pindah tetap mati bila test API lewat tunnel gagal", async () => {
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({})),
      ...enableRoutes(() =>
        responsJson(400, { success: false, error: "Router harus RouterOS v7" }),
      ),
    });
    await openPage("Aktifkan VPN");

    await klikTombol("Aktifkan VPN");
    await tungguSampai(
      () => document.body.textContent.includes("Router harus RouterOS v7"),
      "pesan gagal tampil",
    );
    expect(tombolBerteks(MIGRATE_BUTTON)?.disabled).toBe(true);
    expect(fetchPalsu.mock.calls.some(([url]) => url === MIGRATE_URL)).toBe(
      false,
    );
  });

  it("router publik v6: tanpa Aktifkan VPN, toggle v7 ikut tersimpan", async () => {
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({ rosVersion: "V6" })),
      [`PATCH ${ROUTER_URL}`]: () =>
        responsJson(200, { success: true, data: { success: true } }),
    });
    await openPage("RouterOS v7");
    expect(tombolBerteks("Aktifkan VPN")).toBeUndefined();

    const toggle = document.getElementById(
      "mikrotik-ros-v7",
    ) as HTMLInputElement;
    toggle.click();
    await tungguSampai(
      () => document.body.textContent.includes("Simpan router sebagai"),
      "petunjuk simpan tampil",
    );
    await klikTombol("Update Router");
    await tungguSampai(
      () => Boolean(bodyOf(fetchPalsu, `PATCH ${ROUTER_URL}`)),
      "PATCH terkirim",
    );
    expect(bodyOf(fetchPalsu, `PATCH ${ROUTER_URL}`).rosVersion).toBe("V7");
  });

  it("router VPN: kembali ke publik lewat konfirmasi dan meneruskan peringatan", async () => {
    let mode = "VPN";
    const warning = "Entri RADIUS lama belum terhapus dari router";
    const fetchPalsu = stubFetch({
      ...pageRoutes(() => ({
        connectionMode: mode,
        ipAddress: mode === "VPN" ? "10.100.0.10" : "198.51.100.7",
        publicIpAddress: mode === "VPN" ? "198.51.100.7" : null,
      })),
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
      [`POST ${REVERT_URL}`]: () => {
        mode = "PUBLIC";
        return responsJson(200, {
          success: true,
          data: { success: true, warning },
        });
      },
    });
    await openPage("Server aktif");

    await klikTombol("Kembali ke publik");
    expect(document.body.textContent).toContain("198.51.100.7");
    expect(document.body.textContent).toContain("Tunnel VPN tetap terpasang");
    const buttons = [...document.body.querySelectorAll("button")].filter(
      (b) => b.textContent.trim() === "Kembali ke publik",
    );
    await tungguSampai(() => buttons.length === 2, "tombol konfirmasi");
    buttons[1].click();

    await tungguSampai(
      () => document.body.textContent.includes("Aktifkan VPN"),
      "halaman kembali ke mode publik",
    );
    expect(
      fetchPalsu.mock.calls.some(
        ([url, init]) => url === REVERT_URL && init?.method === "POST",
      ),
    ).toBe(true);
    expect(palsu.toast).toHaveBeenCalledWith(warning, { icon: "⚠️" });
  });
});
