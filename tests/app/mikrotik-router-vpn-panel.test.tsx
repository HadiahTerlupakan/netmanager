// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Panel VPN pada halaman edit router: daftar server berurut, badge server
 * cadangan, tombol kembali ke server pertama, peringatan skrip basi, dan
 * status "Tunnel putus" pada tabel daftar.
 */

const palsu = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "r1" }),
}));

vi.mock("react-hot-toast", () => ({ toast: palsu.toast }));

import { RouterVpnPanel } from "@/app/admin/network/mikrotik/[id]/edit/RouterVpnPanel";
import { ClientComponent as MikrotikEditClient } from "@/app/admin/network/mikrotik/[id]/edit/MikrotikEditClient";
import { MikrotikRouterTable } from "@/app/admin/network/mikrotik/components/mikrotikRouterTable";

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
const VPN_URL = "/api/mikrotik-routers/r1/vpn";
const FIRST_SERVER_URL = "/api/mikrotik-routers/r1/vpn/first-server";
const SERVERS_URL = "/api/vpn-servers";
const STALE_WARNING =
  "Daftar server belum terkirim ke router. Akan dicoba lagi saat router online.";
const RETURN_BUTTON = "Kembalikan ke server pertama";

const TENANT_SERVERS = [
  { id: "aa11", name: "VPS Jakarta", publicHost: "jkt.vpn", status: "online" },
  { id: "bb22", name: "VPS Surabaya", publicHost: "sby.vpn", status: "online" },
  { id: "cc33", name: "VPS Medan", publicHost: "mdn.vpn", status: "online" },
];

function detail(overrides: Record<string, unknown> = {}) {
  return {
    servers: [
      { id: "aa11", name: "VPS Jakarta", priority: 0 },
      { id: "bb22", name: "VPS Surabaya", priority: 1 },
    ],
    activeServerId: "aa11",
    isOnBackup: false,
    lastHandshakeAt: null as string | null,
    events: [] as { fromHubId: string; toHubId: string; at: string }[],
    scriptStale: false,
    ...overrides,
  };
}

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

function baseRoutes(vpn: () => unknown): Record<string, Route> {
  return {
    [`GET ${VPN_URL}`]: () => responsJson(200, { success: true, data: vpn() }),
    [`GET ${SERVERS_URL}`]: () =>
      responsJson(200, { success: true, data: { servers: TENANT_SERVERS } }),
  };
}

describe("RouterVpnPanel", () => {
  let panggung: Panggung;

  beforeEach(() => {
    panggung = pasangPanggung();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  async function mount() {
    await render(
      panggung,
      <RouterVpnPanel
        routerId="r1"
        publicIpAddress={null}
        onReverted={vi.fn()}
      />,
    );
    await tungguSampai(
      () => document.body.textContent.includes("Server aktif"),
      "panel termuat",
    );
  }

  it("menampilkan badge dan memposting kembali ke server pertama", async () => {
    let onBackup = true;
    const fetchPalsu = stubFetch({
      ...baseRoutes(() =>
        detail({ isOnBackup: onBackup, activeServerId: "bb22" }),
      ),
      [`POST ${FIRST_SERVER_URL}`]: () => {
        onBackup = false;
        return responsJson(200, { success: true, data: { success: true } });
      },
    });
    await mount();

    expect(document.body.textContent).toContain("Berjalan di server cadangan");
    expect(document.body.textContent).toContain("Server aktif: VPS Surabaya");

    await klikTombol(RETURN_BUTTON);
    await tungguSampai(
      () => !document.body.textContent.includes("Berjalan di server cadangan"),
      "panel dimuat ulang",
    );
    const posts = fetchPalsu.mock.calls.filter(
      ([url, init]) => url === FIRST_SERVER_URL && init?.method === "POST",
    );
    expect(posts).toHaveLength(1);
    expect(tombolBerteks(RETURN_BUTTON)!.disabled).toBe(true);
  });

  it("menonaktifkan tombol kembali saat tidak di server cadangan", async () => {
    stubFetch(baseRoutes(() => detail()));
    await mount();
    expect(tombolBerteks(RETURN_BUTTON)!.disabled).toBe(true);
  });

  it("menyimpan urutan baru lewat PUT dan memberi tahu", async () => {
    let body: unknown;
    stubFetch({
      ...baseRoutes(() => detail()),
      [`PUT ${VPN_URL}`]: (init) => {
        body = JSON.parse(String(init?.body));
        return responsJson(200, {
          success: true,
          data: { scriptStale: false },
        });
      },
    });
    await mount();

    cari<HTMLButtonElement>(
      'button[aria-label="Turunkan prioritas VPS Jakarta"]',
    )!.click();
    await tungguSampai(
      () => !tombolBerteks("Simpan Daftar Server")!.disabled,
      "perubahan terdeteksi",
    );
    await klikTombol("Simpan Daftar Server");
    await tungguSampai(() => body !== undefined, "PUT terkirim");

    expect(body).toEqual({ serverIds: ["bb22", "aa11"] });
    await tungguSampai(
      () => palsu.toast.success.mock.calls.length > 0,
      "toast berhasil",
    );
    expect(palsu.toast.success).toHaveBeenCalledWith("Daftar server tersimpan");
  });

  it("memperingatkan bila daftar tersimpan tetapi skrip belum terkirim", async () => {
    stubFetch({
      ...baseRoutes(() => detail()),
      [`PUT ${VPN_URL}`]: () =>
        responsJson(202, { success: true, data: { scriptStale: true } }),
    });
    await mount();

    cari<HTMLInputElement>("#vpn-server-cc33")!.click();
    await tungguSampai(
      () => !tombolBerteks("Simpan Daftar Server")!.disabled,
      "perubahan terdeteksi",
    );
    await klikTombol("Simpan Daftar Server");
    await tungguSampai(
      () => palsu.toast.mock.calls.length > 0,
      "toast peringatan",
    );

    expect(palsu.toast.mock.calls[0][0]).toBe(STALE_WARNING);
    expect(palsu.toast.success).not.toHaveBeenCalled();
  });

  it("menampilkan riwayat dengan nama server, terbaru dulu, maksimal 10", async () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      fromHubId: "aa11",
      toHubId: i === 11 ? "zz99" : "bb22",
      at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
    }));
    stubFetch(baseRoutes(() => detail({ events })));
    await mount();

    const items = [...document.body.querySelectorAll("ul")]
      .flatMap((ul) => [...ul.querySelectorAll(":scope > li")])
      .filter((li) => li.textContent.includes("→"));
    expect(items).toHaveLength(10);
    expect(items[0].textContent).toContain("VPS Jakarta → zz99");
    expect(items[1].textContent).toContain("VPS Jakarta → VPS Surabaya");
  });

  it("menampilkan panduan penutupan akses publik sebagai teks", async () => {
    stubFetch(baseRoutes(() => detail()));
    await mount();
    const text = document.body.textContent;
    expect(text).toContain("/ip service set api,winbox,ssh address=");
    expect(text).toContain("10.99.0.0/24,10.99.128.0/24");
    expect(text).toContain("mengunci admin");
  });

  it("menampilkan peringatan skrip basi dari server", async () => {
    stubFetch(baseRoutes(() => detail({ scriptStale: true })));
    await mount();
    expect(document.body.textContent).toContain(STALE_WARNING);
  });
});

