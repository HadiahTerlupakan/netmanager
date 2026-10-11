// @vitest-environment jsdom

import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  bongkarPanggung,
  cari,
  klikTombol,
  pasangPanggung,
  render,
  tombolBerteks,
  type Panggung,
} from "../presurvei-jsdom-harness";

import { PopupTitikRencana } from "@/app/admin/planning/[id]/peta/PopupTitikRencana";
import type { TitikRencanaDTO } from "@/modules/planning/client";

const titik: TitikRencanaDTO = {
  nodeId: "node-1",
  planningId: "plan-1",
  type: "odp",
  name: "ODP-CPN-01",
  latitude: -6.2,
  longitude: 106.8,
  splitter: "1:8",
  notes: null,
  isPlanned: true,
};

/**
 * Isi popup titik rencana — tiga pintu masuk per titik yang sebelumnya tidak
 * ada di layar sama sekali: ubah, hapus, dan unggah foto. Diuji di komponen
 * sendiri karena popup Leaflet baru masuk DOM ketika dibuka.
 */
describe("popup titik rencana", () => {
  let panggung: Panggung;
  let onUbah: Mock<(titik: TitikRencanaDTO) => void>;
  let onHapus: Mock<(titik: TitikRencanaDTO) => void>;
  let onUnggahFoto: Mock<(nodeId: string, file: File) => void>;

  async function renderPopup(
    timpa: Partial<React.ComponentProps<typeof PopupTitikRencana>> = {},
  ) {
    await render(
      panggung,
      <PopupTitikRencana
        titik={titik}
        dapatDiubah
        dapatUnggahFoto
        sedangDihapus={false}
        sedangDiubah={false}
        sedangUnggahFoto={false}
        onUbah={onUbah}
        onHapus={onHapus}
        onUnggahFoto={onUnggahFoto}
        {...timpa}
      />,
    );
  }

  beforeEach(() => {
    onUbah = vi.fn();
    onHapus = vi.fn();
    onUnggahFoto = vi.fn();
    panggung = pasangPanggung();
  });

  afterEach(async () => {
    await bongkarPanggung(panggung);
    vi.clearAllMocks();
  });

  it("menawarkan ubah titik, bukan hanya hapus", async () => {
    await renderPopup();

    await klikTombol("Ubah titik");

    expect(onUbah).toHaveBeenCalledWith(titik);
    expect(tombolBerteks("Hapus titik")).toBeDefined();
  });

  it("mengirim berkas yang dipilih beserta nodeId-nya", async () => {
    await renderPopup();

    const input = cari<HTMLInputElement>(`#foto-titik-${titik.nodeId}`);
    expect(input).not.toBeNull();
    expect(input!.accept).toBe("image/*");

    const file = new File(["x"], "odp.jpg", { type: "image/jpeg" });
    Object.defineProperty(input!, "files", { value: [file] });
    input!.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onUnggahFoto).toHaveBeenCalledWith(titik.nodeId, file);
  });

  it("menonaktifkan pemilih berkas selama unggah berjalan", async () => {
    await renderPopup({ sedangUnggahFoto: true });

    expect(
      cari<HTMLInputElement>(`#foto-titik-${titik.nodeId}`)?.disabled,
    ).toBe(true);
  });

  it("menyembunyikan ubah dan hapus saat peta terkunci status, tetapi tetap membuka unggah foto", async () => {
    // Unggah foto sengaja tidak terkunci status (lihat
    // `PlanningDocumentService`): foto hasil pekerjaan baru ada setelah
    // titiknya dibangun, yaitu justru ketika rencananya sudah disetujui.
    await renderPopup({ dapatDiubah: false });

    expect(tombolBerteks("Ubah titik")).toBeUndefined();
    expect(tombolBerteks("Hapus titik")).toBeUndefined();
    expect(cari(`#foto-titik-${titik.nodeId}`)).not.toBeNull();
  });

  it("menyembunyikan unggah foto bagi akun tanpa izin ubah planning", async () => {
    await renderPopup({ dapatUnggahFoto: false });

    expect(cari(`#foto-titik-${titik.nodeId}`)).toBeNull();
  });
});
