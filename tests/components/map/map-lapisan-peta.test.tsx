// @vitest-environment jsdom

import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lapisan di atas kanvas peta: pratinjau jalur, penanda sementara, dan kabel
 * terpasang.
 *
 * Ketiganya dulu memanggil `react-leaflet` langsung. Kini lewat pasangan
 * universal, jadi yang dijaga di sini adalah isinya — jejak, koordinat,
 * ikon, dan popup — bukan mesin yang menggambarnya. Dirender pada mesin
 * Google (tiruan SDK) karena atributnya bisa dibaca kembali apa adanya.
 */

const keadaanGoogle = vi.hoisted(() => ({ siap: true }));

vi.mock("@/contexts/GoogleMapsContext", () => ({
  useGoogleMaps: () => ({
    siap: keadaanGoogle.siap,
    mapId: "peta-uji",
    memuat: false,
  }),
}));

vi.mock("@vis.gl/react-google-maps", async () =>
  (await import("../../app/google-maps-harness")).modulGoogleMapsPalsu(),
);

import { JalurPratinjau } from "@/components/map/JalurPratinjau";
import { MapFiberDrawingInfoPanel } from "@/components/map/MapFiberDrawingInfoPanel";
import { MapFiberLinesLayer } from "@/components/map/MapFiberLinesLayer";
import {
  PenandaSementaraPeta,
  type TitikSementara,
} from "@/components/map/PenandaSementaraPeta";

import {
  jalurTerender,
  penandaTerender,
  petaPalsu,
  posisiElemen,
} from "../../app/google-maps-harness";
import {
  bongkarPanggung,
  pasangPanggung,
  render,
  type Panggung,
} from "../../app/presurvei-jsdom-harness";

/** Klik yang state React-nya ikut terbilas, supaya popup sempat terbuka. */
async function klik(elemen: HTMLElement): Promise<void> {
  await act(async () => {
    elemen.click();
  });
}

let panggung: Panggung;

beforeEach(() => {
  petaPalsu.reset();
  panggung = pasangPanggung();
});

afterEach(async () => {
  await bongkarPanggung(panggung);
});

describe("JalurPratinjau", () => {
  it("menggambar jalur dari titik asal melewati tiap titik belok", async () => {
    await render(
      panggung,
      <JalurPratinjau
        aktif
        asal={{ lat: -6.2, lng: 106.8 }}
        belokan={[
          [-6.21, 106.81],
          [-6.22, 106.82],
        ]}
      />,
    );

    const jalur = jalurTerender();
    expect(jalur).toHaveLength(1);
    expect(JSON.parse(jalur[0].getAttribute("data-jejak"))).toEqual([
      { lat: -6.2, lng: 106.8 },
      { lat: -6.21, lng: 106.81 },
      { lat: -6.22, lng: 106.82 },
    ]);
    // Kuning, bukan warna jenis kabel: garis ini belum tersimpan.
    expect(jalur[0].getAttribute("data-warna")).toBe("#facc15");
    expect(jalur[0].getAttribute("data-putus")).toBe("ya");
  });

  it("tidak menggambar apa pun di luar mode gambar jalur", async () => {
    await render(
      panggung,
      <JalurPratinjau
        aktif={false}
        asal={{ lat: -6.2, lng: 106.8 }}
        belokan={[[-6.21, 106.81]]}
      />,
    );

    expect(jalurTerender()).toHaveLength(0);
  });

  it("tidak menggambar apa pun sebelum ada satu pun titik belok", async () => {
    await render(
      panggung,
      <JalurPratinjau aktif asal={{ lat: -6.2, lng: 106.8 }} belokan={[]} />,
    );

    expect(jalurTerender()).toHaveLength(0);
  });
});

