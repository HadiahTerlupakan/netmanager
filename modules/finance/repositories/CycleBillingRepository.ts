import { prismaBilling } from "@/lib/prisma-billing";
import { prisma } from "@/modules/database";

/** Field paket yang menentukan harga dan PPN tagihan langganan. */
export type BillingPackage = {
  id: string;
  name: string;
  harga: number;
  usePPN: boolean;
  ppnPercentage: number | null;
};

const BILLING_PACKAGE_SELECT = {
  id: true,
  name: true,
  harga: true,
  usePPN: true,
  ppnPercentage: true,
} as const;

/**
 * Paket terjadwal (NEXT_CYCLE) pelanggan yang sudah berlaku paling lambat
 * `appliesBy`; null bila tidak ada.
 */
export async function findPendingPackageAppliedBy(
  pelangganId: string,
  appliesBy: Date,
): Promise<BillingPackage | null> {
  const pelanggan = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      pendingPackageId: { not: null },
      pendingPackageApplyAt: { lte: appliesBy },
    },
    select: { pendingPackage: { select: BILLING_PACKAGE_SELECT } },
  });
  return pelanggan?.pendingPackage ?? null;
}

/** Harga dan PPN satu paket; null bila paketnya sudah tidak ada. */
export async function findBillingPackage(
  packageId: string,
): Promise<BillingPackage | null> {
  return prisma.hargaPaket.findUnique({
    where: { id: packageId },
    select: BILLING_PACKAGE_SELECT,
  });
}

/** Tagihan langganan siklus beserta jejak pembayarannya. */
export type CycleInvoice = {
  id: string;
  status: string;
  dueDate: Date;
  subtotal: bigint;
  discountAmount: bigint;
  totalAmount: bigint;
  paidAmount: bigint;
  tenantId: string | null;
  payment: Array<{ gatewayStatus: string | null; expiresAt: Date | null }>;
};

/**
 * Tagihan langganan yang belum dibatalkan dengan jatuh tempo di dalam
 * `[dayStart, dayEnd]`. Invoice prorate tidak ikut: ia menagih periode
 * berjalan, bukan siklus berikutnya.
 */
export async function findCycleInvoicesWithPayments(
  pelangganId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<CycleInvoice[]> {
  return prismaBilling.invoice.findMany({
    where: {
      pelangganId,
      kind: "SUBSCRIPTION",
      status: { not: "CANCELLED" },
      dueDate: { gte: dayStart, lte: dayEnd },
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      subtotal: true,
      discountAmount: true,
      totalAmount: true,
      paidAmount: true,
      tenantId: true,
      payment: { select: { gatewayStatus: true, expiresAt: true } },
    },
  });
}
