import { PORTAL_SUBDOMAINS } from "@/lib/utils/portal-url";

/**
 * Pembentukan slug subdomain tenant (`<slug>.<domain>`).
 *
 * Slug adalah label DNS, jadi aturannya lebih ketat daripada nama tenant:
 * huruf kecil, angka, dan tanda hubung di tengah saja.
 */

const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 63;
const SLUG_FALLBACK_PREFIX = "tenant";

/**
 * Label yang tidak boleh dipakai tenant.
 *
 * Subdomain portal sudah dipesan `proxy.ts` — tenant dengan slug `admin` tidak
 * akan pernah bisa diakses karena host itu ditulis ulang ke portal admin.
 * Sisanya nama infrastruktur yang lazim dipakai belakangan.
 */
const RESERVED_SLUGS = new Set([
  ...PORTAL_SUBDOMAINS,
  ...PORTAL_SUBDOMAINS.map((label) => `${label}-staging`),
  "www",
  "api",
  "app",
  "cdn",
  "mail",
  "staging",
  "status",
]);

export const TENANT_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Apakah slug ini dipesan untuk portal atau infrastruktur? */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Ubah nama tenant menjadi kandidat slug yang sah sebagai label DNS.
 *
 * Nama tenant bebas bentuk ("PT. Akses Cepat!"), jadi hasilnya dinormalisasi
 * dan dipotong. Nama yang seluruhnya karakter non-DNS tetap menghasilkan slug
 * yang bisa dipakai lewat awalan cadangan.
 */
export function buildSlugCandidate(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  if (normalized.length >= MIN_SLUG_LENGTH) return normalized;

  return normalized
    ? `${SLUG_FALLBACK_PREFIX}-${normalized}`
    : SLUG_FALLBACK_PREFIX;
}

/**
 * Tambahkan pembeda pada slug tanpa melewati batas panjang label DNS.
 *
 * Pemotongan dilakukan di pangkal, bukan di ekor pembeda, supaya slug ke-10
 * dan ke-11 tidak berubah jadi sama setelah dipotong.
 */
export function buildSlugVariant(candidate: string, attempt: number): string {
  const suffix = `-${attempt}`;
  const base = candidate.slice(0, MAX_SLUG_LENGTH - suffix.length);

  return `${base.replace(/-+$/g, "")}${suffix}`;
}
