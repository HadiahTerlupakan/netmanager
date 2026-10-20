// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-hot-toast", async () =>
  (await import("./presurvei-jsdom-harness")).modulToastPalsu(vi.fn(), vi.fn()),
);
vi.mock("next/link", () => ({ default: (): null => null }));

import TenantVpnClient from "@/app/admin/tenants/[id]/vpn/TenantVpnClient";

import {
  bongkarPanggung,
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
});
