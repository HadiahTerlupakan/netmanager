import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelPaidPayment, PaymentCancellationError } from "@/modules/finance";

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
    await cancelPaidPayment({
      paymentId,
      adminLabel: session.user.name || session.user.email || "Admin",
    });

    return NextResponse.json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error: unknown) {
    if (error instanceof PaymentCancellationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

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
