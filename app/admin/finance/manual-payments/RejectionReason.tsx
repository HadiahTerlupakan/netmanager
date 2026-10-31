/**
 * Alasan penolakan bukti transfer: dikirim ke pelanggan bersama kabar
 * penolakannya, jadi admin didorong mengisinya walau tetap boleh kosong.
 */
export function RejectionReasonField({
  value,
  onChange,
  isConfirmingEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Admin sudah menekan Tolak sekali dengan alasan kosong. */
  isConfirmingEmpty: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="alasan-penolakan"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Alasan penolakan (dikirim ke pelanggan)
      </label>
      <textarea
        id="alasan-penolakan"
        name="rejectionReason"
        className="w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
        rows={2}
        maxLength={500}
        placeholder="Contoh: Nominal di bukti Rp 90.000, tagihan Rp 100.000"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Disarankan diisi supaya pelanggan tahu apa yang perlu diperbaiki.
      </p>
      {isConfirmingEmpty && !value.trim() && (
        <p
          role="alert"
          className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md p-2"
        >
          Alasan masih kosong: pelanggan hanya diberi tahu bahwa bukti
          transfernya ditolak. Tekan &quot;Tolak tanpa alasan&quot; untuk tetap
          menolak.
        </p>
      )}
    </div>
  );
}

/** Alasan yang tercatat pada bukti yang sudah ditolak. */
export function RejectionReasonNote({ reason }: { reason: string }) {
  return (
    <div className="p-3 rounded-md text-sm border bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
      <span className="font-semibold">Alasan penolakan:</span> {reason}
    </div>
  );
}
