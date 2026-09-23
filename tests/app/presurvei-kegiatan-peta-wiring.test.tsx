// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Titik pakai `koordinatLonLat` di `KegiatanPeta`.
 *
 * `koordinatLonLat` diuji murni di `presurvei-titik-peta.test.ts`, tapi itu
 * memaku urutan di dalam fungsinya, bukan pemakaiannya: mengganti
 * `fromLonLat(koordinatLonLat(item))` kembali jadi literal
 * `[item.latitude, item.longitude]` lolos `tsc` dan seluruh suite (mutasi M18
 * Task 8). Lintang 106,8 tidak ada, sehingga penanda terlempar keluar
 * jangkauan Web Mercator dan tidak tampil.
 *
 * Kelas-kelas OpenLayers yang menyentuh kanvas dipalsukan menjadi perekam
 * argumen konstruktor; `ol/proj` dibiarkan ASLI supaya koordinat yang
 * ditegaskan adalah hasil proyeksi sungguhan dari [bujur, lintang].
 */

const palsu = vi.hoisted(() => ({
  titikDibangun: [] as unknown[],
}));

vi.mock("ol/ol.css", () => ({}));

vi.mock("ol", () => ({
  Map: class {
    addOverlay() {}
    on() {}
    setTarget() {}
    getView() {
      return { fit() {} };
    }
  },
  View: class {},
}));

vi.mock("ol/layer/Tile", () => ({ default: class {} }));

vi.mock("ol/layer/Vector", () => ({
  default: class {
    private readonly sumber: unknown;
    constructor(opsi: { source: unknown }) {
      this.sumber = opsi.source;
    }
    getSource() {
      return this.sumber;
    }
  },
}));

vi.mock("ol/source/Vector", () => ({
  default: class {
    clear() {}
    addFeature() {}
    getExtent() {
      return [Infinity, Infinity, -Infinity, -Infinity];
    }
  },
}));

vi.mock("ol/source/OSM", () => ({ default: class {} }));

vi.mock("ol/Overlay", () => ({
  default: class {
    setPosition() {}
  },
}));

vi.mock("ol/control", () => ({
  defaults: () => ({ extend: (): unknown[] => [] }),
  Attribution: class {},
  FullScreen: class {},
  Zoom: class {},
}));

vi.mock("ol/Feature", () => ({
  default: class {
    setId() {}
    setStyle() {}
  },
}));

vi.mock("ol/geom/Point", () => ({
  default: class {
    constructor(koordinat: unknown) {
      palsu.titikDibangun.push(koordinat);
    }
  },
}));

vi.mock("ol/style", () => ({
  Fill: class {},
  Stroke: class {},
  Style: class {},
}));

vi.mock("ol/style/Circle", () => ({ default: class {} }));

import { fromLonLat } from "ol/proj";

import KegiatanPeta from "@/app/admin/presurvei/kegiatan/KegiatanPeta";
import type { TitikKegiatan } from "@/app/admin/presurvei/kegiatan/titikPeta";

import {
  bongkarPanggung,
  pasangPanggung,
  render,
  tungguSampai,
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
  palsu.titikDibangun.length = 0;
});

afterEach(async () => {
  await bongkarPanggung(panggung);
});

describe("KegiatanPeta — pemasangan koordinat penanda", () => {
  it("memproyeksikan penanda dari [bujur, lintang], bukan [lintang, bujur]", async () => {
    await render(
      panggung,
      <KegiatanPeta titik={titik} tanpaKoordinat={0} diLuarBatas={0} />,
    );

    await tungguSampai(
      () => palsu.titikDibangun.length === 1,
      "penanda dibangun",
    );

    const [koordinat] = palsu.titikDibangun as number[][];
    expect(koordinat).toEqual(fromLonLat([BUJUR_JAKARTA, LINTANG_JAKARTA]));
    // Jangkar nilai mentah Web Mercator: Jakarta berada ~11,9 juta m di timur
    // dan ~0,69 juta m di selatan khatulistiwa.
    expect(Math.round(koordinat[0] / 1000)).toBe(11889);
    expect(Math.round(koordinat[1] / 1000)).toBe(-692);
  });
});
