import { getPublicSiteUrl } from "@/lib/utils/portal-url";

/** Fungsi murni panel "Link belanja" di detail pengajuan. */

const WHATSAPP_SHARE_BASE = "https://wa.me/?text=";
const LINK_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface PurchaseLinkMessageInput {
  requestNumber: string;
  warehouseName: string;
  url: string;
}

/** Link "Kirim lewat WhatsApp"; teks di-encode, termasuk `#` token. */
export function buildWhatsAppShareUrl(text: string): string {
  return `${WHATSAPP_SHARE_BASE}${encodeURIComponent(text)}`;
}

/** Pesan WhatsApp untuk orang yang belanja. */
export function buildPurchaseLinkMessage({
  requestNumber,
  warehouseName,
  url,
}: PurchaseLinkMessageInput): string {
  return [
    `Halo, ini daftar belanja untuk pengajuan ${requestNumber} (${warehouseName}).`,
    "Buka link ini, centang barang yang sudah dibeli, isi nama Anda, lalu tanda tangan:",
    url,
    "",
    "Jangan teruskan link ini ke orang lain.",
  ].join("\n");
}

/** Lengkapi link relatif ("/belanja#…") dengan alamat situs. */
export function resolveAbsoluteLinkUrl(
  url: string,
  siteUrl: string = getPublicSiteUrl(),
): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = siteUrl === "/" ? "" : siteUrl.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

/** Tanggal pendek untuk info link, mis. "9 Nov 2026". */
export function formatPurchaseLinkDate(value: string): string {
  return LINK_DATE_FORMAT.format(new Date(value));
}

/** "Link dibuat … oleh …, berlaku sampai …. Terakhir dibuka: …." */
export function describePurchaseLinkInfo(link: {
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdByName: string | null;
}): string {
  const creator = link.createdByName ? ` oleh ${link.createdByName}` : "";
  const lastUsed = link.lastUsedAt
    ? formatPurchaseLinkDate(link.lastUsedAt)
    : "belum pernah";
  return `Link dibuat ${formatPurchaseLinkDate(link.createdAt)}${creator}, berlaku sampai ${formatPurchaseLinkDate(link.expiresAt)}. Terakhir dibuka: ${lastUsed}.`;
}
