import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getClientInfoFromHeaders } from "@/lib/request-helpers";
import { runAsSystemContext } from "@/lib/tenant-context";
import { checkRateLimit } from "../rate-limit";
import {
  declineEndorsementSchema,
  EndorsementService,
  isValidTokenFormat,
} from "@/modules/endorsement";

/** POST /api/p/[token]/decline — tolak mengesahkan surat. */
export const POST = createHandler(
  { auth: false, schema: declineEndorsementSchema },
  async (request: NextRequest, ctx) => {
    const token = ctx.params.token as string;

    if (!isValidTokenFormat(token)) {
      return ApiErrors.notFound("Tautan tidak dikenali");
    }

    const limited = await checkRateLimit(request, token);
    if (limited) return limited;

    await runAsSystemContext(
      "endorsement: penolakan pihak luar",
      () =>
        new EndorsementService().decline(token, ctx.validated.reason, getClientInfoFromHeaders(request.headers)),
      { silent: true },
    );

    return apiSuccess({ declined: true });
  },
);
