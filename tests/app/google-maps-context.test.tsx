// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bongkarPanggung,
  pasangPanggung,
  render,
  responsJson,
  tungguSampai,
  type Panggung,
} from "./presurvei-jsdom-harness";

/**
 * Penyedia setelan peta untuk seluruh portal admin.
 *
 * Dua perilaku di sini punya konsekuensi tagihan dan konsol, bukan sekadar
 * kerapian: `APIProvider` hanya boleh dipasang sekali, dan tidak boleh
 * dipasang sama sekali selama API key belum ada.
 */

vi.mock("@vis.gl/react-google-maps", async () =>
  (await import("./google-maps-harness")).modulGoogleMapsPalsu(),
);

import {
  GoogleMapsProvider,
  useGoogleMaps,
} from "@/contexts/GoogleMapsContext";

const SETELAN_SIAP = {
  enabled: true,
  apiKey: "AIzaKunciUji",
  mapId: "peta-uji",
};

function Pembaca() {
  const { siap, mapId, memuat } = useGoogleMaps();
  return (
    <span data-pembaca data-siap={String(siap)} data-memuat={String(memuat)}>
      {mapId}
    </span>
  );
}

function pembaca(): HTMLElement {
  const elemen = document.body.querySelector<HTMLElement>("[data-pembaca]");
  if (!elemen) throw new Error("pembaca setelan tidak dirender");
  return elemen;
}

function penyedia(): Element | null {
  return document.body.querySelector("[data-google-maps-provider]");
}

let panggung: Panggung;

beforeEach(() => {
  vi.clearAllMocks();
  panggung = pasangPanggung();
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  vi.unstubAllGlobals();
});

async function renderDengan(badan: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(responsJson(status, { data: badan })),
  );

  await render(
    panggung,
    <GoogleMapsProvider>
      <Pembaca />
    </GoogleMapsProvider>,
  );

  await tungguSampai(
    () => pembaca().getAttribute("data-memuat") === "false",
    "setelan peta selesai dimuat",
  );
}

describe("GoogleMapsProvider", () => {
  it("menyatakan siap dan meneruskan Map ID saat setelannya lengkap", async () => {
    await renderDengan(SETELAN_SIAP);

    expect(pembaca().getAttribute("data-siap")).toBe("true");
    expect(pembaca().textContent).toBe("peta-uji");
  });

  it("memasang APIProvider hanya saat key ada", async () => {
    await renderDengan(SETELAN_SIAP);

    expect(penyedia()).not.toBeNull();
  });

  it("tidak memasang APIProvider tanpa key", async () => {
    // Dipasang dengan key kosong, SDK Google mengeluh ke konsol di SETIAP
    // halaman admin, termasuk yang tidak punya peta sama sekali.
    await renderDengan({ enabled: false, apiKey: "", mapId: "" });

    expect(penyedia()).toBeNull();
    expect(pembaca().getAttribute("data-siap")).toBe("false");
  });

  it("menolak setelan aktif yang kehilangan Map ID", async () => {
    // Tanpa Map ID, AdvancedMarker gagal diam-diam: petanya tampil, seluruh
    // penandanya tidak, dan tidak ada galat apa pun.
    await renderDengan({ ...SETELAN_SIAP, mapId: "" });

    expect(pembaca().getAttribute("data-siap")).toBe("false");
  });

  it("mengambil setelan tepat sekali", async () => {
    await renderDengan(SETELAN_SIAP);

    // Tiap pemuatan skrip Maps dihitung sebagai map load berbayar; pengambilan
    // berulang adalah gejala pertama provider yang terpasang lebih dari sekali.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/settings/maps");
  });

  it("tetap merender anak-anaknya ketika endpoint gagal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("jaringan")));

    await render(
      panggung,
      <GoogleMapsProvider>
        <Pembaca />
      </GoogleMapsProvider>,
    );

    await tungguSampai(
      () => pembaca().getAttribute("data-memuat") === "false",
      "pengambilan setelan selesai",
    );

    // Peta satu modul tidak boleh menjatuhkan seluruh portal admin.
    expect(pembaca().getAttribute("data-siap")).toBe("false");
    expect(penyedia()).toBeNull();
  });
});
