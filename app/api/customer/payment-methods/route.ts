import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { prisma } from "@/modules/database";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  PaymentGatewayManager,
  getCustomerPaymentMethodsByProvider,
} from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const gatewayManager = new PaymentGatewayManager();
    const providers = await gatewayManager.getEnabledProviders();

    const paymentMethods = providers.flatMap((provider) =>
      getCustomerPaymentMethodsByProvider(provider.provider),
    );

    // Fetch active manual company bank accounts
    const companyBankAccounts = await prisma.companyBankAccount.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });

    // Add them to the manual methods list
    companyBankAccounts.forEach((account) => {
      paymentMethods.push({
        id: `manual_${account.id}`,
        name: account.bankName,
        provider: "MANUAL",
        type: "MANUAL",
        code: `MANUAL_${account.id}`,
        group: "Transfer Manual",
        details: {
          bankName: account.bankName,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
        },
      });
    });

    // Fallback if no specific provider recognized but one is enabled
    if (paymentMethods.length === 0 && providers.length > 0) {
      paymentMethods.push({
        id: "generic_gateway",
        name: "Online Payment",
        provider: providers[0].provider,
        type: "ONLINE",
        code: "ONLINE",
        group: "Online Payment",
      });
    }

    return apiSuccess(paymentMethods);
  } catch (error) {
    logger.error(
      "[Payment Methods Error]",
      error instanceof Error ? error : undefined,
    );
    return ApiErrors.internalError("Gagal memuat metode pembayaran");
  }
}
