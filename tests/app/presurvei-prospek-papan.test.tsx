// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel JSX papan prospek dan kartunya.
 *
 * Fungsi murni dan hook-nya sudah diuji tanpa DOM. Yang dikunci di sini adalah
 * titik pakainya: penanda kartu tak bertuan, kolom mati yang tersembunyi di
 * balik sakelar, kerangka yang dirender DI DALAM kolom (bukan menggantikan
 * papan), dan tombol "muat lebih".
 *
 * `useProspekKolom` di-mock, jadi tidak ada jaringan, provider, atau polling —
 * render sinkron lalu baca DOM, seperti
 * `tests/app/presurvei-kegiatan-filters.test.tsx`.
 *
 * Kabel seret juga dikunci di sini (Task 12): `usePindahProspek` dan
 * `usePermission` di-mock, dan event seret dibuat tangan karena jsdom tidak
 * membawa `DataTransfer`. Keputusannya sendiri diuji tanpa DOM di
 * `presurvei-seret-prospek.test.ts`.
 */

import type {
  ProspekListItemDto,
  ProspekStatus,
} from "@/modules/presurvei/client";

type KolomPalsu = {
  kartu: ProspekListItemDto[];
  total: number;
  adaLagi: boolean;
  halamanGagal: number | null;
  isLoading: boolean;
  isMemuatLebih: boolean;
  muatLebih: () => void;
};

const palsu = vi.hoisted(() => ({
  useProspekKolom: vi.fn(),
  pindahkan: vi.fn(),
  isSedangDipindah: vi.fn(),
  hasAnyPermission: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/app/admin/presurvei/prospek/useProspekKolom", () => ({
  useProspekKolom: palsu.useProspekKolom,
}));

vi.mock("@/app/admin/presurvei/prospek/usePindahProspek", () => ({
  usePindahProspek: () => ({
    pindahkan: palsu.pindahkan,
    isSedangDipindah: palsu.isSedangDipindah,
  }),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({ hasAnyPermission: palsu.hasAnyPermission }),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(palsu.toast, { success: vi.fn(), error: vi.fn() }),
}));

import {
  LABEL_SAKELAR_KOLOM_MATI,
  ProspekKanbanClient,
  TEKS_KOLOM_GAGAL,
  TEKS_KOLOM_KOSONG,
} from "@/app/admin/presurvei/prospek/ProspekKanbanClient";
import {
  ProspekCard,
  TEKS_TAK_BERTUAN,
} from "@/app/admin/presurvei/prospek/ProspekCard";
import { PESAN_KONVERSI_BELUM_TERSEDIA } from "@/app/admin/presurvei/prospek/pindahProspek";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function prospek(ubahan: Partial<ProspekListItemDto>): ProspekListItemDto {
  return {
    id: "p-1",
    nama: "Pak Budi",
    noTelp: "081234567890",
    alamat: "Jl. Kenanga 7",
    sumber: "WEBSITE",
    status: "BARU",
    pemilikId: "sales-77",
    paketDiminati: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    ...ubahan,
  };
}

function kolomTiba(ubahan: Partial<KolomPalsu> = {}): KolomPalsu {
  return {
    kartu: [],
    total: 0,
    adaLagi: false,
    halamanGagal: null,
    isLoading: false,
    isMemuatLebih: false,
    muatLebih: vi.fn(),
    ...ubahan,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  palsu.useProspekKolom.mockReset();
  palsu.useProspekKolom.mockImplementation(() => kolomTiba());
  palsu.pindahkan.mockReset();
  palsu.isSedangDipindah.mockReset();
  palsu.isSedangDipindah.mockReturnValue(false);
  palsu.hasAnyPermission.mockReset();
  palsu.hasAnyPermission.mockReturnValue(true);
  palsu.toast.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.innerHTML = "";
});

async function render(elemen: React.ReactElement) {
  await act(async () => {
    root.render(elemen);
  });
}

function statusKolomTampil(): string[] {
  return [...container.querySelectorAll("section[data-status]")].map((kolom) =>
    kolom.getAttribute("data-status"),
  );
}

function kolom(status: ProspekStatus): HTMLElement {
  const elemen = container.querySelector(
    `section[data-status="${status}"]`,
  ) as HTMLElement;
  expect(elemen).not.toBeNull();
  return elemen;
}

function sakelarKolomMati(): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find((elemen) =>
    elemen.textContent.includes(LABEL_SAKELAR_KOLOM_MATI),
  );
  expect(label).toBeDefined();
  return label.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe("ProspekCard", () => {
  it("menampilkan nama, telepon, sumber, dan pemilik", async () => {
    await render(<ProspekCard prospek={prospek({})} />);

    const teks = container.textContent;
    expect(teks).toContain("Pak Budi");
    expect(teks).toContain("081234567890");
    expect(teks).toContain("Website");
    expect(teks).toContain("sales-77");
    expect(teks).not.toContain(TEKS_TAK_BERTUAN);
  });

  it("menandai kartu yang belum punya pemilik", async () => {
    await render(<ProspekCard prospek={prospek({ pemilikId: null })} />);

    expect(container.textContent).toContain(TEKS_TAK_BERTUAN);
  });
});

