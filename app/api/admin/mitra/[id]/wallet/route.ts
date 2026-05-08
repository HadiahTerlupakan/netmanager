import { NextRequest, NextResponse } from "next/server";
import { hasPermission, getCurrentUser } from "@/lib/rbac";
import { getMitraWalletService, getMitraService } from "@/modules/mitra";
import { checkSiteRestriction } from "@/modules/roles";

const walletService = getMitraWalletService();
const mitraService = getMitraService();

async function validateMitraAccess(
  mitraId: string,
  user: { id: string; name?: string | null },
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction(
    { user } as never,
    "mitra",
  );
  if (!isRestricted) return { allowed: true };

  const mitra = await mitraService.getMitraById(mitraId);
  if (!mitra.success) return { allowed: false, error: "Mitra tidak ditemukan" };

  if (!mitra.data.siteId || !siteIds.includes(mitra.data.siteId)) {
    return {
      allowed: false,
      error: "Anda tidak dapat mengakses mitra di luar scope Anda",
    };
  }

  return { allowed: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:read", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");

  const [balanceResult, transactionsResult] = await Promise.all([
    walletService.getBalance(id, user.tenantId as string),
    walletService.getTransactions(id, user.tenantId as string, page),
  ]);

  if (!balanceResult.success) {
    return NextResponse.json(
      { success: false, error: balanceResult.error },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      balance: balanceResult.data,
      transactions: transactionsResult.success
        ? transactionsResult.data
        : { transactions: [], total: 0 },
    },
  });
}

// Admin manual adjustment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (
    !user ||
    !user.id ||
    !(await hasPermission("mitra:update", user, { silent: true }))
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const access = await validateMitraAccess(id, {
    id: user.id,
    name: user.name,
  });
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { amount, description } = body;

    if (!amount || !description) {
      return NextResponse.json(
        { success: false, error: "Amount dan deskripsi harus diisi" },
        { status: 400 },
      );
    }

    const result = await walletService.addAdjustment(
      id,
      amount,
      description,
      user.id!,
      user.tenantId as string,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
}
