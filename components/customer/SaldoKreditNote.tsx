import { formatCurrency } from "@/lib/utils";

/**
 * Kalimat saldo kredit pelanggan (kelebihan bayar, mis. VA lama yang tetap
 * dibayar setelah ganti metode). Tidak dirender bila saldonya nol.
 */
export function SaldoKreditNote({
  amount,
  className,
}: {
  amount?: number;
  className?: string;
}) {
  if (!amount || amount <= 0) return null;
  return (
    <p className={className}>
      Saldo Anda {formatCurrency(amount)}, otomatis memotong tagihan berikutnya.
    </p>
  );
}
