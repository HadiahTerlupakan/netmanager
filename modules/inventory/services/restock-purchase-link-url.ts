import { getPublicSiteUrl } from "@/lib/utils/portal-url";

/** Path halaman daftar belanja tanpa login. */
export const PURCHASE_LINK_PAGE_PATH = "/belanja";

/**
 * URL link belanja. Token ditaruh di fragmen (`#`) supaya tidak pernah
 * terkirim ke server: tidak masuk log ingress, header Referer, maupun
 * pratinjau link aplikasi chat. Bisa relatif bila URL situs belum diatur.
 */
export function buildPurchaseLinkUrl(token: string): string {
  const base = getPublicSiteUrl();
  const origin = base === "/" ? "" : base;
  return `${origin}${PURCHASE_LINK_PAGE_PATH}#${token}`;
}
