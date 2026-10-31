import { logger } from "@/lib/logger";
import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { BillingEventDispatcher } from "@/modules/events";

/** Payment yang uangnya sudah diterima dan mungkin melebihi tagihannya. */
export type CreditablePayment = {
  id: string;
  pelangganId: string;
  tenantId: string | null;
};

type InvoicePayment = {
  id: string;
  amount: bigint;
  discountAmount: bigint | null;
  gatewayStatus: string | null;
  kelebihanBayar: bigint | null;
  notes: string | null;
};

type Penanda = { invoiceId: string; kredit: bigint; notesAsli: string | null };

// Dihitung seperti InvoicePaymentStateService: payment PAID atau manual
// (tanpa status gateway), termasuk potongan kupon.
const isReceived = (payment: { gatewayStatus: string | null }) =>
  payment.gatewayStatus === null || payment.gatewayStatus === "PAID";

function totalTerbayar(payments: InvoicePayment[]) {
  return payments.reduce(
    (sum, p) =>
      isReceived(p) ? sum + p.amount + (p.discountAmount ?? 0n) : sum,
    0n,
  );
}

const sudahDikreditkan = (payments: InvoicePayment[]) =>
  payments.reduce((sum, p) => sum + (p.kelebihanBayar ?? 0n), 0n);

const formatRupiah = (amount: bigint) =>
  `Rp ${Number(amount).toLocaleString("id-ID")}`;

/**
 * Kreditkan ke saldo kredit pelanggan bagian uang `payment` yang tidak lagi
 * dibutuhkan tagihannya: kelebihan di atas total tagihan hidup, atau seluruh
 * uangnya bila tagihannya sudah dibatalkan (tagihan batal tidak terutang).
 *
 * Duitku tidak bisa menutup VA lebih awal, admin bisa menyetujui bukti untuk
 * tagihan yang sudah lunas, dan tagihan bisa diganti saat VA-nya masih
 * berjalan; uang dari jalur-jalur itu tidak boleh diterima diam-diam.
 *
 * Saldo ada di database utama, payment di database billing: payment ditandai
 * (`kelebihanBayar`) lebih dulu sehingga pemanggilan ulang tidak mengkreditkan
 * dua kali, dan tandanya dilepas bila saldo gagal ditambah. Tagihan yang
 * dipakai adalah tagihan payment saat ini, jadi payment yang baru dialihkan ke
 * tagihan pengganti dihitung terhadap tagihan pengganti.
 *
 * @returns nominal yang dikreditkan oleh pemanggilan ini (0n bila tidak ada).
 */
export async function creditPaymentOverpayment(
  payment: CreditablePayment,
  options: { notify: boolean; note?: (kredit: bigint) => string },
): Promise<bigint> {
  const penanda = await tandaiKelebihan(payment, options.note);
  if (!penanda) return 0n;
  const { invoiceId, kredit, notesAsli } = penanda;

  try {
    await prismaAuth.pelanggan.update({
      where: { id: payment.pelangganId },
      data: { saldoKreditRupiah: { increment: kredit } },
    });
  } catch (error) {
    await prismaBillingAuth.payment.update({
      where: { id: payment.id },
      data: { kelebihanBayar: null, notes: notesAsli },
    });
    throw error;
  }

  logger.warn(
    `[Pelunasan] Rp ${kredit} dari payment ${payment.id} (invoice ${invoiceId}) dikreditkan ke saldo pelanggan ${payment.pelangganId}`,
  );
  if (options.notify) {
    await BillingEventDispatcher.onPaymentOverpaid({
      invoiceId,
      pelangganId: payment.pelangganId,
      amount: Number(kredit),
      tenantId: payment.tenantId ?? undefined,
    });
  }
  return kredit;
}

/** Kreditkan kelebihan setiap payment checkout, dengan pemberitahuan. */
export async function creditOverpaidPayments(payments: CreditablePayment[]) {
  for (const payment of payments) {
    await creditPaymentOverpayment(payment, { notify: true });
  }
}

const defaultNote = (kredit: bigint) =>
  `Kelebihan bayar ${formatRupiah(kredit)} dikreditkan ke saldo kredit pelanggan.`;

/**
 * Hitung kelebihan dan tandai payment-nya di bawah kunci baris payment lalu
 * invoice: dua pelunasan bersamaan untuk invoice yang sama, tanpa kunci,
 * sama-sama membaca jumlah terbayar yang sama dan mengkreditkan melebihi
 * kelebihannya.
 */
async function tandaiKelebihan(
  payment: CreditablePayment,
  note: ((kredit: bigint) => string) | undefined,
): Promise<Penanda | null> {
  return prismaBillingAuth.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<Array<{ invoiceId: string | null }>>`
      SELECT "invoiceId" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
    const invoiceId = current?.invoiceId;
    if (!invoiceId) return null;

    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        status: true,
        totalAmount: true,
        payment: {
          select: {
            id: true,
            amount: true,
            discountAmount: true,
            gatewayStatus: true,
            kelebihanBayar: true,
            notes: true,
          },
        },
      },
    });
    const own = invoice?.payment.find((p) => p.id === payment.id);
    if (!invoice || !own || !isReceived(own)) return null;

    const terutang = invoice.status === "CANCELLED" ? 0n : invoice.totalAmount;
    const kelebihan =
      totalTerbayar(invoice.payment) -
      terutang -
      sudahDikreditkan(invoice.payment);
    if (kelebihan <= 0n) return null;

    const kredit = kelebihan < own.amount ? kelebihan : own.amount;
    if (kredit <= 0n) return null;
    const ditandai = await tx.payment.updateMany({
      where: { id: payment.id, kelebihanBayar: null },
      data: {
        kelebihanBayar: kredit,
        notes: `${own.notes ? `${own.notes}\n` : ""}${(note ?? defaultNote)(kredit)}`,
      },
    });
    return ditandai.count === 0
      ? null
      : { invoiceId, kredit, notesAsli: own.notes };
  });
}
