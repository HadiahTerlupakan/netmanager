import { CUSTOMER_DISMANTLED_MESSAGE } from "./customer-portal-access";

/** `?reason=` saat sesi pelanggan diakhiri karena dismantle. */
export const CUSTOMER_LOGIN_REASON_DISMANTLED = "dismantled";

const CUSTOMER_LOGIN_REASON_MESSAGES: Readonly<Record<string, string>> = {
  [CUSTOMER_LOGIN_REASON_DISMANTLED]: CUSTOMER_DISMANTLED_MESSAGE,
  inactive: "Akun Anda tidak aktif. Hubungi customer service.",
};

/**
 * Teks tetap untuk kode `?reason=` di halaman login pelanggan, atau null.
 * Isi query tidak pernah ditampilkan: siapa pun bisa membagikan tautan login
 * dengan teks buatannya sendiri.
 */
export function getCustomerLoginReasonMessage(
  reason: string | null,
): string | null {
  if (!reason || !Object.hasOwn(CUSTOMER_LOGIN_REASON_MESSAGES, reason)) {
    return null;
  }
  return CUSTOMER_LOGIN_REASON_MESSAGES[reason];
}
