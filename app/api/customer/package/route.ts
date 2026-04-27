import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getCustomerPackageService } from "@/modules/pelanggan";

/**
 * Get authenticated customer package detail.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const customerPackageService = getCustomerPackageService();
    const customerPackage = await customerPackageService.getCustomerPackage(
      authResult.session.id,
    );

    return NextResponse.json({
      success: true,
      ...customerPackage,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Data pelanggan tidak ditemukan" },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "PACKAGE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Paket langganan tidak ditemukan" },
        { status: 404 },
      );
    }

    console.error("[Customer Package Error]:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
