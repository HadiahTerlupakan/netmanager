import { logger } from "@/lib/logger";
import { prismaAuth } from "@/lib/prisma";
import { prismaBillingAuth } from "@/lib/prisma-billing";
import { BillingEventDispatcher } from "@/modules/events";
import type { CheckoutPayment } from "./webhook-checkout-settlement";

type InvoicePayment = {
  id: string;
  amount: bigint;
  discountAmount: bigint | null;
  gatewayStatus: string | null;
  kelebihanBayar: bigint | null;
  notes: string | null;
};

// Dihitung seperti InvoicePaymentStateService: payment PAID atau manual
// (tanpa status gateway), termasuk potongan kupon.
function totalTerbayar(payments: InvoicePayment[]) {
  return payments.reduce(
    (sum, p) =>
      p.gatewayStatus === null || p.gatewayStatus === "PAID"
        ? sum + p.amount + (p.discountAmount ?? 0n)
        : sum,
    0n,
  );
}

const sudahDikreditkan = (payments: InvoicePayment[]) =>
  payments.reduce((sum, p) => sum + (p.kelebihanBayar ?? 0n), 0n);

/**
 * Duitku tidak bisa menutup VA lebih awal: setelah pelanggan mengganti metode,
 * VA lama tetap bisa dibayar dan webhook melunasinya. Membayar keduanya dulu
 * melunasi invoice dua kali tanpa jejak. Kelebihannya kini dikreditkan ke
 * saldo pelanggan (memotong tagihan berikutnya) dan dicatat di payment-nya.
 *
 * Saldo ada di database utama, payment di database billing: payment ditandai
 * lebih dulu sehingga retry webhook tidak mengkreditkan dua kali, dan tandanya
 * dilepas bila saldo gagal ditambah.
 */
export async function creditCheckoutOverpayment(checkout: CheckoutPayment[]) {
  for (const payment of checkout) {
    if (payment.invoiceId) await kreditkanKelebihan(payment, payment.invoiceId);
  }
}

type Penanda = { kredit: bigint; notesAsli: string | null };

/**
 * Hitung kelebihan dan tandai payment-nya di bawah kunci baris invoice: dua
 * webhook telat untuk invoice yang sama, tanpa kunci, sama-sama membaca
 * jumlah terbayar yang sama dan mengkreditkan melebihi kelebihannya.
 */
async function tandaiKelebihan(
  payment: CheckoutPayment,
  invoiceId: string,
): Promise<Penanda | null> {
  return prismaBillingAuth.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: {
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
    if (!invoice) return null;

    const kelebihan =
      totalTerbayar(invoice.payment) -
      invoice.totalAmount -
      sudahDikreditkan(invoice.payment);
    if (kelebihan <= 0n) return null;

    const kredit = kelebihan < payment.amount ? kelebihan : payment.amount;
    const notesAsli =
      invoice.payment.find((p) => p.id === payment.id)?.notes ?? null;
    const ditandai = await tx.payment.updateMany({
      where: { id: payment.id, kelebihanBayar: null },
      data: {
        kelebihanBayar: kredit,
        notes: `${notesAsli ? `${notesAsli}\n` : ""}Kelebihan bayar Rp ${Number(kredit).toLocaleString("id-ID")} dikreditkan ke saldo kredit pelanggan.`,
      },
    });
    return ditandai.count === 0 ? null : { kredit, notesAsli };
  });
}

async function kreditkanKelebihan(payment: CheckoutPayment, invoiceId: string) {
  const penanda = await tandaiKelebihan(payment, invoiceId);
  if (!penanda) return;
  const { kredit, notesAsli } = penanda;

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
    `[Webhook] Kelebihan bayar ${kredit} pada invoice ${invoiceId} dikreditkan ke saldo pelanggan ${payment.pelangganId}`,
  );
  await BillingEventDispatcher.onPaymentOverpaid({
    invoiceId,
    pelangganId: payment.pelangganId,
    amount: Number(kredit),
    tenantId: payment.tenantId ?? undefined,
  });
}