describe("ProspekKanbanClient", () => {
  it("hanya memasang kolom corong hidup secara bawaan", async () => {
    await render(<ProspekKanbanClient />);

    expect(statusKolomTampil()).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
    ]);
    // Kolom yang tidak dirender tidak memanggil hook-nya: dua permintaan hemat.
    expect(
      palsu.useProspekKolom.mock.calls.map(([status]) => status),
    ).not.toContain("TIDAK_MINAT");
  });

  it("menambahkan kolom mati di ujung saat sakelar dinyalakan", async () => {
    await render(<ProspekKanbanClient />);

    await act(async () => {
      sakelarKolomMati().click();
    });

    expect(statusKolomTampil()).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
      "TIDAK_MINAT",
      "TIDAK_LAYAK",
    ]);
  });

  it("memberi tiap kolom datanya sendiri", async () => {
    palsu.useProspekKolom.mockImplementation((status: ProspekStatus) =>
      kolomTiba({
        kartu: [prospek({ id: `kartu-${status}`, nama: `Prospek ${status}` })],
        total: status === "TERTARIK" ? 47 : 1,
      }),
    );

    await render(<ProspekKanbanClient />);

    expect(kolom("TERTARIK").textContent).toContain("Prospek TERTARIK");
    expect(kolom("TERTARIK").textContent).not.toContain("Prospek BARU");
    expect(kolom("TERTARIK").textContent).toContain("menampilkan 1 dari 47");
  });

  it("merender kerangka di dalam kolom tanpa melepas sakelar", async () => {
    palsu.useProspekKolom.mockImplementation(() =>
      kolomTiba({ isLoading: true }),
    );

    await render(<ProspekKanbanClient />);

    expect(statusKolomTampil()).toHaveLength(5);
    expect(sakelarKolomMati()).not.toBeNull();
    expect(
      kolom("BARU").querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(0);
    expect(kolom("BARU").textContent).not.toContain("menampilkan");
  });

  it("menawarkan muat lebih hanya bila masih ada halaman", async () => {
    const muatLebihDeal = vi.fn();
    palsu.useProspekKolom.mockImplementation((status: ProspekStatus) =>
      status === "DEAL"
        ? kolomTiba({ adaLagi: true, muatLebih: muatLebihDeal })
        : kolomTiba(),
    );

    await render(<ProspekKanbanClient />);

    const tombol = [...kolom("DEAL").querySelectorAll("button")].find(
      (elemen) => elemen.textContent.includes("Muat lebih"),
    );
    expect(tombol).toBeDefined();
    expect(kolom("BARU").querySelector("button")).toBeNull();

    await act(async () => {
      tombol.click();
    });

    expect(muatLebihDeal).toHaveBeenCalledTimes(1);
  });

  it("menampilkan kolom gagal sebagai gagal, bukan kosong", async () => {
    const cobaLagiBaru = vi.fn();
    palsu.useProspekKolom.mockImplementation((status: ProspekStatus) =>
      status === "BARU"
        ? kolomTiba({ halamanGagal: 1, muatLebih: cobaLagiBaru })
        : kolomTiba(),
    );

    await render(<ProspekKanbanClient />);

    const teksBaru = kolom("BARU").textContent;
    expect(teksBaru).toContain(TEKS_KOLOM_GAGAL);
    expect(teksBaru).not.toContain(TEKS_KOLOM_KOSONG);
    // Tanpa meta, "0 dari 0" di kolom yang gagal berbohong.
    expect(teksBaru).not.toContain("menampilkan");
    expect(kolom("DEAL").textContent).toContain(TEKS_KOLOM_KOSONG);

    const tombol = [...kolom("BARU").querySelectorAll("button")].find(
      (elemen) => elemen.textContent.includes("Coba lagi"),
    );
    expect(tombol).toBeDefined();
    await act(async () => {
      tombol.click();
    });
    expect(cobaLagiBaru).toHaveBeenCalledTimes(1);
  });

  it("tetap menampilkan kartu dan menawarkan coba lagi saat halaman berikutnya gagal", async () => {
    palsu.useProspekKolom.mockImplementation((status: ProspekStatus) =>
      status === "TERTARIK"
        ? kolomTiba({
            kartu: [prospek({ nama: "Bu Sari" })],
            total: 47,
            adaLagi: true,
            halamanGagal: 2,
          })
        : kolomTiba(),
    );

    await render(<ProspekKanbanClient />);

    const teks = kolom("TERTARIK").textContent;
    expect(teks).toContain("Bu Sari");
    expect(teks).toContain("Coba lagi");
    expect(teks).not.toContain("Muat lebih");
  });
});

/**
 * Event seret buatan tangan: jsdom tidak membawa `DragEvent`/`DataTransfer`,
 * sedangkan handler kartu menulis ke `dataTransfer`.
 */
function kirimSeret(elemen: Element, jenis: string): Event {
  const event = new Event(jenis, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", {
    value: { setData: vi.fn(), effectAllowed: "", dropEffect: "" },
  });
  elemen.dispatchEvent(event);
  return event;
}

