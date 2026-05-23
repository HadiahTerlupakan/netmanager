import { NextResponse } from "next/server";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { investorSchema } from "@/lib/validations/investor";
import { createInvestor, getInvestors } from "@/modules/investor";

function internalError(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
    feature: "investor",
  },
  async () => {
    const result = await getInvestors();

    if (!result.success) {
      return internalError(result.error || "Gagal mengambil daftar investor");
    }

    return apiSuccess(result.data);
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["investors:create"],
    schema: investorSchema,
    feature: "investor",
  },
  async (_req, ctx) => {
    const {
      username,
      password,
      namaLengkap,
      perusahaan,
      noTelp,
      email,
      tenantId,
    } = ctx.validated;

    const result = await createInvestor(
      {
        username,
        password,
        namaLengkap,
        perusahaan,
        noTelp,
        email,
        tenantId,
      },
      ctx.session?.user.id,
    );

    if (!result.success) {
      if (result.code === "BAD_REQUEST") {
        return ApiErrors.badRequest(result.error || "Gagal membuat investor");
      }

      return internalError(result.error || "Gagal membuat investor");
    }

    return apiSuccess(result.data, { status: 201 });
  },
);
