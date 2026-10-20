// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mode VPN pada form "Tambah Router": toggle RouterOS v7 → "Pakai VPN" →
 * daftar server → modal script yang mengisi dan mengunci kredensial, polling
 * status tunnel, lalu test koneksi otomatis dengan syarat RouterOS v7.
 */

const palsu = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

import { act } from "react";

import { ClientComponent } from "@/app/admin/network/mikrotik/new/MikrotikNewClient";

import {
  bongkarPanggung,
  cari,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tombolBerteks,
  type Panggung,
} from "./presurvei-jsdom-harness";

/** Ditulis literal: test harus merah bila rute atau pesannya diganti. */
const SERVERS_URL = "/api/vpn-servers";
const DRAFT_URL = "/api/mikrotik-routers/vpn-draft";
const STATUS_URL = "/api/mikrotik-routers/vpn-draft/d1a2/status";
const TEST_URL = "/api/mikrotik-routers/test-connection";
const SCRIPT_BUTTON = "</> SCRIPT GENERATOR";
const POLL_MS = 5000;

const DRAFT = {
  draftId: "d1a2",
  address: "10.99.0.5",
  apiUsername: "netmanager-0a1b2c3d",
  apiPassword: "Abcdefghijklmnopqrstuvwx12",
  script: "/interface wireguard add name=netmanager",
};

const SERVERS = [
  { id: "aa11", name: "VPS Jakarta", publicHost: "jkt.vpn", status: "online" },
  { id: "bb22", name: "VPS Surabaya", publicHost: "sby.vpn", status: "online" },
  { id: "cc33", name: "VPS Medan", publicHost: "mdn.vpn", status: "offline" },
];

type Route = (init?: RequestInit) => Response | Promise<Response>;

/** Memalsukan fetch per "METHOD url"; rute tak dikenal gagal keras. */
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

const settingsRoutes: Record<string, Route> = {
  "GET /api/settings/general": () =>
    responsJson(200, { data: { pppConnectionMode: "RADIUS" } }),
  "GET /api/settings/radius-defaults": () =>
    responsJson(200, { authPort: 1812, accountingPort: 1813 }),
};