function kartuDi(status: ProspekStatus): HTMLElement {
  const elemen = kolom(status).querySelector("article[data-prospek-id]");
  expect(elemen).not.toBeNull();
  return elemen as HTMLElement;
}

/** Satu kartu per kolom hidup, id-nya `kartu-<STATUS>`. */
function kolomBerkartu() {
  palsu.useProspekKolom.mockImplementation((status: ProspekStatus) =>
    kolomTiba({
      kartu: [prospek({ id: `kartu-${status}`, status })],
      total: 1,
    }),
  );
}

async function angkat(status: ProspekStatus) {
  await act(async () => {
    kirimSeret(kartuDi(status), "dragstart");
  });
}

describe("ProspekKanbanClient — seret", () => {
  beforeEach(() => {
    kolomBerkartu();
  });

  it("menyalakan kolom sah dan meredupkan sisanya saat kartu diangkat", async () => {
    await render(<ProspekKanbanClient />);
    await angkat("TERTARIK");

    expect(kolom("NEGOSIASI").getAttribute("data-seret")).toBe("tujuan");
    expect(kolom("BARU").getAttribute("data-seret")).toBe("redup");
    expect(kolom("DEAL").getAttribute("data-seret")).toBe("redup");
    expect(kolom("TERTARIK").getAttribute("data-seret")).toBe("netral");
    // `data-seret` hanya penanda; peredupan yang dilihat pemakai ada di kelasnya.
    expect(kolom("BARU").className).toContain("opacity-40");
    expect(kolom("NEGOSIASI").className).not.toContain("opacity-40");
  });

  it("hanya kolom sah yang menerima kartu", async () => {
    await render(<ProspekKanbanClient />);
    await angkat("TERTARIK");

    // `preventDefault` pada `dragover` adalah satu-satunya cara kolom
    // menyatakan diri bisa dijatuhi; tanpanya peramban menolak jatuhan.
    expect(kirimSeret(kolom("NEGOSIASI"), "dragover").defaultPrevented).toBe(
      true,
    );
    expect(kirimSeret(kolom("BARU"), "dragover").defaultPrevented).toBe(false);
  });

  it("memindahkan kartu yang diangkat ke kolom tempat ia dijatuhkan", async () => {
    await render(<ProspekKanbanClient />);
    await angkat("TERTARIK");
    await act(async () => {
      kirimSeret(kolom("NEGOSIASI"), "drop");
    });

    expect(palsu.pindahkan).toHaveBeenCalledWith({
      prospekId: "kartu-TERTARIK",
      dari: "TERTARIK",
      tujuan: "NEGOSIASI",
    });
    expect(kolom("NEGOSIASI").getAttribute("data-seret")).toBe("netral");
  });

  it("memberi tahu alih-alih menulis status saat dijatuhkan ke DEAL", async () => {
    await render(<ProspekKanbanClient />);
    await angkat("NEGOSIASI");
    await act(async () => {
      kirimSeret(kolom("DEAL"), "drop");
    });

    expect(palsu.toast).toHaveBeenCalledWith(
      PESAN_KONVERSI_BELUM_TERSEDIA,
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(palsu.pindahkan).not.toHaveBeenCalled();
  });

  it("mengembalikan semua kolom ke rupa biasa saat seretan dibatalkan", async () => {
    await render(<ProspekKanbanClient />);
    await angkat("TERTARIK");
    await act(async () => {
      kirimSeret(kartuDi("TERTARIK"), "dragend");
    });

    expect(kolom("BARU").getAttribute("data-seret")).toBe("netral");
    expect(kolom("NEGOSIASI").getAttribute("data-seret")).toBe("netral");
  });

  it("memeriksa permission yang sama dengan gerbang PATCH", async () => {
    await render(<ProspekKanbanClient />);

    expect(palsu.hasAnyPermission).toHaveBeenCalledWith([
      "presurvei:update",
      "m_presurvei:update",
    ]);
    expect(kartuDi("BARU").getAttribute("draggable")).toBe("true");
  });

  it("tidak membiarkan kartu diseret tanpa permission ubah", async () => {
    palsu.hasAnyPermission.mockReturnValue(false);

    await render(<ProspekKanbanClient />);

    expect(kartuDi("BARU").getAttribute("draggable")).toBe("false");
  });

  it("tidak membiarkan kartu berstatus final diseret", async () => {
    // DEAL tidak punya transisi sah (`prospek-rules.ts:33`).
    await render(<ProspekKanbanClient />);

    expect(kartuDi("DEAL").getAttribute("draggable")).toBe("false");
    expect(kartuDi("NEGOSIASI").getAttribute("draggable")).toBe("true");
  });

  it("menandai kartu yang sedang dipindah dan menahannya dari seretan lagi", async () => {
    palsu.isSedangDipindah.mockImplementation(
      (id: string) => id === "kartu-BARU",
    );

    await render(<ProspekKanbanClient />);

    expect(kartuDi("BARU").getAttribute("aria-busy")).toBe("true");
    expect(kartuDi("BARU").getAttribute("draggable")).toBe("false");
    expect(kartuDi("DIHUBUNGI").getAttribute("aria-busy")).toBe("false");
  });
});
