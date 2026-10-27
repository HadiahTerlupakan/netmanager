import { formatRupiah, type Tagihan } from "./renew-form.helpers";

export type RenewPelanggan = {
  id: string;
  idPelanggan: string;
  nama: string;
  tipe: "REGULER" | "NON_REGULER";
  status: string;
  hargaPaket?: { id: string; name: string; harga: number } | null;
  jatuhTempo: string;
};

type RenewSummaryCardProps = {
  pelanggan: RenewPelanggan;
  tagihanAktif: Tagihan | null;
  isSubmitting: boolean;
  onCancelInvoice: () => void;
};

/** Ringkasan pelanggan dan tagihan terbuka di atas form perpanjangan. */
export function RenewSummaryCard({
  pelanggan,
  tagihanAktif,
  isSubmitting,
  onCancelInvoice,
}: RenewSummaryCardProps) {
  const ppnTagihan = tagihanAktif?.ppn ?? 0;
  const subtotalTagihan = (tagihanAktif?.total ?? 0) - ppnTagihan;

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-6">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-400 mb-2">
              {tagihanAktif ? "BELUM BAYAR" : "TIDAK ADA TAGIHAN"}
            </h2>
            {tagihanAktif && (
              <p className="text-lg text-gray-700 dark:text-gray-300">
                {formatRupiah(subtotalTagihan)} (+ PPN{" "}
                {formatRupiah(ppnTagihan)})
              </p>
            )}
            {!tagihanAktif && (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Tagihan untuk jatuh tempo berjalan akan diterbitkan saat
                perpanjangan disimpan.
              </p>
            )}
          </div>
          {tagihanAktif && (
            <button
              type="button"
              onClick={onCancelInvoice}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50"
            >
              Batalkan Tagihan
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <SummaryItem label="ID Pelanggan" value={pelanggan.idPelanggan} />
          <SummaryItem label="Nama Lengkap" value={pelanggan.nama} />
          <SummaryItem
            label="Paket [PPP]"
            value={
              pelanggan.hargaPaket
                ? `${pelanggan.hargaPaket.name} - ${formatRupiah(pelanggan.hargaPaket.harga)}`
                : "-"
            }
          />
          <div className="flex gap-2 items-end">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              {pelanggan.tipe === "REGULER" ? "REGULER" : "NON_REGULAR"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400">{label}</p>
      <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
