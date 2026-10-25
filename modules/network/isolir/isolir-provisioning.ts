import type { IsolirMode } from "@prisma/client";
import { logger } from "@/lib/logger";
import type {
  IRouterAccessRepository,
  IsolirPageSyncUpdate,
} from "../domain/ports/IRouterAccessRepository";
import { resolveIsolirContent } from "./isolir-content";
import { renderIsolirPage } from "./isolir-render";

/** Yang dipasang provisioning di router untuk pelanggan isolir. */
export type IsolirProvisioning =
  | { mode: "ROUTER_PAGE"; html: string; hash: string }
  | { mode: "REDIRECT"; target: string };

/** Hasil provisioning yang menentukan status kirim halaman isolir. */
type IsolirPageOutcome = {
  success: boolean;
  error?: string;
  isolirPageError?: string;
};

const SCHEME_PATTERN = /^https?:\/\//i;
const TRAILING_SLASHES = /\/+$/;
const QUERY_OR_FRAGMENT = /[?#].*$/;

/**
 * Pisahkan URL isolir: address list hanya menerima host (tanpa port),
 * sedangkan action-data web proxy membawa host beserta path. Query dan
 * fragment dibuang karena bukan bagian alamat tujuan redirect.
 */
export function splitIsolirTarget(url: string): {
  host: string;
  target: string;
} {
  const target = url
    .trim()
    .replace(SCHEME_PATTERN, "")
    .replace(QUERY_OR_FRAGMENT, "")
    .replace(TRAILING_SLASHES, "");
  const host = target.split("/")[0].split(":")[0];
  return { host, target };
}

/**
 * Tentukan konfigurasi isolir router. Mode REDIRECT tanpa URL yang bisa
 * dipakai (data lama yang rusak) jatuh ke halaman di router, karena tanpa
 * itu pelanggan isolir hanya melihat koneksi gagal.
 */
export async function resolveIsolirProvisioning(router: {
  isolirMode: IsolirMode;
  isolirUrl: string | null;
  tenantId: string | null;
}): Promise<IsolirProvisioning> {
  if (router.isolirMode === "REDIRECT") {
    const { host, target } = splitIsolirTarget(router.isolirUrl ?? "");
    if (host) {
      return { mode: "REDIRECT", target };
    }
    logger.warn(
      "[Isolir] Router mode REDIRECT tanpa URL isolir, memakai halaman di router",
    );
  }

  const { html, hash } = renderIsolirPage(
    await resolveIsolirContent(router.tenantId),
  );
  return { mode: "ROUTER_PAGE", html, hash };
}

/** Konfigurasi isolir router, atau galat bila konfigurasinya gagal disusun. */
export type IsolirResolution = {
  isolir: IsolirProvisioning | null;
  error: string | null;
};

/**
 * Seperti `resolveIsolirProvisioning`, tetapi galat (database, pengaturan)
 * tidak menghentikan provisioning: RADIUS, firewall, dan NAT tetap dipasang
 * dengan `isolir = null`, yaitu web proxy dan halaman tidak disentuh.
 */
export async function tryResolveIsolirProvisioning(
  router: Parameters<typeof resolveIsolirProvisioning>[0],
): Promise<IsolirResolution> {
  try {
    return { isolir: await resolveIsolirProvisioning(router), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Isolir] Gagal menyusun konfigurasi isolir: ${message}`);
    return { isolir: null, error: message };
  }
}

/**
 * Status kirim yang disimpan setelah provisioning, atau null untuk mode yang
 * tidak menulis halaman. Galat mengosongkan hash supaya pengiriman berikutnya
 * tidak menganggap router sudah memakai halaman terbaru.
 */
export function buildIsolirPageSync(
  resolution: IsolirResolution,
  outcome: IsolirPageOutcome,
): IsolirPageSyncUpdate | null {
  if (resolution.error) {
    return { hash: null, error: resolution.error };
  }
  const { isolir } = resolution;
  if (isolir?.mode !== "ROUTER_PAGE") {
    return null;
  }
  const error = outcome.success
    ? outcome.isolirPageError
    : (outcome.error ?? "Provisioning gagal");
  if (error) {
    return { hash: null, error };
  }
  return { hash: isolir.hash, syncedAt: new Date(), error: null };
}

/**
 * Simpan status kirim halaman isolir. Galat database hanya dicatat: hasil
 * provisioning router tetap dilaporkan ke pengguna.
 */
export async function recordIsolirPageSync(
  repository: Pick<IRouterAccessRepository, "updateIsolirPageSync">,
  routerId: string,
  sync: IsolirPageSyncUpdate | null,
): Promise<void> {
  if (!sync) {
    return;
  }
  try {
    await repository.updateIsolirPageSync(routerId, sync);
  } catch (error: unknown) {
    logger.error(
      `[Isolir] Gagal menyimpan status halaman router ${routerId}:`,
      error,
    );
  }
}
