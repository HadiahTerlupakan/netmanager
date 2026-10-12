// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bongkarPanggung,
  cari,
  pasangPanggung,
  render,
  type Panggung,
} from "../../app/presurvei-jsdom-harness";
import {
  jalurTerender,
  penandaTerender,
  petaPalsu,
  posisiElemen,
} from "../../app/google-maps-harness";

/**
 * Primitif peta Google bersama (`components/map/google/`).
 *
 * SDK Maps JavaScript tidak bisa dimuat di jsdom, jadi pustakanya ditiru —
 * yang diuji di sini adalah keputusan komponen kita: penanda mana yang
 * dirender, di koordinat apa, warna jalur menurut jenis kabel, dan apa yang
 * tampil ketika peta belum dikonfigurasi.
 */

const palsu = vi.hoisted(() => ({
  setelanPeta: {
    siap: true,
    mapId: "peta-uji",
    memuat: false,
  },
}));

vi.mock("@vis.gl/react-google-maps", async () =>
  (await import("../../app/google-maps-harness")).modulGoogleMapsPalsu(),
);

vi.mock("@/contexts/GoogleMapsContext", () => ({
  useGoogleMaps: () => palsu.setelanPeta,
}));

import { JalurKabel } from "@/components/map/google/JalurKabel";
import { PenandaDapatDiseret } from "@/components/map/google/PenandaDapatDiseret";
import { PenandaNode } from "@/components/map/google/PenandaNode";
import { PetaGoogle } from "@/components/map/google/PetaGoogle";

const PUSAT = { lat: -6.9025, lng: 107.6186 };

let panggung: Panggung;

beforeEach(() => {
  vi.clearAllMocks();
  petaPalsu.reset();
  palsu.setelanPeta = { siap: true, mapId: "peta-uji", memuat: false };
  panggung = pasangPanggung();
});

afterEach(async () => {
  await bongkarPanggung(panggung);
});

describe("PetaGoogle", () => {
  it("memasang Map ID; tanpanya seluruh penanda hilang tanpa galat", async () => {
    await render(panggung, <PetaGoogle pusat={PUSAT} />);

    expect(cari("[data-peta]").getAttribute("data-map-id")).toBe("peta-uji");
  });

  it("memakai hybrid, bukan satellite polos", async () => {
    await render(panggung, <PetaGoogle pusat={PUSAT} />);

    // Citra satelit tanpa nama jalan tidak bisa dipakai menyusuri rute kabel,
    // dan itulah satu-satunya alasan peta ini ada.
    expect(cari("[data-peta]").getAttribute("data-tipe")).toBe("hybrid");
  });

  it("memakai roadmap pada gaya polos", async () => {
    await render(panggung, <PetaGoogle pusat={PUSAT} gaya="plain" />);

    expect(cari("[data-peta]").getAttribute("data-tipe")).toBe("roadmap");
  });

  it("menyebut Pengaturan saat key belum diisi, bukan kotak kosong", async () => {
    palsu.setelanPeta = { siap: false, mapId: "", memuat: false };

    await render(panggung, <PetaGoogle pusat={PUSAT} />);

    const panel = cari("[data-peta-keadaan='belum-dikonfigurasi']");
    expect(panel.textContent).toContain("Peta belum dikonfigurasi");
    // Tanpa petunjuk tempat mengisinya, satu-satunya gejala yang terlihat
    // pemakai adalah peta yang hilang.
    expect(panel.textContent).toContain("Pengaturan");
    expect(document.body.querySelector("[data-peta]")).toBeNull();
  });

  it("membedakan sedang memuat dari belum dikonfigurasi", async () => {
    palsu.setelanPeta = { siap: false, mapId: "", memuat: true };

    await render(panggung, <PetaGoogle pusat={PUSAT} />);

    expect(
      document.body.querySelector("[data-peta-keadaan='memuat']"),
    ).not.toBeNull();
    expect(
      document.body.querySelector("[data-peta-keadaan='belum-dikonfigurasi']"),
    ).toBeNull();
  });

  it("meneruskan koordinat klik kanvas", async () => {
    const onKlik = vi.fn();
    await render(panggung, <PetaGoogle pusat={PUSAT} onKlik={onKlik} />);

    petaPalsu.klikPeta(-6.91, 107.61);

    expect(onKlik).toHaveBeenCalledWith(-6.91, 107.61);
  });
});