describe("MikrotikRouterTable status", () => {
  let panggung: Panggung;
  beforeEach(() => {
    panggung = pasangPanggung();
  });
  afterEach(async () => {
    await bongkarPanggung(panggung);
  });

  it("menampilkan Tunnel putus dengan titik oranye", async () => {
    const router = {
      id: "r1",
      name: "RB-1",
      ipAddress: "10.99.0.5",
      timezone: "+07:00",
      description: null as string | null,
      pingStatus: "tunnel_down",
      userOnline: 0,
      lastStatusCheck: null as Date | null,
    };
    await render(
      panggung,
      <MikrotikRouterTable
        routers={[router]}
        total={1}
        totalPages={1}
        page={1}
        limit={10}
        loading={false}
        search=""
        pppConnectionMode="RADIUS"
        onSearchChange={vi.fn()}
        onLimitChange={vi.fn()}
        onPrevPage={vi.fn()}
        onNextPage={vi.fn()}
        onOpenReconfigure={vi.fn()}
        onTestConnection={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(document.body.textContent).toContain("Tunnel putus");
    expect(cari(".bg-orange-500")).not.toBeNull();
  });
});

describe("MikrotikEditClient", () => {
  let panggung: Panggung;
  beforeEach(() => {
    panggung = pasangPanggung();
  });
  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  function routerRoutes(connectionMode: "PUBLIC" | "VPN") {
    return {
      ...baseRoutes(() => detail()),
      "GET /api/settings/general": () =>
        responsJson(200, { data: { pppConnectionMode: "RADIUS" } }),
      "GET /api/settings/radius-defaults": () =>
        responsJson(200, { authPort: 1812, accountingPort: 1813 }),
      "GET /api/mikrotik-routers/r1": () =>
        responsJson(200, {
          success: true,
          data: {
            router: {
              name: "RB-1",
              ipAddress: "10.99.0.5",
              timezone: "+07:00 Asia/Jakarta",
              apiPort: 8728,
              apiUsername: "admin",
              apiPassword: "rahasia",
              connectionMode,
            },
          },
        }),
    };
  }

  it("router VPN: panel tampil dan kolom koneksi terkunci", async () => {
    stubFetch(routerRoutes("VPN"));
    await render(panggung, <MikrotikEditClient />);
    await tungguSampai(
      () => document.body.textContent.includes("Server aktif"),
      "panel VPN tampil",
    );
    const locked = [...document.body.querySelectorAll("input[readonly]")];
    expect(locked.length).toBeGreaterThanOrEqual(3);
  });

  it("router publik: tidak ada panel VPN dan kolom tidak terkunci", async () => {
    const fetchPalsu = stubFetch(routerRoutes("PUBLIC"));
    await render(panggung, <MikrotikEditClient />);
    await tungguSampai(
      () => document.body.textContent.includes("Edit Router"),
      "form tampil",
    );
    expect(document.body.textContent).not.toContain("Server aktif");
    expect(document.body.querySelectorAll("input[readonly]")).toHaveLength(0);
    expect(fetchPalsu.mock.calls.some(([url]) => url === VPN_URL)).toBe(false);
  });
});
