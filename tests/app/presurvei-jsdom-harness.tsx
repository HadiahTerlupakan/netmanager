import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { expect } from "vitest";

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

/** Batas putaran penantian sebelum `tungguSampai` menyerah. */
const BATAS_PUTARAN_TUNGGU = 50;

/** Satu akar React beserta `QueryClient`-nya, dibongkar di `afterEach`. */
export interface Panggung {
  wadah: HTMLDivElement;
  akar: Root;
  queryClient: QueryClient;
}

/**
 * Menyiapkan akar render baru di `document.body`.
 *
 * `retry: false` meniru `components/providers/session-provider.tsx`, sehingga
 * respons gagal langsung menjadi `error` tanpa menunggu percobaan ulang.
 */
export function pasangPanggung(): Panggung {
  document.body.innerHTML = "";
  const wadah = document.createElement("div");
  document.body.appendChild(wadah);

  return {
    wadah,
    akar: createRoot(wadah),
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false } },
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
 * kesempatan menyelesaikan rantai promise-nya di antara putaran.
 */
export async function tungguSampai(
  kondisi: () => boolean,
  keterangan: string,
): Promise<void> {
  for (let putaran = 0; putaran < BATAS_PUTARAN_TUNGGU; putaran += 1) {
    if (kondisi()) return;
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 0));
    });
  }
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
