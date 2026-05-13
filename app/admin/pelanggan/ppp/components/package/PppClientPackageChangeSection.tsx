import React from "react";

type ProrateOption = "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
type DowngradeAdjustment = "NONE" | "REFUND" | "CREDIT";
type UpgradeApplyTime = "IMMEDIATE" | "NEXT_CYCLE";

type PppClientPackageChangeSectionProps = {
  prorateOption: ProrateOption;
  downgradeAdjustment: DowngradeAdjustment;
  upgradeApplyTime: UpgradeApplyTime;
  /** true jika harga paket baru lebih rendah dari paket lama */
  isDowngrade: boolean;
  loading: boolean;
  onFieldChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  roundedClassName: string;
};

/**
 * Section tambahan yang muncul saat paket pelanggan diubah.
 * Menampilkan opsi prorate, waktu aktivasi, dan metode kredit downgrade.
 */
export function PppClientPackageChangeSection({
  prorateOption,
  downgradeAdjustment,
  upgradeApplyTime,
  isDowngrade,
  loading,
  onFieldChange,
  roundedClassName,
}: PppClientPackageChangeSectionProps) {
  return (
    <div className="space-y-4 border-t-2 border-amber-200 dark:border-amber-800 pt-4 mt-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
      <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <span>Perubahan Paket Terdeteksi</span>
        <span className="px-2 py-0.5 text-xs bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded">
          {isDowngrade ? "Downgrade" : "Upgrade"}
        </span>
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Tentukan bagaimana sistem menangani perubahan paket ini.
      </p>

      {/* Waktu Aktivasi Paket Baru */}
      <div className="space-y-2">
        <label
          htmlFor="upgradeApplyTime"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Waktu Aktivasi Paket Baru
        </label>
        <select
          id="upgradeApplyTime"
          name="upgradeApplyTime"
          value={upgradeApplyTime}
          onChange={onFieldChange}
          disabled={loading}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${roundedClassName} focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="IMMEDIATE">
            Langsung (session disconnect, re-auth dengan paket baru)
          </option>
          <option value="NEXT_CYCLE">
            Siklus Berikutnya (aktif saat jatuh tempo)
          </option>
        </select>
      </div>

      {/* Opsi Prorate */}
      <div className="space-y-2">
        <label
          htmlFor="prorateOption"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Opsi Prorate
        </label>
        <select
          id="prorateOption"
          name="prorateOption"
          value={prorateOption}
          onChange={onFieldChange}
          disabled={loading}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${roundedClassName} focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <option value="NONE">
            Tidak ada prorate (paket baru berlaku penuh)
          </option>
          {!isDowngrade && (
            <option value="PRORATE_CHARGE">
              Tagih selisih prorate (buat invoice baru)
            </option>
          )}
          {isDowngrade && (
            <option value="PRORATE_CREDIT">
              Berikan kredit prorate ke pelanggan
            </option>
          )}
        </select>
      </div>

      {/* Metode Kredit Downgrade — hanya muncul saat downgrade + PRORATE_CREDIT */}
      {isDowngrade && prorateOption === "PRORATE_CREDIT" && (
        <div className="space-y-2">
          <label
            htmlFor="downgradeAdjustment"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Metode Kredit Downgrade
          </label>
          <select
            id="downgradeAdjustment"
            name="downgradeAdjustment"
            value={downgradeAdjustment}
            onChange={onFieldChange}
            disabled={loading}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${roundedClassName} focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <option value="NONE">Tidak ada (hanya audit log)</option>
            <option value="CREDIT">
              Tambah saldo kredit (potong invoice berikut otomatis)
            </option>
            <option value="REFUND">
              Buat refund payment (admin proses manual)
            </option>
          </select>
        </div>
      )}
    </div>
  );
}
