import { NextRequest, NextResponse } from "next/server";
import {
  AssetService,
  depreciateAssetSchema,
  describeZodIssues,
  PESAN_BELUM_MASUK,
  pesanGagalSimpan,
  pesanTanpaIzin,
  translateAssetError,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { masterDataFailureResponse } from "../../../master-data-response";

const assetService = new AssetService();

/** Catat penyusutan satu aset untuk satu periode (opsional `date`). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: PESAN_BELUM_MASUK }, { status: 401 });
  }

  // Penyusutan mengubah nilai aset dan mencatat biaya, jadi butuh izin ubah aset.
  if (!(await hasPermission("asset:update"))) {
    return NextResponse.json(
      { error: pesanTanpaIzin("mencatat penyusutan aset") },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = depreciateAssetSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return masterDataFailureResponse(describeZodIssues(parsed.error));
  }

  try {
    const result = await assetService.depreciateAsset(
      id,
      parsed.data.date ?? new Date(),
      session.user.id,
    );

    if (!result) {
      return NextResponse.json({
        message:
          "Tidak ada penyusutan yang dicatat. Nilai aset ini sudah sampai nilai sisanya.",
      });
    }

    return NextResponse.json({ log: result });
  } catch (error: unknown) {
    return masterDataFailureResponse(
      translateAssetError(error, {
        message: pesanGagalSimpan("Penyusutan aset"),
        logContext: "Penyusutan aset gagal",
      }),
    );
  }
}
