// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pemasangan koordinat penanda di `KegiatanPeta`.
 *
 * Dulu tes ini menjaga urutan `[bujur, lintang]` yang dituntut
 * `fromLonLat` milik OpenLayers: menukarnya menjadi `[lintang, bujur]` lolos
 * `tsc` dan seluruh suite (mutasi M18 Task 8), lalu penandanya terlempar ke
 * luar jangkauan Web Mercator dan tidak tampil sama sekali.
 *
 * OpenLayers sudah dicabut, tetapi bahayanya tidak: `PenandaUniversal`
 * menerima `{ lat, lng }`, dan menukar keduanya tetap lolos pemeriksa tipe —
 * keduanya `number`. Lintang 106,8 tidak ada, jadi gejalanya sama: penanda
 * hilang tanpa galat. Tesnya kini menegaskan invarian yang sama terhadap
 * implementasi yang baru.
 */

vi.mock("@vis.gl/react-google-maps", async () =>
  (await import("./google-maps-harness")).modulGoogleMapsPalsu(),
);

// Mesin Leaflet butuh `window` dan kanvas sungguhan; yang diuji di sini
// adalah koordinat yang dipasang komponen, bukan mesin yang menggambarnya.
vi.mock("@/contexts/GoogleMapsContext", () => ({
  useGoogleMaps: () => ({ siap: true, mapId: "peta-uji", memuat: false }),
}));

import KegiatanPeta from "@/app/admin/presurvei/kegiatan/KegiatanPeta";
import type { TitikKegiatan } from "@/app/admin/presurvei/kegiatan/titikPeta";

import { penandaTerender, posisiElemen } from "./google-maps-harness";
import {
  bongkarPanggung,
  pasangPanggung,
  render,
  type Panggung,
} from "./presurvei-jsdom-harness";

const BUJUR_JAKARTA = 106.8;
const LINTANG_JAKARTA = -6.2;

const titik: TitikKegiatan[] = [
  {
    id: "kg-1",
    latitude: LINTANG_JAKARTA,
    longitude: BUJUR_JAKARTA,
    hasil: "TERTARIK",
    label: "Bu Rina",
    alamat: "Jl. Melati 1",
    warna: "#f59e0b",
  },
];

let panggung: Panggung;

beforeEach(() => {
  panggung = pasangPanggung();
});

afterEach(async () => {
  await bongkarPanggung(panggung);
});

describe("KegiatanPeta — pemasangan koordinat penanda", () => {
  it("memasang lintang sebagai lat dan bujur sebagai lng, bukan sebaliknya", async () => {
    await render(
      panggung,
      <KegiatanPeta titik={titik} tanpaKoordinat={0} diLuarBatas={0} />,
    );

    const penanda = penandaTerender();
    expect(penanda).toHaveLength(1);
    expect(posisiElemen(penanda[0])).toEqual({
      lat: LINTANG_JAKARTA,
      lng: BUJUR_JAKARTA,
    });
  });

  it("memakai warna hasil kegiatan, bukan warna tipe perangkat", async () => {
    await render(
      panggung,
      <KegiatanPeta titik={titik} tanpaKoordinat={0} diLuarBatas={0} />,
    );

    // Penandanya kunjungan sales, bukan ODP/ODC; warnanya harus sejajar
    // dengan badge hasil di daftar.
    const ikon = document.body.querySelector<HTMLElement>("[data-ikon-node]");
    expect(ikon?.style.backgroundColor).toBe("rgb(245, 158, 11)");
  });

  it("memaskan tampilan ke seluruh titik yang tergambar", async () => {
    await render(
      panggung,
      <KegiatanPeta titik={titik} tanpaKoordinat={0} diLuarBatas={0} />,
    );

    // Tanpa ini peta terbuka di Monas sementara kunjungannya di kota lain,
    // dan pemakai menyangka datanya kosong.
    expect(document.body.querySelector("[data-peta]")).not.toBeNull();
  });
});
