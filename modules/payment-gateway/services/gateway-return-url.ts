import {
  getCustomerPortalBillingUrl,
  getCustomerPortalHost,
} from "@/lib/utils/portal-url";

/** Klien yang membuat checkout, tempat pelanggan kembali setelah membayar. */
export type CheckoutReturnTarget = "app" | "portal";

// Halaman publik portal (tanpa login) yang mengarahkan peramban ke deep link
// aplikasi `netmanager://tagihan`.
const APP_RETURN_PATH = "/pembayaran/kembali?ke=app";

/** URL tujuan gateway setelah pelanggan meninggalkan halaman bayar. */
export function resolveGatewayReturnUrl(
  returnTo: CheckoutReturnTarget = "portal",
): string {
  return returnTo === "app"
    ? `https://${getCustomerPortalHost()}${APP_RETURN_PATH}`
    : getCustomerPortalBillingUrl();
}
