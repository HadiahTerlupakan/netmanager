// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    palsu.toastSuccess,
    palsu.toastError,
  ),
);

import { act } from "react";

import VpnServerPanel from "@/app/admin/tenants/vpn/VpnServerPanel";

import {
  bongkarPanggung,
  cari,
  isiMedan,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

const SERVER_URL = "/api/admin/vpn-servers";
const NOT_CONFIGURED = "Layanan VPN belum dikonfigurasi";
const POLL_MS = 5000;

function server(overrides: Record<string, unknown> = {}) {
  return {
    id: "aa11",
    name: "VPS Jakarta",
    publicHost: "vpn.contoh.com",
    listenPort: 51821,
    status: "online",
    routerCount: 3,
    tenantCount: 1,
    lastSeenAt: null as string | null,
    ...overrides,
  };
}

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

const peersKosong: Record<string, Route> = {
  "GET /api/admin/vpn-admin-peers": () =>
    responsJson(200, { success: true, data: [] }),
};

describe("VpnServerPanel", () => {
  let panggung: Panggung;

  beforeEach(() => {
    palsu.toastSuccess.mockClear();
    palsu.toastError.mockClear();
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("menampilkan daftar server dari API", async () => {
    stubFetch({
      ...peersKosong,
      [`GET ${SERVER_URL}`]: () =>
        responsJson(200, { success: true, data: [server()] }),
    });
    await render(panggung, <VpnServerPanel />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS Jakarta"),
      "nama server tampil",
    );
    expect(document.body.textContent).toContain("vpn.contoh.com:51821");
    expect(document.body.textContent).toContain("Online");
  });

  it("menolak hapus 409 dan menampilkan router yang harus dipindah", async () => {
    stubFetch({
      ...peersKosong,
      [`GET ${SERVER_URL}`]: () =>
        responsJson(200, { success: true, data: [server()] }),
      [`DELETE ${SERVER_URL}/aa11`]: () =>
        responsJson(409, {
          success: false,
          error: "Server masih dipakai router",
          details: {
            routers: [{ id: "r1", name: "RB-Kantor", tenantName: "Tenant A" }],
          },
        }),
    });
    await render(panggung, <VpnServerPanel />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS Jakarta"),
      "daftar tampil",
    );
    await klikTombol("Hapus");
    await klikTombol("Ya, Hapus");
    await tungguSampai(
      () => document.body.textContent.includes("RB-Kantor (Tenant A)"),
      "router penghalang tampil",
    );
    expect(palsu.toastError).toHaveBeenCalledWith(
      "Server masih dipakai router",
    );
  });

  it("mengeluarkan server dari semua router setelah 409 lalu menampilkan hasilnya", async () => {
    stubFetch({
      ...peersKosong,
      [`GET ${SERVER_URL}`]: () =>
        responsJson(200, { success: true, data: [server()] }),
      [`DELETE ${SERVER_URL}/aa11`]: () =>
        responsJson(409, {
          success: false,
          error: "Server masih dipakai router",
          details: {
            routers: [{ id: "r1", name: "RB-Kantor", tenantName: "Tenant A" }],
          },
        }),
      [`DELETE ${SERVER_URL}/aa11/routers`]: () =>
        responsJson(200, {
          success: true,
          data: {
            detached: 2,
            onlyServer: [
              { id: "r9", name: "RB-Tunggal", tenantName: "Tenant B" },
            ],
          },
        }),
    });
    await render(panggung, <VpnServerPanel />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS Jakarta"),
      "daftar tampil",
    );
    await klikTombol("Hapus");
    await klikTombol("Ya, Hapus");
    await tungguSampai(
      () => document.body.textContent.includes("Keluarkan dari semua router"),
      "tombol keluarkan tampil",
    );
    await klikTombol("Keluarkan dari semua router");
    expect(document.body.textContent).toContain(
      "Keluarkan server dari semua router di atas? Router yang sedang tersambung ke server ini akan pindah ke server berikutnya (tersambung ulang sebentar). Router yang hanya memakai server ini dilewati.",
    );
    await klikTombol("Ya, Keluarkan");
    await tungguSampai(
      () => document.body.textContent.includes("Dikeluarkan dari 2 router."),
      "hasil tampil",
    );
    expect(document.body.textContent).toContain(
      "Router berikut hanya memakai server ini; tambahkan server lain dulu:",
    );
    expect(document.body.textContent).toContain("RB-Tunggal (Tenant B)");
    expect(document.body.textContent).not.toContain("RB-Kantor (Tenant A)");
  });

  it("menjelaskan 409 tanpa daftar router sebagai router yang belum menerima daftar baru", async () => {
    stubFetch({
      ...peersKosong,
      [`GET ${SERVER_URL}`]: () =>
        responsJson(200, { success: true, data: [server()] }),
      [`DELETE ${SERVER_URL}/aa11`]: () =>
        responsJson(409, {
          success: false,
          error: "Server masih dipakai router",
          details: { routers: [] },
        }),
    });
    await render(panggung, <VpnServerPanel />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS Jakarta"),
      "daftar tampil",
    );
    await klikTombol("Hapus");
    await klikTombol("Ya, Hapus");
    await tungguSampai(
      () =>
        document.body.textContent.includes(
          "Server masih tercatat di router yang belum menerima daftar baru. Coba hapus lagi setelah beberapa menit.",
        ),
      "pesan router belum menerima tampil",
    );
    expect(document.body.textContent).not.toContain(
      "Keluarkan dari semua router",
    );
  });

  it("menampilkan kartu saat layanan VPN belum dikonfigurasi (503)", async () => {
    stubFetch({
      [`GET ${SERVER_URL}`]: () =>
        responsJson(503, { success: false, error: NOT_CONFIGURED }),
    });
    await render(panggung, <VpnServerPanel />);
    await tungguSampai(
      () => document.body.textContent.includes(NOT_CONFIGURED),
      "kartu 503 tampil",
    );
    expect(document.body.textContent).not.toContain("Tambah Server VPN");
  });

  it("berhenti polling begitu server melapor online", async () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
    let status = "pending_install";
    const fetchPalsu = stubFetch({
      ...peersKosong,
      [`GET ${SERVER_URL}`]: () =>
        responsJson(200, {
          success: true,
          data: [server({ status })],
        }),
      [`POST ${SERVER_URL}`]: () =>
        responsJson(201, {
          success: true,
          data: {
            server: server({ status: "pending_install" }),
            installCommand: "curl -fsSL https://x | sudo bash",
          },
        }),
    });
    await render(panggung, <VpnServerPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await klikTombol("Tambah Server VPN");
    await isiMedan("input[name=name]", "VPS Jakarta");
    await isiMedan("input[name=publicHost]", "vpn.contoh.com");
    await klikTombol("Buat Server");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.body.textContent).toContain(
      "curl -fsSL https://x | sudo bash",
    );
    expect(document.body.textContent).toContain(
      "Jalankan sebagai root di VPS. Perintah berlaku 1 jam.",
    );

    const getCalls = () =>
      fetchPalsu.mock.calls.filter(
        ([url, init]) => url === SERVER_URL && !init?.method,
      ).length;
    const before = getCalls();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(getCalls()).toBeGreaterThan(before);
    expect(cari("pre")?.textContent).toContain("curl");
    expect(document.body.textContent).toContain("Menunggu server tersambung");

    status = "online";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(document.body.textContent).toContain("Server tersambung");

    const afterOnline = getCalls();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 4);
    });
    expect(getCalls()).toBe(afterOnline);
  });
});
