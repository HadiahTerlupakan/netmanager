import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { VPN_NOT_CONFIGURED_MESSAGE } from "./vpnShared";

/** Kartu pengganti konten saat layanan VPN pusat belum dikonfigurasi. */
export default function VpnNotConfiguredCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-amber-800 dark:text-amber-300">
      <HiOutlineExclamationTriangle className="w-6 h-6 shrink-0" />
      <p className="font-medium">{VPN_NOT_CONFIGURED_MESSAGE}</p>
    </div>
  );
}
