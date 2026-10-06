import { prismaAuth } from "@/modules/database";

/** Host yang selalu menunjuk mesin lokal, bukan domain milik tenant mana pun. */
const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "::",
]);

const DEFAULT_BASE_DOMAIN = "radpro.id";

/** IPv6 dalam header Host selalu dikurung: `[::1]` atau `[::1]:3000`. */
const BRACKETED_IPV6 = /^\[([^\]]+)\](?::\d+)?$/;

/** Tenant yang memiliki sebuah host publik, beserta slug untuk branding landing page. */
export type PublicTenantHost = {
  tenantId: string;
  slug: string;
};

/**
 * Ambil bagian hostname saja: buang port dan samakan casing.
 *
 * Port hanya dipotong kalau memang ada. Memecah di `:` secara buta merusak
 * alamat IPv6 (`[::1]` jadi `[`), jadi bentuk berkurung ditangani terpisah.
 */
function normalizeHost(host: string | null | undefined): string | null {
  const trimmed = host?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const bracketedIpv6 = trimmed.match(BRACKETED_IPV6);
  if (bracketedIpv6) {
    return bracketedIpv6[1];
  }

  // IPv6 tanpa kurung tidak pernah membawa port, jadi biarkan utuh.
  if (trimmed.indexOf(":") !== trimmed.lastIndexOf(":")) {
    return trimmed;
  }

  return trimmed.split(":")[0] || null;
}

/**
 * Petakan host request publik ke tenant pemiliknya untuk halaman anonim.
 *
 * Lookup memakai `prismaAuth` (client tanpa ekstensi isolasi tenant) karena
 * peta domain ini justru data bootstrap lintas-tenant: ia dibaca sebelum
 * konteks tenant ada. Lewat client `prisma` biasa, ekstensi menolak query
 * dengan TenantContextError untuk host yang belum terpetakan — alasan yang
 * sama sudah dicatat di `lib/tenant-context.ts`.
 *
 * Mengembalikan null untuk host yang bukan milik tenant (loopback, apex
 * domain, atau domain yang tidak terdaftar) supaya pemanggil bisa menampilkan
 * landing page umum, bukan error.
 */
export async function resolveTenantByPublicHost(
  host: string | null | undefined,
): Promise<PublicTenantHost | null> {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost || LOOPBACK_HOSTS.has(normalizedHost)) {
    return null;
  }

  const baseDomain = process.env.DOMAIN || DEFAULT_BASE_DOMAIN;
  if (normalizedHost === baseDomain) {
    return null;
  }

  const subdomainSuffix = `.${baseDomain}`;
  if (normalizedHost.endsWith(subdomainSuffix)) {
    const slug = normalizedHost.slice(0, -subdomainSuffix.length);
    if (!slug || slug.includes(".")) {
      return null;
    }
    return prismaAuth.tenantDomain.findUnique({
      where: { slug },
      select: { tenantId: true, slug: true },
    });
  }

  return prismaAuth.tenantDomain.findFirst({
    where: { domain: normalizedHost, status: "active" },
    select: { tenantId: true, slug: true },
  });
}
