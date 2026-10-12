// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TitikRencanaDTO } from "@/modules/planning/client";

/**
 * Kanvas peta rencana OSP pada kedua mesin peta.
 *
 * Komponennya tidak lagi menyebut Leaflet: ia memakai pasangan universal,
 * yang memilih mesinnya dari setelan tenant. Dua jalur itu harus sama-sama
 * dijaga — penanda dan garis yang salah mesin tidak tampil sama sekali dan
 * tidak melaporkan galat apa pun, jadi "tidak ada error" bukan bukti.
 *
 * Jalur Leaflet dirender sungguhan di jsdom (mesin cadangan yang dipakai
 * hari ini); jalur Google memakai tiruan SDK, karena Maps JavaScript tidak
 * bisa dimuat tanpa API key yang sah.
 */

const keadaanGoogle = vi.hoisted(() => ({ siap: false }));

vi.mock("@/contexts/GoogleMapsContext", () => ({
  useGoogleMaps: () => ({
    siap: keadaanGoogle.siap,
    mapId: "peta-uji",
    memuat: false,
  }),
}));

vi.mock("@vis.gl/react-google-maps", async () =>
  (await import("../google-maps-harness")).modulGoogleMapsPalsu(),
);

import PetaRencana from "@/app/admin/planning/[id]/peta/PetaRencana";

import {
  jalurTerender,
  penandaTerender,
  posisiElemen,
} from "../google-maps-harness";
import {
  bongkarPanggung,
  pasangPanggung,
  render,
  tungguSampai,
  type Panggung,
} from "../presurvei-jsdom-harness";

const rencana: TitikRencanaDTO = {
  nodeId: "n1",
  planningId: "p1",
  type: "odp",
  name: "A",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
  notes: null,
  isPlanned: true,
};

const nyata: TitikRencanaDTO = {
  nodeId: "n2",
  planningId: null,
  type: "odc",
  name: "B",
  latitude: -6.21,
  longitude: 106.81,
  splitter: null,
  notes: null,
  isPlanned: false,
};

function petaRencana() {
  return (
    <PetaRencana
      planningId="p1"
      titikRencana={[rencana]}
      nodeNyata={[nyata]}
      jalur={[
        {
          edgeId: "e1",
          planningId: "p1",
          source: "n1",
          target: "n2",
          fiberType: "feeder",
          waypoints: [[-6.205, 106.805]],
          distance: 100,
          notes: null,
          isPlanned: true,
        },
      ]}
      pusat={[-6.2, 106.8]}
      koordinatDraf={[-6.22, 106.82]}
      jalurDraf={{ sumber: rencana, waypoints: [[-6.203, 106.803]] }}
      sedangGambarJalur
      dapatDiubah
      dapatUnggahFoto
      isSedangDihapus={() => false}
      isSedangDiubah={() => false}
      isSedangUnggahFoto={() => false}
      onKlikPeta={() => {}}
      onKlikTitik={() => {}}
      onUbahTitik={() => {}}
      onHapusTitik={() => {}}
      onUnggahFotoTitik={() => {}}
      onHapusJalur={() => {}}
    />
  );
}

let panggung: Panggung;

beforeEach(() => {
  panggung = pasangPanggung();
});

afterEach(async () => {
  await bongkarPanggung(panggung);
  keadaanGoogle.siap = false;
});

describe("kanvas peta rencana OSP — mesin Leaflet", () => {
  beforeEach(() => {
    keadaanGoogle.siap = false;
  });

  it("memasang node rencana, node nyata, jalur, dan jalur draf", async () => {
    await render(panggung, petaRencana());

    // Potongan Leaflet dimuat lewat `dynamic`, jadi render pertama belum
    // memuatnya.
    await tungguSampai(
      () => document.body.querySelectorAll(".leaflet-marker-icon").length === 2,
      "dua penanda node terpasang di kanvas Leaflet",
    );

    expect(document.body.textContent).toContain("Menggambar jalur");
    // Penanda draf koordinat sengaja tidak ikut selama mode gambar jalur,
    // supaya tidak tertukar dengan titik yang diklik.
    expect(document.body.querySelectorAll(".leaflet-marker-icon").length).toBe(
      2,
    );
    // Satu jalur tersimpan plus satu jalur yang sedang digambar.
    expect(
      document.body.querySelectorAll("path.leaflet-interactive").length,
    ).toBe(2);
  });
});

describe("kanvas peta rencana OSP — mesin Google", () => {
  beforeEach(() => {
    keadaanGoogle.siap = true;
  });

  it("memasang penanda yang sama di koordinat yang sama", async () => {
    await render(panggung, petaRencana());

    const penanda = penandaTerender();
    expect(penanda).toHaveLength(2);
    // Menukar lat dengan lng tetap lolos pemeriksa tipe — keduanya `number` —
    // dan penandanya lalu hilang tanpa galat.
    expect(penanda.map(posisiElemen)).toEqual([
      { lat: -6.21, lng: 106.81 },
      { lat: -6.2, lng: 106.8 },
    ]);
  });

  it("menggambar jalur tersimpan dan jalur draf sebagai garis putus", async () => {
    await render(panggung, petaRencana());

    const jalur = jalurTerender();
    expect(jalur).toHaveLength(2);
    // Garis putus Google dibentuk dari simbol berulang, jadi garis dasarnya
    // sendiri harus tak terlihat; opasitas selain 0 berarti garis utuh.
    expect(jalur.map((satu) => satu.getAttribute("data-opasitas"))).toEqual([
      "0",
      "0",
    ]);
    expect(jalur[0].getAttribute("data-putus")).toBe("ya");

    // Jejak jalur tersimpan: asal → titik belok → tujuan.
    expect(JSON.parse(jalur[0].getAttribute("data-jejak"))).toEqual([
      { lat: -6.2, lng: 106.8 },
      { lat: -6.205, lng: 106.805 },
      { lat: -6.21, lng: 106.81 },
    ]);
  });

  it("menawarkan pemandangan jalan di popup titik rencana", async () => {
    await render(panggung, petaRencana());

    const penandaRencana = penandaTerender()[1];
    await tungguSampai(() => {
      penandaRencana.click();
      return document.body.textContent.includes("Lihat dari jalan");
    }, "popup titik rencana memuat tombol Street View");
  });
});
