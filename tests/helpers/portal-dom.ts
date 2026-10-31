import { act } from "react";

/**
 * Pembantu DOM untuk tes halaman portal pelanggan yang dirender lewat
 * `createRoot` di jsdom (proyek ini tidak memakai Testing Library).
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Tombol pertama di `scope` yang teksnya atau aria-label-nya memuat `label`. */
export function findButton(label: string, scope: ParentNode = document.body) {
  return Array.from(scope.querySelectorAll("button")).find(
    (button) =>
      button.textContent?.includes(label) ||
      button.getAttribute("aria-label")?.includes(label),
  );
}

/** Seperti `findButton`, tetapi gagal bila tombolnya tidak ada. */
export function getButton(label: string, scope: ParentNode = document.body) {
  const button = findButton(label, scope);
  if (!button) throw new Error(`Tombol "${label}" tidak ditemukan`);
  return button;
}

export async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Mengetik ke input terkontrol React (setter bawaan memicu onChange). */
export async function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function pressKey(
  key: string,
  options: { shiftKey?: boolean; target?: EventTarget } = {},
) {
  const target = options.target ?? document.activeElement ?? document.body;
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        shiftKey: options.shiftKey ?? false,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Memilih berkas pada input file seperti yang dilakukan pemilih berkas browser. */
export async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Membiarkan promise yang sudah selesai (fetch tiruan) diproses React. */
export async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

const WAIT_STEP_MS = 10;

/**
 * Menunggu sampai `isReady` benar atau batas waktu habis. TanStack Query
 * mengirim hasil fetch lewat setTimeout, jadi beberapa microtask saja tidak
 * cukup saat tes berjalan paralel.
 */
export async function waitUntil(isReady: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!isReady() && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
    });
  }
}

/** Respons fetch tiruan dengan badan JSON. */
export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => body,
  };
}
