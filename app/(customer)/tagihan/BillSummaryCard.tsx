import {
  MdCalendarToday,
  MdCheckCircle,
  MdRouter,
  MdVerifiedUser,
} from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { SaldoKreditNote } from "@/components/customer/SaldoKreditNote";
import { formatCurrency } from "@/lib/utils";

const HERO_BACKGROUND_URL =
  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-HU9cqe6mcWGdTC97GiGE9Cpcz8BtknnjXpnAibr__w5Mp18897Z_ETiwCLP8684O2A6OaPPZG2gbjE9V33mJP_kcjPCud4uMkUHdMLUcO0x3njsMz_j2y4XLD044QbwKs0F7O2ZI-06Kw3uPuoYqeR5Qkk6AUXB9CMWFWY9iFrqApW30mSi65fUu9lXbRZD8FNxiSd05IMYrDtabjomcqLhA659gZookpcmJCXKGjJ4FtmYOthORCnxg8wXQzQZKZB3jyc1iark")';

function formatDueDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  /** Jumlah semua tagihan terbuka, bukan hanya bulan ini. */
  totalPending: number;
  nextDueDate: string | null;
  saldoKredit?: number;
  onPay: () => void;
};

/** Ringkasan tagihan terbuka dengan tombol bayar, saat tidak ada checkout berjalan. */
export function BillSummaryCard({
  totalPending,
  nextDueDate,
  saldoKredit,
  onPay,
}: Props) {
  return (
    <div className="p-4">
      <div className="relative overflow-hidden rounded-xl bg-[#0d9488] shadow-lg dark:shadow-teal-900/20">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
          style={{ backgroundImage: HERO_BACKGROUND_URL }}
        />
        <div className="relative z-10 flex flex-col p-6 h-full justify-between min-h-[220px]">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <p className="text-white/90 text-sm font-medium">Total Tagihan</p>
              <h1 className="text-white text-3xl font-bold tracking-tight">
                {formatCurrency(totalPending)}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                {nextDueDate ? (
                  <>
                    <MdCalendarToday className="text-white/80 text-sm" />
                    <p className="text-white/80 text-xs font-medium">
                      Jatuh tempo {formatDueDate(nextDueDate)}
                    </p>
                  </>
                ) : (
                  <>
                    <MdCheckCircle className="text-white/80 text-sm" />
                    <p className="text-white/80 text-xs font-medium">
                      Tidak ada tagihan tertunggak
                    </p>
                  </>
                )}
              </div>
              <SaldoKreditNote
                amount={saldoKredit}
                className="mt-2 rounded-md bg-white/15 px-2 py-1 text-xs font-medium text-white"
              />
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
              <MdRouter className="text-white" />
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <MdVerifiedUser className="text-[16px]" />
              <span>Pembayaran aman & terenkripsi</span>
            </div>
            {totalPending > 0 && (
              <Button onClick={onPay} variant="outline" className="w-full h-12">
                <span>Bayar Sekarang</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
