import { MdErrorOutline } from "react-icons/md";

/**
 * Transfer manual terakhir yang ditolak admin. Tanpa ini pelanggan hanya
 * melihat tagihannya kembali "Belum Bayar" tanpa tahu kenapa.
 */
export function RejectedTransferNotice({ reason }: { reason?: string | null }) {
  return (
    <div className="px-4 pt-4">
      <div
        role="alert"
        className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
      >
        <MdErrorOutline
          className="mt-0.5 shrink-0 text-xl"
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-bold">Bukti transfer ditolak admin</p>
          {reason && <p className="mt-1">Alasan: {reason}</p>}
          <p className="mt-1 text-xs opacity-90">
            Silakan bayar lagi lewat tombol Bayar Sekarang. Bila Anda yakin
            sudah mentransfer, hubungi admin dengan menyertakan bukti
            transfernya.
          </p>
        </div>
      </div>
    </div>
  );
}
