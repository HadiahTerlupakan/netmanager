import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReturnToAppNotice } from "./ReturnToAppNotice";

const APP_RETURN_TARGET = "app";
const PORTAL_BILLING_PATH = "/tagihan";

export const metadata: Metadata = {
  title: "Kembali ke Aplikasi",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

// resultCode dari gateway memunculkan pesan hasil bayar di /tagihan.
function buildPortalBillingPath(resultCode: SearchParams[string]) {
  return typeof resultCode === "string"
    ? `${PORTAL_BILLING_PATH}?resultCode=${encodeURIComponent(resultCode)}`
    : PORTAL_BILLING_PATH;
}

/**
 * returnUrl gateway untuk pembayaran yang dimulai dari aplikasi
 * (`?ke=app`). Berada di luar grup (customer) dan dikecualikan di proxy,
 * karena browser yang membukanya tidak membawa sesi portal. Tanpa `ke=app`
 * pelanggan diteruskan ke /tagihan portal.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  if (params.ke !== APP_RETURN_TARGET) {
    redirect(buildPortalBillingPath(params.resultCode));
  }
  return <ReturnToAppNotice />;
}