function vpnRoutes(stage: () => string, version = "7.16.2 (stable)") {
  return {
    ...settingsRoutes,
    [`GET ${SERVERS_URL}`]: () =>
      responsJson(200, { success: true, data: { servers: SERVERS } }),
    [`POST ${DRAFT_URL}`]: () =>
      responsJson(200, { success: true, data: DRAFT }),
    [`GET ${STATUS_URL}`]: () =>
      responsJson(200, {
        success: true,
        data: { stage: stage(), lastHandshakeAt: null, activeServerId: null },
      }),
    [`POST ${TEST_URL}`]: () =>
      responsJson(200, {
        success: true,
        data: {
          success: true,
          api: { success: true, message: "OK" },
          routerInfo: { identity: "RB", version },
          message: "Koneksi berhasil!",
        },
      }),
  } satisfies Record<string, Route>;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function klikElemen(selektor: string) {
  const elemen = cari<HTMLElement>(selektor);
  expect(elemen, `elemen ${selektor} tidak ditemukan`).not.toBeNull();
  await act(async () => {
    elemen!.click();
  });
  await flush();
}

function medan(id: string) {
  return cari<HTMLInputElement>(`#${id}`)!;
}

function callsTo(fetchPalsu: ReturnType<typeof stubFetch>, key: string) {
  return fetchPalsu.mock.calls.filter(
    ([url, init]) => `${init?.method ?? "GET"} ${url}` === key,
  );
}

async function openVpnScript() {
  await klikElemen("#mikrotik-ros-v7");
  await klikElemen("#mikrotik-use-vpn");
  await klikTombol(SCRIPT_BUTTON);
  await flush();
}

function submitButton() {
  return tombolBerteks("Tambahkan Router")!;
}

describe("Tambah Router — mode VPN", () => {
  let panggung: Panggung;

  beforeEach(async () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
    palsu.toastSuccess.mockClear();
    palsu.toastError.mockClear();
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tanpa RouterOS v7 tidak ada toggle VPN dan modal script lama dipakai", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();

    expect(cari("#mikrotik-ros-v7")).not.toBeNull();
    expect(cari("#mikrotik-use-vpn")).toBeNull();
    await klikTombol(SCRIPT_BUTTON);
    expect(document.body.textContent).toContain("MikroTik Script Generator");
    expect(callsTo(fetchPalsu, `GET ${SERVERS_URL}`)).toHaveLength(0);
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(0);
  });

  it("respons draft mengisi IP, port, username, password dan menguncinya", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();

    const [, init] = callsTo(fetchPalsu, `POST ${DRAFT_URL}`)[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      serverIds: ["aa11", "bb22"],
    });
    expect(document.body.textContent).toContain(DRAFT.script);
    expect(document.body.textContent).toContain("Menunggu script ditempel");
    expect(medan("mikrotik-ip-address").value).toBe(DRAFT.address);
    expect(medan("mikrotik-api-port").value).toBe("8728");
    expect(medan("mikrotik-api-username").value).toBe(DRAFT.apiUsername);
    expect(medan("mikrotik-api-password").value).toBe(DRAFT.apiPassword);
    for (const id of [
      "mikrotik-ip-address",
      "mikrotik-api-port",
      "mikrotik-api-username",
      "mikrotik-api-password",
    ]) {
      expect(medan(id).readOnly, id).toBe(true);
    }
  });

  it("tunnel_up memicu test koneksi tepat sekali lalu API tersambung", async () => {
    let stage = "waiting";
    const fetchPalsu = stubFetch(vpnRoutes(() => stage));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();

    await flush(POLL_MS);
    expect(callsTo(fetchPalsu, `GET ${STATUS_URL}`).length).toBeGreaterThan(0);
    expect(callsTo(fetchPalsu, `POST ${TEST_URL}`)).toHaveLength(0);

    stage = "tunnel_up";
    await flush(POLL_MS);
    expect(document.body.textContent).toContain("Tunnel tersambung");
    expect(document.body.textContent).toContain("API tersambung");

    const statusCalls = callsTo(fetchPalsu, `GET ${STATUS_URL}`).length;
    await flush(POLL_MS * 4);
    expect(callsTo(fetchPalsu, `POST ${TEST_URL}`)).toHaveLength(1);
    expect(callsTo(fetchPalsu, `GET ${STATUS_URL}`)).toHaveLength(statusCalls);
    expect(submitButton().disabled).toBe(false);
  });

  it("RouterOS 6.49 menggagalkan test dengan pesan versi", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "tunnel_up", "6.49.10"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await flush(POLL_MS);

    expect(callsTo(fetchPalsu, `POST ${TEST_URL}`)).toHaveLength(1);
    expect(document.body.textContent).toContain("RouterOS harus versi 7");
    expect(document.body.textContent).not.toContain("API tersambung");
    expect(submitButton().disabled).toBe(true);
  });

  it("mematikan VPN mengosongkan dan membuka kunci field", async () => {
    stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await klikTombol("Tutup");
    await klikElemen("#mikrotik-use-vpn");

    for (const id of [
      "mikrotik-ip-address",
      "mikrotik-api-username",
      "mikrotik-api-password",
    ]) {
      expect(medan(id).value, id).toBe("");
      expect(medan(id).readOnly, id).toBe(false);
    }
  });

  it("server terakhir yang dicentang tidak bisa dilepas", async () => {
    stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");
    await klikElemen("#mikrotik-use-vpn");

    expect(cari<HTMLInputElement>("#vpn-server-cc33")!.checked).toBe(false);
    await klikElemen("#vpn-server-aa11");
    const lastChecked = cari<HTMLInputElement>("#vpn-server-bb22")!;
    expect(lastChecked.checked).toBe(true);
    expect(lastChecked.disabled).toBe(true);
  });

  it("mengubah urutan server membuat draft baru dengan kredensial yang sama", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await klikTombol("Tutup");

    await klikElemen('[aria-label="Naikkan prioritas VPS Surabaya"]');
    expect(document.body.textContent).toContain("Daftar server berubah");
    await klikTombol(SCRIPT_BUTTON);
    await flush();

    const drafts = callsTo(fetchPalsu, `POST ${DRAFT_URL}`);
    expect(drafts).toHaveLength(2);
    expect(JSON.parse(String(drafts[1][1]?.body))).toEqual({
      serverIds: ["bb22", "aa11"],
      previousDraftId: DRAFT.draftId,
      apiUsername: DRAFT.apiUsername,
      apiPassword: DRAFT.apiPassword,
    });
  });

  it("layanan VPN 503 menonaktifkan toggle VPN dengan keterangan", async () => {
    stubFetch({
      ...settingsRoutes,
      [`GET ${SERVERS_URL}`]: () =>
        responsJson(503, { error: "Layanan VPN belum dikonfigurasi" }),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");

    expect(cari<HTMLInputElement>("#mikrotik-use-vpn")!.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Layanan VPN belum dikonfigurasi",
    );
  });
});
