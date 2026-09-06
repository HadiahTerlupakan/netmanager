import { NextResponse } from "next/server";

import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { updateInvestorSchema } from "@/lib/validations/investor";
import {
  deleteInvestorById,
  getInvestorById,
  toggleInvestorActive,
  updateInvestorById,
} from "@/modules/investor";

function internalError(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;

    const investor = await getInvestorById(id);

    if (!investor) {
      return ApiErrors.notFound("Investor");
    }

    return apiSuccess(investor);
  },
);

export const PUT = createHandler(
  {
    auth: true,
    permissions: ["investors:update"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const body = await req.json();
    const validatedData = updateInvestorSchema.parse({ ...body, id });
    const { username, password, namaLengkap, perusahaan, email, noTelp } =
      validatedData;

    const result = await updateInvestorById(
      id,
      {
        username,
        password,
        namaLengkap,
        perusahaan,
        email,
        noTelp,
      },
      ctx.session?.user.id,
    );

    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error || "Investor");
      }

      if (result.code === "BAD_REQUEST") {
        return ApiErrors.badRequest(
          result.error || "Gagal memperbarui investor",
        );
      }

      return internalError(result.error || "Gagal memperbarui investor");
    }

    ctx.validated = { id, username, namaLengkap, perusahaan, email };

    return apiSuccess(result.data);
  },
);

export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["investors:update"],
  },
  async (req, ctx) => {
    const { id } = ctx.params;
    const { isActive } = await req.json();

    const result = await toggleInvestorActive(
      id,
      isActive,
      ctx.session?.user.id,
    );

    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error || "Investor");
      }

      return internalError(result.error || "Gagal memperbarui status investor");
    }

    ctx.validated = { id, isActive };
    return apiSuccess(result.data);
  },
);

export const DELETE = createHandler(
  {
    auth: true,
    permissions: ["investors:delete"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;

    const result = await deleteInvestorById(id, ctx.session?.user.id);

    if (!result.success) {
      if (result.code === "NOT_FOUND") {
        return ApiErrors.notFound(result.error || "Investor");
      }

      if (result.code === "BAD_REQUEST") {
        return ApiErrors.badRequest(result.error || "Gagal menghapus investor");
      }

      return internalError(result.error || "Gagal menghapus investor");
    }

    ctx.validated = {
      id,
      deletedAt: new Date(),
      username: result.data?.username,
    };
    return apiSuccess({ message: "Investor berhasil dihapus" });
  },
);
