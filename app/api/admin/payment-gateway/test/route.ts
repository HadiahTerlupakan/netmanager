import { NextResponse } from "next/server";
import { z } from "zod";
import { createHandler } from "@/lib/api";
import { validateRequestBody } from "@/lib/validation/middleware";
import { getPaymentGatewayTestService } from "@/modules/finance";

const testService = getPaymentGatewayTestService();

const paymentGatewayTestSchema = z.object({
  provider: z.string().trim().min(1, "Provider tidak valid"),
  apiKey: z.string().nullable().optional(),
  clientKey: z.string().nullable().optional(),
  isProduction: z.boolean().optional(),
});

type PaymentGatewayTestRequest = z.infer<typeof paymentGatewayTestSchema>;

export const POST = createHandler(
  {
    auth: true,
    permissions: ["payment_gateway:update"],
  },
  async (req) => {
    const validation = await validateRequestBody(req, paymentGatewayTestSchema);

    if (!validation.success) {
      const message = validation.errors?.[0]?.message ?? "Provider tidak valid";

      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    const { provider, apiKey, clientKey, isProduction } = validation.data as PaymentGatewayTestRequest;

    const result = await testService.testConnection({
      provider,
      apiKey,
      clientKey,
      isProduction,
    });

    const success = Boolean(result.success);
    const message =
      result.message || (success ? "Koneksi berhasil" : "Gagal menghubungkan provider");

    return NextResponse.json({ success, message });
  }
);
