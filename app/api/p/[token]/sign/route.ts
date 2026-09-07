import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { runAsSystemContext } from "@/lib/tenant-context";
import { checkRateLimit } from "../rate-limit";
import {
  EndorsementService,
  isValidTokenFormat,
  parseSignatureDataUrl,
  signEndorsementSchema,
} from "@/modules/endorsement";

/**
 * POST /api/p/[token]/sign — bubuhkan tanda tangan.
 *
 * Tanpa sesi: token adalah bukti kepemilikan tautan. Dijalankan dalam konteks
 * sistem karena tenant surat ditentukan token, bukan sesi pengunjung.
 */
export const POST = createHandler(
  { auth: false, schema: signEndorsementSchema },
  async (request: NextRequest, ctx) => {
    const token = ctx.params.token as string;

    if (!isValidTokenFormat(token)) {
      return ApiErrors.notFound("Tautan tidak dikenali");
    }

    const limited = await checkRateLimit(request, token);
    if (limited) return limited;

    const signature = parseSignatureDataUrl(ctx.validated.signatureDataUrl);

    const result = await runAsSystemContext(
      "endorsement: tanda tangan pihak luar",
      () =>
        new EndorsementService().sign(token, signature, {
          ipAddress: request.headers
            .get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim(),
          userAgent: request.headers.get("user-agent") ?? undefined,
        }),
      { silent: true },
    );

    return apiSuccess({ completed: result.completed });
  },
);
