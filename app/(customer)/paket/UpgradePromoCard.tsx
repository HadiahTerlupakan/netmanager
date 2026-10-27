import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface UpgradePromoCardProps {
  candidate: { nama: string; priceDifference: number };
}

/** Kartu rekomendasi upgrade dari kandidat paket nyata milik pelanggan. */
export function UpgradePromoCard({ candidate }: UpgradePromoCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-4 text-white shadow-lg">
      <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-xl"></div>
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-teal-100">
            Rekomendasi untukmu
          </p>
          <p className="text-lg font-bold">Upgrade ke {candidate.nama}?</p>
          <p className="text-xs text-teal-100 mt-1">
            Tambah Rp {candidate.priceDifference.toLocaleString("id-ID")}/bln
          </p>
        </div>
        <Link href="/upgrade-paket">
          <Button variant="ghost" size="sm" className="shrink-0">
            Lihat
          </Button>
        </Link>
      </div>
    </div>
  );
}
