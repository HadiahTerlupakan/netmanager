/**
 * Izin aksi keuangan komisi reseller: membuat/menyetujui/membayar settlement
 * dan mengubah aturan komisi. Pengelola data reseller (`reseller:update`)
 * saja tidak cukup; ia juga harus boleh mencatat transaksi keuangan
 * (`transactions:create`, dimiliki template Staff Keuangan). Keduanya wajib,
 * jadi dipakai sebagai `permissionsAll` — `permissions` bersifat "salah satu".
 */
export const RESELLER_FINANCE_PERMISSIONS = [
  "reseller:update",
  "transactions:create",
] as const;
