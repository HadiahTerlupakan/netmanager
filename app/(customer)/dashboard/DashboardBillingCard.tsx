import Link from "next/link";
import { MdArrowForward, MdReceiptLong } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { SaldoKreditNote } from "@/components/customer/SaldoKreditNote";

const BILLING_ERROR_LABEL = "Tagihan belum bisa diverifikasi";
const COVERED_BY_SALDO_LABEL = "Ditutup saldo, sedang diproses";
const PAID_UP_LABEL = "Tagihan lunas";

type DashboardBillingData = {
  outstandingCount: number;
  outstandingAmount: number;
  nearestDueDate?: string | null;
  hasOverdue: boolean;
  saldoKredit?: number;
};

type BillingSection = {
  state: "ready" | "error";
  data?: DashboardBillingData | null;
};

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDueDate(dateValue: string | null) {
  if (!dateValue) {
    return "Jadwal jatuh tempo belum tersedia";
  }

  return `Jatuh tempo: ${new Date(dateValue).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/**
 * Status, tujuan tombol, dan warna titik kartu tagihan. Tagihan yang sisanya
 * nol sudah ditutup saldo: tidak ada yang perlu dibayar, tetapi belum lunas.
 */
function describeBilling(data: DashboardBillingData | null) {
  if (!data) {
    return {
      status: BILLING_ERROR_LABEL,
      action: { href: "/tagihan", label: "Lihat Tagihan" },
      hasPayable: false,
    };
  }
  if (data.outstandingCount === 0) {
    return {
      status: PAID_UP_LABEL,
      action: { href: "/riwayat", label: "Lihat Riwayat" },
      hasPayable: false,
    };
  }
  if (data.outstandingAmount <= 0) {
    return {
      status: COVERED_BY_SALDO_LABEL,
      action: { href: "/tagihan", label: "Lihat Tagihan" },
      hasPayable: false,
    };
  }
  return {
    status: formatDueDate(data.nearestDueDate ?? null),
    action: { href: "/tagihan", label: "Bayar Sekarang" },
    hasPayable: true,
  };
}

/** Kartu ringkasan tagihan di dashboard: total semua tagihan terbuka dan saldo. */
export function DashboardBillingCard({
  billing,
}: {
  billing: BillingSection | null;
}) {
  const data = billing?.state === "ready" ? (billing.data ?? null) : null;
  const { status, action, hasPayable } = describeBilling(data);

  return (
    <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[#0d9488] to-[#115e59] p-5 text-white shadow-lg">
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-teal-100">
              Total Tagihan
            </p>
            <h3 className="text-3xl font-bold tracking-tight">
              {data ? formatCurrency(data.outstandingAmount) : "Rp -"}
            </h3>
          </div>
          <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
            <MdReceiptLong className="text-xl text-white" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2 w-2 rounded-full ${hasPayable ? "bg-orange-400" : "bg-green-400"}`}
          />
          <p className="text-sm font-medium text-teal-50">{status}</p>
        </div>
        <SaldoKreditNote
          amount={data?.saldoKredit}
          className="-mt-2 text-xs font-medium text-teal-50"
        />
        <div className="pt-2">
          <Link href={action.href}>
            <Button variant="outline" className="w-full">
              <span>{action.label}</span>
              <MdArrowForward className="text-sm" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
