/*
 * Fokus keyboard sesudah modal pengajuan ditutup. Daftar pengajuan dimuat
 * ulang setiap kali aksi tersimpan, dan tabelnya dirender ulang dengan elemen
 * baru, jadi tombol yang membuka modal bisa sudah diganti atau hilang
 * (misalnya tombol Batalkan pada pengajuan yang baru dibatalkan). Tombol aksi
 * di tabel diberi kunci fokus supaya padanannya bisa ditemukan lagi.
 */

/** Atribut kunci fokus pada tombol aksi pengajuan di tabel. */
export const RESTOCK_FOCUS_ATTRIBUTE = "data-restock-focus";

/** Tombol aksi tabel yang bisa menjadi tujuan fokus. */
export type RestockFocusAction = "detail" | "cancel";

/** Kunci fokus satu tombol aksi tabel untuk satu pengajuan. */
export function getRestockFocusKey(
  action: RestockFocusAction,
  requestId: string,
): string {
  return `${action}:${requestId}`;
}

/** Elemen yang sedang difokus; null bila fokus ada di body. */
export function getFocusedElement(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  return active;
}

function findByFocusKey(key: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${RESTOCK_FOCUS_ATTRIBUTE}]`),
  ).filter((element) => element.getAttribute(RESTOCK_FOCUS_ATTRIBUTE) === key);
}

interface RestoreRestockFocusInput {
  /** Elemen yang memegang fokus saat modal dibuka. */
  trigger: HTMLElement | null;
  /** Kunci fokus pengganti, urut dari yang paling diutamakan. */
  fallbackKeys: readonly string[];
}

/**
 * Kembalikan fokus ke elemen pembuka modal bila masih ada di halaman; bila
 * tidak, ke tombol tabel pertama yang cocok dengan kunci penggantinya.
 * Tabel dan kartu ponsel sama-sama dirender dan salah satunya disembunyikan,
 * jadi elemen yang tidak bisa menerima fokus dilewati.
 */
export function restoreRestockFocus({
  trigger,
  fallbackKeys,
}: RestoreRestockFocusInput): void {
  const candidates = [
    ...(trigger?.isConnected ? [trigger] : []),
    ...fallbackKeys.flatMap(findByFocusKey),
  ];
  for (const candidate of candidates) {
    candidate.focus();
    if (document.activeElement === candidate) return;
  }
}
