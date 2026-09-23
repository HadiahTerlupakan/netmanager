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
}));

vi.mock("@/app/admin/presurvei/prospek/useProspekKolom", () => ({
  useProspekKolom: palsu.useProspekKolom,
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
