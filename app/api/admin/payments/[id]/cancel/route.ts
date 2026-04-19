import { NextRequest, NextResponse } from "next/server";
import { prismaBilling } from "@/modules/database";
import { prisma } from "@/modules/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendCustomerPushNotification } from "@/modules/notification";
import { getPelangganService } from "@/modules/pelanggan";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: paymentId } = await params;

    const payment = await prismaBilling.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (payment.gatewayStatus !== "PAID") {
      return NextResponse.json(
        { success: false, error: "Only PAID payments can be cancelled" },
        { status: 400 },
      );
    }

    const invoice = payment.invoice;
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Associated invoice not found" },
        { status: 404 },
      );
    }

    // 1. Update Payment Status
    await prismaBilling.payment.update({
      where: { id: paymentId },
      data: {
        gatewayStatus: "CANCELLED",
        notes: `Cancelled by admin ${session.user.name || session.user.email} on ${new Date().toISOString()}`,
      },
    });

    // 2. Recalculate Invoice paidAmount
    const diff = invoice.paidAmount - payment.amount;
    const newPaidAmount = diff > 0n ? diff : 0n;

    // Determine new invoice status
    let newStatus = invoice.status;
    if (newPaidAmount === 0n) {
      newStatus = "SENT";
    } else if (newPaidAmount < invoice.totalAmount) {
      newStatus = "PARTIAL_PAID";
    }

    await prismaBilling.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    // 3. Automated Reversal Logic: If the invoice became unpaid/partial, revert customer status
    if (
      invoice.status === "PAID" &&
      (newStatus === "SENT" || newStatus === "PARTIAL_PAID")
    ) {
      const customer = await prisma.pelanggan.findUnique({
        where: { id: invoice.pelangganId },
      });

      if (customer && customer.status !== "ISOLIR") {
        // User requested to immediately isolate the customer upon cancellation
        await getPelangganService().updateStatusPelanggan(
          customer.id,
          "ISOLIR",
        );
      }
    }

    // 4. Send Push Notification to Customer
    await sendCustomerPushNotification(
      invoice.pelangganId,
      "Pembayaran Dibatalkan",
      "Pembayaran Anda telah dibatalkan oleh Admin.",
      { paymentId: payment.id, invoiceId: invoice.id, action: "CANCEL" },
    );

    return NextResponse.json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error: unknown) {
    console.error("Error cancelling payment:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan internal server";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
