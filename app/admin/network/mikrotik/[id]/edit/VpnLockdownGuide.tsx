/** Perintah penutup akses publik; hanya ditampilkan, tidak pernah dikirim ke router. */
const LOCKDOWN_COMMAND =
  "/ip service set api,winbox,ssh address=<rentang IP admin Anda>,10.99.0.0/24,10.99.128.0/24";

/** Panduan teks menutup akses publik router; dilipat secara bawaan. */
export function VpnLockdownGuide() {
  return (
    <details className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
        Panduan menutup akses publik router
      </summary>
      <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <p>
          Setelah tunnel stabil, batasi layanan API, Winbox, dan SSH hanya untuk
          IP admin dan jaringan VPN. Jalankan sendiri di terminal router:
        </p>
        <pre className="overflow-x-auto rounded bg-gray-100 dark:bg-gray-900 p-2 text-xs">
          {LOCKDOWN_COMMAND}
        </pre>
        <p className="text-amber-700 dark:text-amber-400">
          Satu baris yang salah dapat mengunci admin dari router. Pastikan
          rentang IP admin sudah benar dan siapkan akses fisik atau Safe Mode
          sebelum menjalankannya. Perintah ini tidak dikirim ke router oleh
          aplikasi.
        </p>
      </div>
    </details>
  );
}
