import { NextResponse } from "next/server";
import { ensurePermission } from "@/lib/rbac";
import { getMitraCommissionSyncService } from "@/modules/mitra";

const service = getMitraCommissionSyncService();

export async function POST(req: Request) {
  await ensurePermission("mitra:update");

  const body = await req.json();
  const result = await service.syncCommission({
    mitraId: body.mitraId,
    amount: Number(body.amount),
    description: body.description,
    referenceId: body.referenceId,
  });

  if (!result.success) {
    const status =
      result.code === "VALIDATION_ERROR" || result.code === "DUPLICATE"
        ? 400
        : result.code === "NOT_FOUND"
          ? 404
          : 500;
    return NextResponse.json(
      { success: false, message: result.error },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Berhasil mensinkronisasi komisi ke wallet",
  });
}
