import { readLinkToken } from "./belanjaForm";

/**
 * Token link belanja di peramban. Token datang lewat fragmen URL (`#…`);
 * begitu terbaca, token dipindah ke sessionStorage dan fragmennya dihapus
 * dari alamat & riwayat peramban (`history.replaceState`), supaya tidak ikut
 * tersalin, tersimpan di riwayat, atau terlihat orang lain di layar. Muat
 * ulang halaman membaca token dari sessionStorage (hanya tab ini).
 */

const TOKEN_STORAGE_KEY = "belanja:token";

/** Cadangan bila sessionStorage diblokir: token hanya hidup selama halaman. */
let memoryToken: string | null = null;

function readStoredToken(): string | null {
  try {
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    return stored && readLinkToken(stored) ? stored : memoryToken;
  } catch {
    return memoryToken;
  }
}

function storeToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    memoryToken = null;
  } catch {
    memoryToken = token;
  }
}

function removeFragmentFromUrl(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * Token yang berlaku untuk halaman ini; "" bila tidak ada atau fragmennya
 * salah bentuk. Idempoten: aman dipanggil berulang (mis. sebagai snapshot
 * `useSyncExternalStore`). `replaceState` tidak memicu `hashchange`.
 */
export function captureLinkToken(): string {
  const { hash } = window.location;
  if (hash && hash !== "#") {
    const fromHash = readLinkToken(hash);
    // Fragmen baru yang salah bentuk berarti link rusak; jangan diam-diam
    // memakai token lama dari sesi sebelumnya.
    if (!fromHash) return "";
    storeToken(fromHash);
    removeFragmentFromUrl();
    return fromHash;
  }
  return readStoredToken() ?? "";
}

/** Berlangganan perubahan fragmen (link baru ditempel di tab yang sama). */
export function subscribeToLinkToken(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