describe("PenandaSementaraPeta", () => {
  const pindahOdc = vi.fn();
  const pindahOdp = vi.fn();

  const titik: TitikSementara[] = [
    {
      alat: "odc",
      jenisIkon: "odc",
      label: "New ODC Position",
      posisi: [-6.21, 106.81],
      pindahkan: pindahOdc,
    },
    {
      alat: "odp",
      jenisIkon: "odp",
      label: "Editing Position",
      posisi: [-6.22, 106.82],
      pindahkan: pindahOdp,
    },
  ];

  beforeEach(() => {
    pindahOdc.mockClear();
    pindahOdp.mockClear();
  });

  it("merender satu penanda yang bisa diseret per titik sementara", async () => {
    await render(panggung, <PenandaSementaraPeta titik={titik} />);

    const penanda = penandaTerender();
    expect(penanda).toHaveLength(2);
    expect(penanda.map(posisiElemen)).toEqual([
      { lat: -6.21, lng: 106.81 },
      { lat: -6.22, lng: 106.82 },
    ]);
    expect(
      penanda.map((satu) => satu.getAttribute("data-dapat-diseret")),
    ).toEqual(["ya", "ya"]);
  });

  it("melaporkan koordinat baru ke alat yang bersangkutan setelah diseret", async () => {
    await render(panggung, <PenandaSementaraPeta titik={titik} />);

    petaPalsu.seretPenanda("New ODC Position", -6.26, 106.86);

    expect(pindahOdc).toHaveBeenCalledWith([-6.26, 106.86]);
    // Menyeret satu penanda tidak boleh menggeser alat lain.
    expect(pindahOdp).not.toHaveBeenCalled();
  });

  it("menyebutkan koordinat di popup setiap penanda, bukan hanya penanda server", async () => {
    await render(panggung, <PenandaSementaraPeta titik={titik} />);

    await klik(penandaTerender()[1]);

    const popup = document.body.querySelector("[data-popup]");
    expect(popup?.textContent).toContain("Editing Position");
    expect(popup?.textContent).toContain("-6.220000, 106.820000");
  });
});

describe("MapFiberLinesLayer", () => {
  it("menggambar kabel terpasang beserta rincian di popup-nya", async () => {
    await render(
      panggung,
      <MapFiberLinesLayer
        edges={[
          {
            edgeId: "edge-1",
            source: "node-1",
            target: "node-2",
            fiberType: "distribution",
            waypoints: JSON.stringify([[-6.21, 106.81]]),
          },
        ]}
        nodes={[
          {
            nodeId: "node-1",
            name: "ODC Alpha",
            latitude: -6.2,
            longitude: 106.8,
          },
          {
            nodeId: "node-2",
            name: "ODP Beta",
            latitude: -6.22,
            longitude: 106.82,
          },
        ]}
        onDeleteEdge={vi.fn()}
      />,
    );

    const jalur = jalurTerender();
    expect(jalur).toHaveLength(1);
    expect(JSON.parse(jalur[0].getAttribute("data-jejak"))).toEqual([
      { lat: -6.2, lng: 106.8 },
      { lat: -6.21, lng: 106.81 },
      { lat: -6.22, lng: 106.82 },
    ]);
    // Warna jenis kabel; sama dengan peta mobile dan daftar.
    expect(jalur[0].getAttribute("data-warna")).toBe("#60a5fa");

    await klik(jalur[0]);
    const popup = document.body.querySelector("[data-popup]");
    expect(popup?.textContent).toContain("ODC Alpha");
    expect(popup?.textContent).toContain("ODP Beta");
    expect(popup?.textContent).toContain("Delete Fiber Line");
  });
});

describe("MapFiberDrawingInfoPanel", () => {
  it("menyebut titik asal, jumlah titik belok, dan panjangnya", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MapFiberDrawingInfoPanel, {
        fiberLineMode: "drawing",
        fiberSourceNode: {
          name: "ODC Alpha",
          latitude: -6.2,
          longitude: 106.8,
        },
        fiberWaypoints: [
          [-6.21, 106.81],
          [-6.22, 106.82],
        ],
      }),
    );

    expect(markup).toContain("Drawing Fiber Line");
    expect(markup).toContain("ODC Alpha");
    expect(markup).toContain("Click target node");
    expect(markup).toContain("Waypoints:");
    expect(markup).toContain("3135.9 m");
  });
});
