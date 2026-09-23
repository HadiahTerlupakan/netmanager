import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect, vi, type Mock } from "vitest";

/**
 * Perkakas render bersama untuk test jsdom layar presurvei.
 *
 * Bukan berkas test (tanpa akhiran `.test.tsx`), jadi `vitest.config` tidak
 * menjalankannya sendiri. Pemakainya wajib memasang pragma
 * `// @vitest-environment jsdom` di baris pertamanya sendiri — pragma tidak
 * menular lewat impor.
 *
 * Repo ini tidak memakai `@testing-library`; render dan penantian ditulis
 * tangan dengan `createRoot` + `act`, mengikuti
 * `tests/lib/use-invalidate-planning.test.tsx`.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Tenggat `tungguSampai`, dalam milidetik jam dinding. Berbasis waktu, bukan
 * jumlah putaran: di bawah kontensi CPU, komponen yang memuat banyak
 * `await import` per effect (`KegiatanPeta`) butuh lebih dari 50 putaran
 * `setTimeout(0)` padahal kodenya benar. Preseden:
 * `tests/app/admin/canvasing-list.test.tsx:35-44`.
 */
const TENGGAT_TUNGGU_MS = 2_000;

/** Jeda antar-pemeriksaan `tungguSampai`. */
const JEDA_TUNGGU_MS = 10;

/**
 * `staleTime` produksi (`components/providers/session-provider.tsx:31`).
 *
 * Disamakan supaya test invalidasi jujur: dengan `staleTime` 0, query yang
 * dipasang ulang mengambil ulang sendiri, sehingga invalidasi yang hilang
 * bisa tertutupi oleh refetch saat mount.
 */
const STALE_TIME_PRODUKSI_MS = 30_000;

/** Satu akar React beserta `QueryClient`-nya, dibongkar di `afterEach`. */
export interface Panggung {
  wadah: HTMLDivElement;
  akar: Root;
  queryClient: QueryClient;
}

/**
 * Menyiapkan akar render baru di `document.body`.
 *
 * Opsi query meniru `components/providers/session-provider.tsx:26-32`:
 * `retry: false` membuat respons gagal langsung menjadi `error` tanpa menunggu
 * percobaan ulang, dan `staleTime` 30 detik membuat data yang sudah tiba tidak
 * diambil ulang kecuali diinvalidasi — lihat `STALE_TIME_PRODUKSI_MS`.
 */
export function pasangPanggung(): Panggung {
  document.body.innerHTML = "";
  const wadah = document.createElement("div");
  document.body.appendChild(wadah);

  return {
    wadah,
    akar: createRoot(wadah),
    queryClient: new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: STALE_TIME_PRODUKSI_MS },
      },
    }),
  };
}

/** Melepas akar dan membersihkan DOM supaya test berikutnya mulai dari nol. */
export async function bongkarPanggung(panggung: Panggung): Promise<void> {
  await act(async () => {
    panggung.akar.unmount();
  });
  panggung.queryClient.clear();
  document.body.innerHTML = "";
}

/** Merender elemen di dalam `QueryClientProvider` milik panggung. */
export async function render(
  panggung: Panggung,
  elemen: ReactNode,
): Promise<void> {
  await act(async () => {
    panggung.akar.render(
      <QueryClientProvider client={panggung.queryClient}>
        {elemen}
      </QueryClientProvider>,
    );
  });
}

/** Elemen di seluruh `document.body`; modal dirender lewat portal ke sana. */
export function cari<T extends Element = HTMLElement>(
  selektor: string,
): T | null {
  return document.body.querySelector<T>(selektor);
}

/** Mengisi medan seperti pemakai mengetik, supaya `onChange` React terpanggil. */
export async function isiMedan(selektor: string, nilai: string): Promise<void> {
  const elemen = cari<HTMLInputElement | HTMLSelectElement>(selektor);
  expect(elemen, `medan ${selektor} tidak ditemukan`).not.toBeNull();

  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(elemen),
    "value",
  ).set;
  await act(async () => {
    setter.call(elemen, nilai);
    const jenisEvent = elemen.tagName === "SELECT" ? "change" : "input";
    elemen.dispatchEvent(new Event(jenisEvent, { bubbles: true }));
  });
}

/** Tombol pertama yang teksnya persis `teks`. */
export function tombolBerteks(teks: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find(
    (tombol) => tombol.textContent.trim() === teks,
  );
}

/** Mengklik tombol berdasarkan teksnya; gagal jelas bila tombolnya tak ada. */
export async function klikTombol(teks: string): Promise<void> {
  const tombol = tombolBerteks(teks);
  expect(tombol, `tombol "${teks}" tidak ditemukan`).toBeDefined();
  await act(async () => {
    tombol.click();
  });
}

/**
 * Menunggu sampai `kondisi` benar, memberi React Query dan `fetch` palsu
 * kesempatan menyelesaikan rantai promise-nya di antara pemeriksaan.
 *
 * Tenggatnya diukur dengan `performance.now()`, bukan `Date.now()`: beberapa
 * test memalsukan `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`) untuk
 * memaku periode bawaan, dan jam yang dibekukan membuat tenggat berbasis
 * `Date.now()` tidak pernah lewat. Kondisi diperiksa sekali lagi setelah
 * tenggat, supaya perubahan pada jeda terakhir tidak dibaca sebagai gagal.
 */
export async function tungguSampai(
  kondisi: () => boolean,
  keterangan: string,
): Promise<void> {
  const tenggat = performance.now() + TENGGAT_TUNGGU_MS;
  while (performance.now() < tenggat) {
    if (kondisi()) return;
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, JEDA_TUNGGU_MS));
    });
  }
  if (kondisi()) return;
  throw new Error(`Tidak pernah terpenuhi: ${keterangan}`);
}

/** Respons JSON sungguhan (`Response` bawaan Node), bukan objek tiruan. */
export function responsJson(status: number, badan: unknown): Response {
  return new Response(JSON.stringify(badan), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Teks `<dd>` yang berpasangan dengan `<dt>` berlabel `label`. */
export function nilaiBerlabel(label: string): string | null {
  const judul = [...document.body.querySelectorAll("dt")].find(
    (dt) => dt.textContent.trim() === label,
  );
  return judul?.nextElementSibling?.textContent ?? null;
}

/**
 * Isi modul `react-hot-toast` palsu, untuk factory `vi.mock`:
 *
 * ```ts
 * vi.mock("react-hot-toast", async () =>
 *   (await import("./presurvei-jsdom-harness")).modulToastPalsu(
 *     palsu.toastSuccess,
 *     palsu.toastError,
 *   ),
 * );
 * ```
 *
 * `success`/`error` dioper dari `vi.hoisted` pemakai supaya test bisa
 * memeriksa argumennya.
 */
export function modulToastPalsu(success: Mock, error: Mock) {
  return { toast: Object.assign(vi.fn(), { success, error }) };
}
