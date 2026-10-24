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
import VpnScriptModal from "@/components/mikrotik/VpnScriptModal";

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
const VIEW_SCRIPT_BUTTON = "Lihat script VPN";
const PREPARING = "Sedang disiapkan…";
const POLL_MS = 5000;
const DEBOUNCE_MS = 500;

const DRAFT = {
  draftId: "d1a2",
  address: "10.99.0.5",
  apiUsername: "netmanager-0a1b2c3d",
  apiPassword: "rahasia",
  script: "/interface wireguard add name=netmanager",
};

const SERVERS = [
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
    status: "online",
    protocols: ["wireguard"],
  },
  {
    id: "cc33",
    name: "VPS Medan",
    publicHost: "mdn.vpn",
    status: "offline",
    protocols: ["wireguard"],
  },
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

async function turnOnVpn() {
  await klikElemen("#mikrotik-ros-v7");
  await klikElemen("#mikrotik-use-vpn");
}

async function openVpnScript() {
  await turnOnVpn();
  await flush(DEBOUNCE_MS);
  await klikTombol(VIEW_SCRIPT_BUTTON);
  await flush();
}

const LOCKED_FIELDS = [
  "mikrotik-ip-address",
  "mikrotik-api-port",
  "mikrotik-api-username",
  "mikrotik-api-password",
];

