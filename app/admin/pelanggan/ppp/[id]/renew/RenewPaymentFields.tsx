import Link from "next/link";
import {
  METODE_PEMBAYARAN_OPTIONS,
  type MetodePembayaran,
  type RenewFormState,
  type StatusBayar,
} from "./renew-form.helpers";

type RenewPaymentFieldsProps = {
  pelangganId: string;
  form: RenewFormState;
  onChange: (patch: Partial<RenewFormState>) => void;
};

const FIELD_CLASS =
  "w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm";
const CARD_CLASS =
  "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6";
const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

/** Isian pembayaran perpanjangan: status bayar, metode, referensi, catatan. */
export function RenewPaymentFields({
  pelangganId,
  form,
  onChange,
}: RenewPaymentFieldsProps) {
  return (
    <>
      <div className={CARD_CLASS}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Paket
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Perpanjangan memakai paket yang sedang aktif. Untuk mengganti paket,
          gunakan{" "}
          <Link
            href={`/admin/pelanggan/ppp/${pelangganId}/edit`}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            halaman edit pelanggan
          </Link>{" "}
          lebih dulu.
        </p>
      </div>

      <div className={CARD_CLASS}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="renew-status-bayar" className={LABEL_CLASS}>
              Status Bayar
            </label>
            <select
              id="renew-status-bayar"
              value={form.statusBayar}
              onChange={(e) =>
                onChange({ statusBayar: e.target.value as StatusBayar })
              }
              className={FIELD_CLASS}
            >
              <option value="BELUM_LUNAS">BELUM LUNAS</option>
              <option value="LUNAS">LUNAS (TERBAYAR)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Akun yang terisolir aktif kembali otomatis setelah tagihan lunas.
            </p>
          </div>
          <div>
            <label htmlFor="renew-metode" className={LABEL_CLASS}>
              Dibayar melalui
            </label>
            <select
              id="renew-metode"
              value={form.metodePembayaran}
              onChange={(e) =>
                onChange({
                  metodePembayaran: e.target.value as MetodePembayaran,
                })
              }
              className={FIELD_CLASS}
            >
              {METODE_PEMBAYARAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <label htmlFor="renew-referensi" className={LABEL_CLASS}>
          No. Referensi (opsional)
        </label>
        <input
          id="renew-referensi"
          type="text"
          value={form.referensi}
          onChange={(e) => onChange({ referensi: e.target.value })}
          className={FIELD_CLASS}
          placeholder="Nomor transfer / bukti bayar"
        />
        <label htmlFor="renew-catatan" className={`${LABEL_CLASS} mt-4`}>
          Catatan
        </label>
        <textarea
          id="renew-catatan"
          value={form.catatan}
          onChange={(e) => onChange({ catatan: e.target.value })}
          className={FIELD_CLASS}
          rows={3}
          placeholder="Catatan tambahan..."
        />
      </div>
    </>
  );
}
