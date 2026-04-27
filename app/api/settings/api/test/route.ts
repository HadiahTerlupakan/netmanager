import { NextResponse } from "next/server";
import { createHandler, apiSuccess } from "@/lib/api";
import {
  googleGeminiTestSchema,
  type GoogleGeminiTestInput,
} from "@/lib/validations/settings";
import { testGoogleGeminiApiKey } from "@/modules/settings";

/**
 * POST /api/settings/api/test
 * Test API Key Google Gemini
 */
export const POST = createHandler<GoogleGeminiTestInput>(
  {
    auth: true,
    permissions: ["api:update"],
    schema: googleGeminiTestSchema,
  },
  async (_req, ctx) => {
    const { apiKey } = ctx.validated;

    const result = await testGoogleGeminiApiKey(apiKey);

    if ("error" in result) {
      return NextResponse.json(
        {
          error: result.error,
          valid: false,
        },
        { status: 400 },
      );
    }

    return apiSuccess({
      success: true,
      valid: true,
      message: "API Key valid dan dapat digunakan",
    });
  },
);
