import { toast } from "react-hot-toast";
import type { FetchError } from "@/lib/utils/fetch-wrapper";

/** Status server VPN seperti dikirim API admin. */
export type VpnServerStatus =
  | "pending_install"
  | "online"
  | "offline"
  | "expired";

/** Satu server VPN pada daftar admin. */
export interface VpnServerItem {
  id: string;
  name: string;
  publicHost: string;
  listenPort: number;
  status: VpnServerStatus;
  routerCount: number;
  tenantCount: number;
  lastSeenAt: string | null;
}

/** Router yang masih memakai server VPN (isi 409 saat hapus/cabut). */
export interface BlockingRouter {
  id: string;
  name: string;
  tenantName: string;
}

/** Perangkat WireGuard milik admin. */
export interface VpnAdminPeerItem {
  id: string;
  label: string;
  address: string;
  createdAt: string;
}

/** Jeda polling status server yang baru dibuat. */
export const VPN_POLL_INTERVAL_MS = 5000;

/** Masa berlaku perintah instal; polling berhenti setelahnya. */
export const VPN_COMMAND_VALIDITY_MS = 60 * 60 * 1000;

/** Port WireGuard bawaan server VPN. */
export const VPN_DEFAULT_LISTEN_PORT = "51821";

/** Pesan galat 503 dari API admin VPN. */
export const VPN_NOT_CONFIGURED_MESSAGE = "Layanan VPN belum dikonfigurasi";

const HTTP_SERVICE_UNAVAILABLE = 503;

/** True bila galat useApi berarti layanan VPN belum dikonfigurasi. */
export function isVpnNotConfigured(error: FetchError | null): boolean {
  return error?.status === HTTP_SERVICE_UNAVAILABLE;
}

/** Isi respons galat API (`{error, details}`); kosong bila bukan JSON. */
export async function readErrorBody(
  res: Response,
): Promise<{ error?: string; details?: { routers?: BlockingRouter[] } }> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Menyalin teks ke clipboard dan memberi tahu pengguna dengan `successMessage`. */
export async function copyToClipboard(
  text: string,
  successMessage: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Gagal menyalin, salin manual dari kotak teks");
  }
}