describe("PenandaNode", () => {
  it("merender ikon menurut tipe titik", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaNode posisi={PUSAT} type="odc" title="ODC-01" />
      </PetaGoogle>,
    );

    const penanda = penandaTerender();
    expect(penanda).toHaveLength(1);
    expect(posisiElemen(penanda[0])).toEqual(PUSAT);
    expect(penanda[0].querySelector("[data-ikon-node='odc']")).not.toBeNull();
  });

  it("meredupkan node nyata yang hanya menjadi latar", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaNode posisi={PUSAT} type="odp" redup />
      </PetaGoogle>,
    );

    const ikon = cari<HTMLElement>("[data-ikon-node='odp']");
    expect(ikon.style.opacity).toBe("0.4");
  });

  it("membuka popup saat penanda diklik, dan menutupnya kembali", async () => {
    const { act } = await import("react");

    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaNode posisi={PUSAT} type="odp" popup={<p>Isi popup</p>} />
      </PetaGoogle>,
    );

    expect(document.body.querySelector("[data-popup]")).toBeNull();

    await act(async () => {
      cari("[data-penanda]").click();
    });
    expect(cari("[data-popup]").textContent).toContain("Isi popup");

    await act(async () => {
      cari("[data-tutup-popup]").click();
    });
    expect(document.body.querySelector("[data-popup]")).toBeNull();
  });

  it("tidak merender popup untuk penanda tanpa isi popup", async () => {
    const { act } = await import("react");
    const onKlik = vi.fn();

    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaNode posisi={PUSAT} type="odp" onKlik={onKlik} />
      </PetaGoogle>,
    );

    await act(async () => {
      cari("[data-penanda]").click();
    });

    expect(onKlik).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector("[data-popup]")).toBeNull();
  });
});

describe("PenandaDapatDiseret", () => {
  it("melaporkan koordinat baru setelah diseret", async () => {
    const onPindah = vi.fn();

    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaDapatDiseret
          posisi={PUSAT}
          type="odp"
          title="Titik baru"
          onPindah={onPindah}
        />
      </PetaGoogle>,
    );

    petaPalsu.seretPenanda("Titik baru", -6.95, 107.65);

    expect(onPindah).toHaveBeenCalledWith(-6.95, 107.65);
  });

  it("ditandai dapat diseret, tidak seperti penanda biasa", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <PenandaNode posisi={PUSAT} type="odp" title="Tetap" />
        <PenandaDapatDiseret
          posisi={PUSAT}
          type="odp"
          title="Geser"
          onPindah={vi.fn()}
        />
      </PetaGoogle>,
    );

    const penanda = penandaTerender();
    expect(penanda[0].getAttribute("data-dapat-diseret")).toBeNull();
    expect(penanda[1].getAttribute("data-dapat-diseret")).toBe("ya");
  });
});

describe("JalurKabel", () => {
  const JEJAK = [
    { lat: -6.9025, lng: 107.6186 },
    { lat: -6.9039, lng: 107.6201 },
  ];

  it("mewarnai garis menurut jenis kabel", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={JEJAK} fiberType="drop" />
      </PetaGoogle>,
    );

    // Warna yang sama dipakai peta operasional dan mobile; jenis kabel harus
    // terbaca sama di mana pun ia muncul.
    expect(jalurTerender()[0].getAttribute("data-warna")).toBe("#4ade80");
  });

  it("memberi warna netral untuk jenis yang tidak dikenal", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={JEJAK} fiberType="entah" />
      </PetaGoogle>,
    );

    expect(jalurTerender()[0].getAttribute("data-warna")).toBe("#9ca3af");
  });

  it("tidak merender apa pun untuk jejak kurang dari dua titik", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={[JEJAK[0]]} fiberType="drop" />
      </PetaGoogle>,
    );

    // Polyline bertitik tunggal tidak bisa digambar; merendernya hanya
    // menambah elemen tak terlihat yang membingungkan saat menelusuri bug.
    expect(jalurTerender()).toHaveLength(0);
  });

  it("menipiskan garis pratinjau supaya beda dari jalur tersimpan", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={JEJAK} fiberType="drop" pratinjau />
      </PetaGoogle>,
    );

    const jalur = jalurTerender()[0];
    expect(Number(jalur.getAttribute("data-bobot"))).toBe(3);
    expect(Number(jalur.getAttribute("data-opasitas"))).toBeLessThan(1);
  });

  it("hanya bisa diklik bila punya popup", async () => {
    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={JEJAK} fiberType="drop" />
        <JalurKabel jejak={JEJAK} fiberType="drop" popup={<p>Jalur A</p>} />
      </PetaGoogle>,
    );

    const jalur = jalurTerender();
    expect(jalur[0].getAttribute("data-dapat-diklik")).toBeNull();
    expect(jalur[1].getAttribute("data-dapat-diklik")).toBe("ya");
  });

  it("menaruh popup di titik tengah jejak, bukan di ujungnya", async () => {
    const { act } = await import("react");
    const jejakTiga = [
      { lat: -6.9, lng: 107.6 },
      { lat: -6.91, lng: 107.61 },
      { lat: -6.92, lng: 107.62 },
    ];

    await render(
      panggung,
      <PetaGoogle pusat={PUSAT}>
        <JalurKabel jejak={jejakTiga} fiberType="drop" popup={<p>Jalur A</p>} />
      </PetaGoogle>,
    );

    await act(async () => {
      cari("[data-jalur]").click();
    });

    expect(posisiElemen(cari("[data-popup]"))).toEqual(jejakTiga[1]);
  });
});
