// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastPalsu = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(
    toastPalsu.success,
    toastPalsu.error,
  ),
);
vi.mock("next/link", () => ({ default: (): null => null }));

import TenantVpnClient from "@/app/admin/tenants/[id]/vpn/TenantVpnClient";

import {
  bongkarPanggung,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

describe("TenantVpnClient", () => {
  let panggung: Panggung;

  beforeEach(() => {
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.unstubAllGlobals();
  });

  it("gagal memuat assignment: tampil galat dan tidak ada checklist yang bisa disimpan", async () => {
    const fetchPalsu = vi.fn(async (url: string, _init?: RequestInit) =>
      url === "/api/admin/vpn-servers"
        ? responsJson(200, {
            success: true,
            data: [
              {
                id: "aa11",
                name: "VPS Jakarta",
                publicHost: "h",
                listenPort: 1,
                status: "online",
                routerCount: 0,
                tenantCount: 0,
                lastSeenAt: null,
              },
            ],
          })
        : responsJson(500, { success: false, error: "boom" }),
    );
    vi.stubGlobal("fetch", fetchPalsu);
    await render(panggung, <TenantVpnClient tenantId="t1" />);
    await tungguSampai(
      () =>
        document.body.textContent.includes(
          "Gagal memuat server VPN tenant ini",
        ),
      "galat assignment tampil",
    );
    expect(document.body.querySelector("input[type=checkbox]")).toBeNull();
    const simpan = [...document.body.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Tidak ada perubahan"),
    );
    expect(simpan?.disabled).toBe(true);
    expect(
      fetchPalsu.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      ),
    ).toBe(false);
  });

  function server(id: string, status: string) {
    return {
      id,
      name: `VPS ${id}`,
      publicHost: "h",
      listenPort: 1,
      status,
      routerCount: 0,
      tenantCount: 0,
      lastSeenAt: null as string | null,
    };
  }

  function stubFetch(updated: number) {
    const fetchPalsu = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return responsJson(200, { success: true, data: { updated } });
      }
      if (url === "/api/admin/vpn-servers") {
        return responsJson(200, {
          success: true,
          data: [server("aa11", "online"), server("bb22", "offline")],
        });
      }
      return responsJson(200, {
        success: true,
        data: { serverIds: ["aa11", "bb22"] },
      });
    });
    vi.stubGlobal("fetch", fetchPalsu);
    return fetchPalsu;
  }

  async function bukaKonfirmasi(): Promise<void> {
    await render(panggung, <TenantVpnClient tenantId="t1" />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS aa11"),
      "daftar server tampil",
    );
    await klikTombol("Tambahkan ke semua router VPN");
  }

  it("hanya server online yang punya tombol tambah ke semua router", async () => {
    stubFetch(0);
    await render(panggung, <TenantVpnClient tenantId="t1" />);
    await tungguSampai(
      () => document.body.textContent.includes("VPS bb22"),
      "daftar server tampil",
    );
    const tombol = [...document.body.querySelectorAll("button")].filter((b) =>
      b.textContent.includes("Tambahkan ke semua router VPN"),
    );
    expect(tombol).toHaveLength(1);
  });

  it("konfirmasi memanggil route dan menampilkan jumlah router", async () => {
    toastPalsu.success.mockClear();
    const fetchPalsu = stubFetch(3);
    await bukaKonfirmasi();
    expect(document.body.textContent).toContain("cadangan terakhir");
    expect(fetchPalsu.mock.calls.some(([, i]) => i?.method === "POST")).toBe(
      false,
    );

    await klikTombol("Ya, tambahkan");

    await tungguSampai(
      () => toastPalsu.success.mock.calls.length > 0,
      "toast sukses",
    );
    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/admin/tenants/t1/vpn-servers/aa11/routers",
      { method: "POST" },
    );
    expect(toastPalsu.success).toHaveBeenCalledWith(
      "Ditambahkan ke 3 router. Router menerima daftar baru dalam beberapa menit.",
    );
  });

  it("nol router berubah: pesan semua router sudah memakai server ini", async () => {
    toastPalsu.success.mockClear();
    stubFetch(0);
    await bukaKonfirmasi();
    await klikTombol("Ya, tambahkan");
    await tungguSampai(
      () => toastPalsu.success.mock.calls.length > 0,
      "toast sukses",
    );
    expect(toastPalsu.success).toHaveBeenCalledWith(
      "Semua router VPN tenant sudah memakai server ini",
    );
  });
});
