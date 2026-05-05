import { prismaBillingAuth } from "@/lib/prisma-billing";
import type { IPaymentGatewayConfigRepository } from "../domain/ports/IPaymentGatewayConfigRepository";
import type { PaymentGatewayConfig } from "../domain/entities/PaymentGatewayConfig";
import type { ProviderType } from "../domain/value-objects/ProviderType";

export class PaymentGatewayConfigRepository implements IPaymentGatewayConfigRepository {
  async findEnabled(tenantId?: string | null): Promise<PaymentGatewayConfig[]> {
    const configs = await prismaBillingAuth.paymentGatewayConfig.findMany({
      where: {
        isEnabled: true,
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { priority: "asc" },
    });

    return configs.map(this.toDomain);
  }

  async findByProvider(
    provider: ProviderType,
    tenantId?: string | null,
  ): Promise<PaymentGatewayConfig | null> {
    const config = await prismaBillingAuth.paymentGatewayConfig.findFirst({
      where: {
        provider,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    return config ? this.toDomain(config) : null;
  }

  async save(config: PaymentGatewayConfig): Promise<void> {
    await prismaBillingAuth.paymentGatewayConfig.create({
      data: {
        id: config.id,
        provider: config.provider,
        providerName: config.provider,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        clientKey: config.clientKey,
        merchantId: config.merchantId,
        isProduction: config.isProduction,
        isEnabled: config.isEnabled,
        priority: config.priority,
        settings: config.settings as never,
        tenantId: config.tenantId,
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, data: Partial<PaymentGatewayConfig>): Promise<void> {
    await prismaBillingAuth.paymentGatewayConfig.update({
      where: { id },
      data: {
        ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
        ...(data.apiSecret !== undefined ? { apiSecret: data.apiSecret } : {}),
        ...(data.clientKey !== undefined ? { clientKey: data.clientKey } : {}),
        ...(data.merchantId !== undefined
          ? { merchantId: data.merchantId }
          : {}),
        ...(data.isProduction !== undefined
          ? { isProduction: data.isProduction }
          : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.settings !== undefined
          ? { settings: data.settings as never }
          : {}),
      },
    });
  }

  private toDomain(prismaConfig: {
    id: string;
    provider: string;
    apiKey: string;
    apiSecret: string | null;
    clientKey: string | null;
    merchantId: string | null;
    isProduction: boolean;
    isEnabled: boolean;
    priority: number;
    settings: unknown;
    tenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentGatewayConfig {
    return {
      id: prismaConfig.id,
      provider: prismaConfig.provider as ProviderType,
      apiKey: prismaConfig.apiKey,
      apiSecret: prismaConfig.apiSecret,
      clientKey: prismaConfig.clientKey,
      merchantId: prismaConfig.merchantId,
      isProduction: prismaConfig.isProduction,
      isEnabled: prismaConfig.isEnabled,
      priority: prismaConfig.priority,
      settings: prismaConfig.settings as Record<string, unknown> | null,
      tenantId: prismaConfig.tenantId,
      createdAt: prismaConfig.createdAt,
      updatedAt: prismaConfig.updatedAt,
    };
  }
}
