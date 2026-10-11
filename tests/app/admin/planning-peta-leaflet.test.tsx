// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import type { TitikRencanaDTO } from "@/modules/planning/client";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import PetaRencanaLeaflet from "@/app/admin/planning/[id]/peta/PetaRencanaLeaflet";

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

/**
 * Kanvas Leaflet peta rencana dirender sungguhan di jsdom.
 *
 * Tes lain mengganti komponen ini dengan tiruan supaya yang diperiksa adalah
 * keputusan di sekelilingnya. Yang dijaga di sini justru hal yang tidak bisa
 * dijamin pengetikan tipe: Leaflet, ikon node, polyline, dan penanda draf
 * benar-benar bisa dipasang tanpa melempar — satu-satunya berkas pada fitur
 * ini yang hanya dimuat lewat `dynamic(..., { ssr: false })`.
 */
describe("kanvas peta rencana OSP", () => {
  it("memasang node rencana, node nyata, jalur, dan penanda draf", async () => {
    const wadah = document.createElement("div");
    document.body.appendChild(wadah);
    await act(async () => {
      createRoot(wadah).render(
        <PetaRencanaLeaflet
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
          onKlikPeta={() => {}}
          onKlikTitik={() => {}}
          onHapusTitik={() => {}}
          onHapusJalur={() => {}}
        />,
      );
    });
    expect(document.body.textContent).toContain("Menggambar jalur");
    // Dua penanda node. Penanda draf koordinat sengaja tidak ikut selama
    // mode gambar jalur, supaya tidak tertukar dengan titik yang diklik.
    expect(wadah.querySelectorAll(".leaflet-marker-icon").length).toBe(2);
    // Satu garis jalur tersimpan plus satu garis jalur yang sedang digambar.
    expect(wadah.querySelectorAll("path.leaflet-interactive").length).toBe(2);
  });
});
