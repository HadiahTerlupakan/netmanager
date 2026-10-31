// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bongkarPanggung,
  klikTombol,
  pasangPanggung,
  render,
  responsJson,
  tombolBerteks,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

const palsu = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  mutate: vi.fn(),
  configs: [] as unknown[],
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasPermission: palsu.hasPermission }),
}));
vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: palsu.configs,
    isLoading: false,
    mutate: palsu.mutate,
  }),
}));

import PaymentGatewayTab from "@/app/admin/pengaturan/payment-gateway/components/PaymentGatewayTab";

const TOMBOL_CABUT = "Cabut konfigurasi (kill switch)";

const duitku = (isRevoked: boolean) => ({
  id: "cfg-1",
  provider: "DUITKU",
  isEnabled: true,
  isRevoked,
  isProduction: false,
  priority: 0,
});

let panggung: Panggung;
let fetchPalsu: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  panggung = pasangPanggung();
  palsu.hasPermission.mockImplementation(
    (izin: string) => izin === "payment_gateway:update",
  );
  fetchPalsu = vi.fn(async () => responsJson(200, { success: true, data: {} }));
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

describe("sakelar darurat konfigurasi gateway", () => {
  it("mencabut setelah konfirmasi yang menjelaskan akibatnya", async () => {
    palsu.configs = [duitku(false)];

    await render(panggung, <PaymentGatewayTab />);
    await klikTombol(TOMBOL_CABUT);

    expect(document.body.textContent).toContain(
      "callback dan cek status untuk konfigurasi ini ditolak",
    );
    expect(fetchPalsu).not.toHaveBeenCalled();

    await klikTombol("Cabut konfigurasi");
    await tungguSampai(
      () => palsu.mutate.mock.calls.length > 0,
      "daftar konfigurasi dimuat ulang",
    );

    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/admin/payment-gateway/configs/DUITKU/revocation",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ isRevoked: true }),
      }),
    );
  });

  it("konfigurasi yang dicabut ditandai dan bisa dipulihkan", async () => {
    palsu.configs = [duitku(true)];

    await render(panggung, <PaymentGatewayTab />);
    expect(document.body.textContent).toContain("Dicabut");

    await klikTombol("Pulihkan");
    expect(document.body.textContent).toContain(
      "Pastikan kredensial yang bocor sudah diganti",
    );
    await klikTombol("Pulihkan konfigurasi");
    await tungguSampai(
      () => fetchPalsu.mock.calls.length > 0,
      "permintaan pemulihan terkirim",
    );

    expect(fetchPalsu).toHaveBeenCalledWith(
      "/api/admin/payment-gateway/configs/DUITKU/revocation",
      expect.objectContaining({ body: JSON.stringify({ isRevoked: false }) }),
    );
  });

  it("batal tidak mengubah apa pun", async () => {
    palsu.configs = [duitku(false)];

    await render(panggung, <PaymentGatewayTab />);
    await klikTombol(TOMBOL_CABUT);
    await klikTombol("Batal");

    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("tanpa izin payment_gateway:update tombolnya tidak tampil", async () => {
    palsu.hasPermission.mockReturnValue(false);
    palsu.configs = [duitku(false)];

    await render(panggung, <PaymentGatewayTab />);

    expect(tombolBerteks(TOMBOL_CABUT)).toBeUndefined();
  });

  it("provider tanpa konfigurasi tidak punya tombol cabut", async () => {
    palsu.configs = [];

    await render(panggung, <PaymentGatewayTab />);

    expect(tombolBerteks(TOMBOL_CABUT)).toBeUndefined();
  });
});
