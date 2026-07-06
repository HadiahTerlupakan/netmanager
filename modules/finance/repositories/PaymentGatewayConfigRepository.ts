import { prismaBilling } from "@/lib/prisma-billing";
import type { Prisma } from "@prisma/client-billing";

export class PaymentGatewayConfigRepository {
  async findAll(tenantId?: string) {
    return prismaBilling.paymentGatewayConfig.findMany({
      ...(tenantId ? { where: { tenantId } } : {}),
      orderBy: { priority: "desc" },
    });
  }

  async findEnabled(tenantId?: string) {
    return prismaBilling.paymentGatewayConfig.findMany({
      where: {
        isEnabled: true,
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { priority: "desc" },
    });
  }

  async findByProvider(providerType: string, tenantId?: string) {
    return prismaBilling.paymentGatewayConfig.findFirst({
      where: {
        provider: providerType,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  async findFirst(where: Prisma.PaymentGatewayConfigWhereInput) {
    return prismaBilling.paymentGatewayConfig.findFirst({ where });
  }

  async findMany(where: Prisma.PaymentGatewayConfigWhereInput) {
    return prismaBilling.paymentGatewayConfig.findMany({ where });
  }

  async upsertByProviderAndTenant(params: {
    provider: string;
    tenantId: string;
    create: Prisma.PaymentGatewayConfigUncheckedCreateInput;
    update: Prisma.PaymentGatewayConfigUncheckedUpdateInput;
  }) {
    return prismaBilling.paymentGatewayConfig.upsert({
      where: {
        provider_tenantId: {
          provider: params.provider,
          tenantId: params.tenantId,
        },
      },
      create: params.create,
      update: params.update,
    });
  }
}