/** Respons yang baru selesai saat test memanggil `resolve`. */
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function draftBody(fetchPalsu: ReturnType<typeof stubFetch>, index: number) {
  const drafts = callsTo(fetchPalsu, `POST ${DRAFT_URL}`);
  return JSON.parse(String(drafts[index][1]?.body));
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
      protocol: "WIREGUARD",
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
    expect(
      JSON.parse(String(callsTo(fetchPalsu, `POST ${TEST_URL}`)[0][1]?.body)),
    ).toMatchObject({ ipAddress: DRAFT.address, vpnDraftId: DRAFT.draftId });
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

  it("hasil test VPN tidak membuka simpan mode publik setelah VPN dimatikan", async () => {
    const alertPalsu = vi.fn();
    vi.stubGlobal("alert", alertPalsu);
    const fetchPalsu = stubFetch(vpnRoutes(() => "tunnel_up", "6.49.10"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await flush(POLL_MS);
    expect(callsTo(fetchPalsu, `POST ${TEST_URL}`)).toHaveLength(1);

    await klikTombol("Tutup");
    await klikElemen("#mikrotik-use-vpn");
    expect(submitButton().disabled).toBe(true);
    await act(async () => {
      cari("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await flush();
    expect(alertPalsu).toHaveBeenCalled();
    expect(callsTo(fetchPalsu, "POST /api/mikrotik-routers")).toHaveLength(0);
  });

  it("test otomatis tidak membuka modal hasil test di atas modal VPN", async () => {
    stubFetch(vpnRoutes(() => "tunnel_up"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await flush(POLL_MS);

    expect(document.body.textContent).toContain("API tersambung");
    expect(document.body.textContent).not.toContain("Hasil Test Koneksi");
  });

  it("tanpa server online toggle VPN nonaktif dengan keterangan", async () => {
    const offline = SERVERS.map((server) => ({ ...server, status: "offline" }));
    stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`GET ${SERVERS_URL}`]: () =>
        responsJson(200, { success: true, data: { servers: offline } }),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");

    expect(cari<HTMLInputElement>("#mikrotik-use-vpn")!.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Belum ada server VPN yang online untuk tenant ini",
    );
  });

  it("modal script tidak meminta draft tanpa server terpilih", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(
      panggung,
      <VpnScriptModal
        request={{ serverIds: [], protocol: "WIREGUARD" }}
        apiCheck={null}
        onClose={vi.fn()}
        onDraftReady={vi.fn()}
        onTunnelUp={vi.fn()}
      />,
    );
    await flush();

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Pilih minimal satu server VPN",
    );
  });

  it("memilih L2TP menyembunyikan server tanpa l2tp", async () => {
    stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");
    await klikElemen("#mikrotik-use-vpn");
    expect(document.body.textContent).toContain("VPS Surabaya");

    await klikElemen("#mikrotik-vpn-protocol-l2tp");

    expect(document.body.textContent).toContain("VPS Jakarta");
    expect(document.body.textContent).not.toContain("VPS Surabaya");
  });

  it("tanpa server l2tp tampil pesan kosong", async () => {
    const wgOnly = SERVERS.map((server) => ({
      ...server,
      protocols: ["wireguard"],
    }));
    stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`GET ${SERVERS_URL}`]: () =>
        responsJson(200, { success: true, data: { servers: wgOnly } }),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");
    await klikElemen("#mikrotik-use-vpn");
    await klikElemen("#mikrotik-vpn-protocol-l2tp");

    expect(document.body.textContent).toContain(
      "Belum ada server yang mendukung L2TP untuk tenant ini",
    );
  });

  it("memilih L2TP mengirim protocol L2TP saat membuat draft", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");
    await klikElemen("#mikrotik-use-vpn");
    await klikElemen("#mikrotik-vpn-protocol-l2tp");
    await flush(DEBOUNCE_MS);

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);
    const [, init] = callsTo(fetchPalsu, `POST ${DRAFT_URL}`)[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      serverIds: ["aa11"],
      protocol: "L2TP",
    });
  });

  it("ganti protokol setelah draft dibuat menandai draft usang", async () => {
    stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await klikTombol("Tutup");
    expect(document.body.textContent).not.toContain("Daftar server berubah");

    await klikElemen("#mikrotik-vpn-protocol-l2tp");

    expect(document.body.textContent).toContain("Daftar server berubah");
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

  it("aktivasi gagal (502) membuang draft: simpan terkunci dan script berikutnya draft baru", async () => {
    const alertPalsu = vi.fn();
    vi.stubGlobal("alert", alertPalsu);
    const fetchPalsu = stubFetch({
      ...vpnRoutes(() => "tunnel_up"),
      "POST /api/mikrotik-routers": () =>
        responsJson(502, {
          success: false,
          error: "Gagal mengaktifkan VPN router",
        }),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await flush(POLL_MS);
    await klikTombol("Tutup");
    expect(submitButton().disabled).toBe(false);

    await act(async () => {
      cari("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await flush();

    expect(alertPalsu).toHaveBeenCalledWith("Gagal mengaktifkan VPN router");
    expect(submitButton().disabled).toBe(true);
    await flush(DEBOUNCE_MS);
    const drafts = callsTo(fetchPalsu, `POST ${DRAFT_URL}`);
    expect(drafts).toHaveLength(2);
    expect(JSON.parse(String(drafts[1][1]?.body))).not.toHaveProperty(
      "previousDraftId",
    );
  });

  it("mengubah urutan server membuat draft baru dengan kredensial yang sama", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();
    await klikTombol("Tutup");

    await klikElemen('[aria-label="Naikkan prioritas VPS Surabaya"]');
    expect(document.body.textContent).toContain("Daftar server berubah");
    await flush(DEBOUNCE_MS);

    const drafts = callsTo(fetchPalsu, `POST ${DRAFT_URL}`);
    expect(drafts).toHaveLength(2);
    expect(JSON.parse(String(drafts[1][1]?.body))).toEqual({
      serverIds: ["bb22", "aa11"],
      protocol: "WIREGUARD",
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
  it("mengaktifkan VPN dengan server terpilih langsung mengisi IP, port, username dan password API tanpa klik", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await turnOnVpn();
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(0);

    await flush(DEBOUNCE_MS);

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);
    expect(draftBody(fetchPalsu, 0)).toEqual({
      serverIds: ["aa11", "bb22"],
      protocol: "WIREGUARD",
    });
    expect(medan("mikrotik-ip-address").value).toBe(DRAFT.address);
    expect(medan("mikrotik-api-port").value).toBe("8728");
    expect(medan("mikrotik-api-username").value).toBe(DRAFT.apiUsername);
    expect(medan("mikrotik-api-password").value).toBe(DRAFT.apiPassword);
    for (const id of LOCKED_FIELDS) expect(medan(id).readOnly, id).toBe(true);
    expect(document.body.textContent).not.toContain("Script VPN MikroTik");
  });

  it("mengganti protokol membuat draft baru dengan previousDraftId dan memperbarui isian", async () => {
    const l2tpDraft = { ...DRAFT, draftId: "e5f6", address: "10.99.0.9" };
    const responses = [DRAFT, l2tpDraft];
    const fetchPalsu = stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`POST ${DRAFT_URL}`]: () =>
        responsJson(200, { success: true, data: responses.shift() }),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await turnOnVpn();
    await flush(DEBOUNCE_MS);

    await klikElemen("#mikrotik-vpn-protocol-l2tp");
    await flush(DEBOUNCE_MS);

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(2);
    expect(draftBody(fetchPalsu, 1)).toEqual({
      serverIds: ["aa11"],
      protocol: "L2TP",
      previousDraftId: DRAFT.draftId,
      apiUsername: DRAFT.apiUsername,
      apiPassword: DRAFT.apiPassword,
    });
    expect(medan("mikrotik-ip-address").value).toBe(l2tpDraft.address);
    expect(document.body.textContent).not.toContain("Daftar server berubah");
  });

  it("perubahan beruntun hanya mengirim satu permintaan draft lagi setelah yang berjalan selesai", async () => {
    const first = deferred();
    const responses: Array<() => Response | Promise<Response>> = [
      () => first.promise,
      () => responsJson(200, { success: true, data: DRAFT }),
    ];
    const fetchPalsu = stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`POST ${DRAFT_URL}`]: () => responses.shift()!(),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await turnOnVpn();
    await flush(DEBOUNCE_MS);
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);

    await klikElemen('[aria-label="Naikkan prioritas VPS Surabaya"]');
    await flush(DEBOUNCE_MS);
    await klikElemen("#mikrotik-vpn-protocol-l2tp");
    await flush(DEBOUNCE_MS);
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);

    await act(async () => {
      first.resolve(responsJson(200, { success: true, data: DRAFT }));
    });
    await flush(DEBOUNCE_MS);
    await flush(DEBOUNCE_MS * 4);

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(2);
    expect(draftBody(fetchPalsu, 1)).toEqual({
      serverIds: ["aa11"],
      protocol: "L2TP",
      previousDraftId: DRAFT.draftId,
      apiUsername: DRAFT.apiUsername,
      apiPassword: DRAFT.apiPassword,
    });
  });

  it('kolom menampilkan "Sedang disiapkan…" selama draft dibuat', async () => {
    const pending = deferred();
    stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`POST ${DRAFT_URL}`]: () => pending.promise,
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await turnOnVpn();
    await flush(DEBOUNCE_MS);

    for (const id of LOCKED_FIELDS) {
      expect(medan(id).placeholder, id).toBe(PREPARING);
    }

    await act(async () => {
      pending.resolve(responsJson(200, { success: true, data: DRAFT }));
    });
    await flush();
    expect(medan("mikrotik-ip-address").value).toBe(DRAFT.address);
    expect(medan("mikrotik-ip-address").placeholder).not.toBe(PREPARING);
  });

  it("draft gagal menampilkan pesan dan tombol Coba lagi; Coba lagi mengirim ulang", async () => {
    const responses = [
      () => responsJson(500, { success: false, error: "Gagal membuat draft" }),
      () => responsJson(200, { success: true, data: DRAFT }),
    ];
    const fetchPalsu = stubFetch({
      ...vpnRoutes(() => "waiting"),
      [`POST ${DRAFT_URL}`]: () => responses.shift()!(),
    });
    await render(panggung, <ClientComponent />);
    await flush();
    await turnOnVpn();
    await flush(DEBOUNCE_MS);

    expect(document.body.textContent).toContain("Gagal membuat draft");
    for (const id of LOCKED_FIELDS.filter((id) => id !== "mikrotik-api-port")) {
      expect(medan(id).value, id).toBe("");
      expect(medan(id).readOnly, id).toBe(true);
    }
    await flush(DEBOUNCE_MS * 4);
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);

    await klikTombol("Coba lagi");
    await flush(DEBOUNCE_MS);

    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(2);
    expect(medan("mikrotik-ip-address").value).toBe(DRAFT.address);
    expect(document.body.textContent).not.toContain("Gagal membuat draft");
  });

  it("Lihat script VPN membuka modal tanpa POST draft kedua", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await openVpnScript();

    expect(document.body.textContent).toContain(DRAFT.script);
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);

    await klikTombol("Tutup");
    await klikTombol(SCRIPT_BUTTON);
    await flush();
    expect(document.body.textContent).toContain(DRAFT.script);
    expect(document.body.textContent).not.toContain(
      "MikroTik Script Generator",
    );
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(1);
  });

  it("mode non-VPN: SCRIPT GENERATOR tetap seperti sebelumnya", async () => {
    const fetchPalsu = stubFetch(vpnRoutes(() => "waiting"));
    await render(panggung, <ClientComponent />);
    await flush();
    await klikElemen("#mikrotik-ros-v7");
    await flush(DEBOUNCE_MS);

    await klikTombol(SCRIPT_BUTTON);
    expect(document.body.textContent).toContain("MikroTik Script Generator");
    expect(tombolBerteks(VIEW_SCRIPT_BUTTON)).toBeUndefined();
    expect(callsTo(fetchPalsu, `POST ${DRAFT_URL}`)).toHaveLength(0);
  });
});
