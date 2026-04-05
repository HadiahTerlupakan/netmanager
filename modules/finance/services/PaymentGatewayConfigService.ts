import { randomUUID } from 'crypto'
import { encryptApiKey } from '@/lib/utils/encryption'
import { Prisma } from '@prisma/client-billing'
import type { PaymentGatewayConfig } from '@prisma/client-billing'
import { PaymentGatewayConfigRepository } from '../repositories/PaymentGatewayConfigRepository'

export type PaymentGatewayConfigInput = {
  isEnabled?: boolean
  isProduction?: boolean
  priority?: number
  apiKey?: string
  apiSecret?: string
  clientKey?: string
  merchantId?: string
  settings?: unknown | null
}

type ServiceResult<T> = {
  success: boolean
  data?: T
  error?: string
  code?: 'FETCH_ERROR' | 'UPDATE_ERROR'
}

type SanitizedPaymentGatewayConfig = Omit<PaymentGatewayConfig, 'apiKey' | 'apiSecret'> & {
  apiKey: string | null
  apiSecret: string | null
}

function formatProviderName(provider: string): string {
  if (!provider.length) {
    return provider
  }

  return provider.charAt(0) + provider.slice(1).toLowerCase()
}

function normalizeOptionalText(value?: string): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeSettingsValue(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return Prisma.JsonNull
  }

  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new Error('Settings payment gateway harus berupa JSON valid')
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue
}

function sanitizeConfig(config: PaymentGatewayConfig): SanitizedPaymentGatewayConfig {
  return {
    ...config,
    apiKey: config.apiKey ? '***ENCRYPTED***' : null,
    apiSecret: config.apiSecret ? '***ENCRYPTED***' : null,
  }
}

export class PaymentGatewayConfigService {
  constructor(private readonly repository = new PaymentGatewayConfigRepository()) {}

  async listConfigs(): Promise<ServiceResult<SanitizedPaymentGatewayConfig[]>> {
    try {
      const configs = await this.repository.findAll()
      return { success: true, data: configs.map(sanitizeConfig) }
    } catch {
      return { success: false, error: 'Gagal mengambil konfigurasi payment gateway', code: 'FETCH_ERROR' }
    }
  }

  async upsertConfig(params: {
    provider: string
    tenantId: string
    input: PaymentGatewayConfigInput
    appBaseUrl: string
  }): Promise<ServiceResult<SanitizedPaymentGatewayConfig>> {
    try {
      const normalizedApiKey = normalizeOptionalText(params.input.apiKey)
      const normalizedApiSecret = normalizeOptionalText(params.input.apiSecret)
      const normalizedClientKey = normalizeOptionalText(params.input.clientKey)
      const normalizedMerchantId = normalizeOptionalText(params.input.merchantId)
      const normalizedSettings = normalizeSettingsValue(params.input.settings)

      const config = await this.repository.upsertByProviderAndTenant({
        provider: params.provider,
        tenantId: params.tenantId,
        create: {
          id: randomUUID(),
          provider: params.provider,
          tenantId: params.tenantId,
          providerName: formatProviderName(params.provider),
          isEnabled: params.input.isEnabled ?? false,
          isProduction: params.input.isProduction ?? false,
          priority: params.input.priority ?? 0,
          apiKey: normalizedApiKey ? encryptApiKey(normalizedApiKey) : null,
          apiSecret: normalizedApiSecret ? encryptApiKey(normalizedApiSecret) : null,
          clientKey: normalizedClientKey ?? null,
          merchantId: normalizedMerchantId ?? null,
          settings: normalizedSettings ?? Prisma.JsonNull,
          webhookUrl: `${params.appBaseUrl}/api/payment/webhook/${params.provider.toLowerCase()}`,
          callbackUrl: `${params.appBaseUrl}/payment/callback`,
          updatedAt: new Date(),
        },
        update: {
          ...(params.input.isEnabled !== undefined ? { isEnabled: params.input.isEnabled } : {}),
          ...(params.input.isProduction !== undefined ? { isProduction: params.input.isProduction } : {}),
          ...(params.input.priority !== undefined ? { priority: params.input.priority } : {}),
          ...(params.input.apiKey !== undefined ? { apiKey: normalizedApiKey ? encryptApiKey(normalizedApiKey) : null } : {}),
          ...(params.input.apiSecret !== undefined ? { apiSecret: normalizedApiSecret ? encryptApiKey(normalizedApiSecret) : null } : {}),
          ...(normalizedClientKey !== undefined ? { clientKey: normalizedClientKey } : {}),
          ...(normalizedMerchantId !== undefined ? { merchantId: normalizedMerchantId } : {}),
          ...(normalizedSettings !== undefined ? { settings: normalizedSettings } : {}),
          updatedAt: new Date(),
        },
      })

      return { success: true, data: sanitizeConfig(config) }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gagal memperbarui konfigurasi payment gateway'
      return { success: false, error: errorMessage, code: 'UPDATE_ERROR' }
    }
  }
}

let paymentGatewayConfigService: PaymentGatewayConfigService | null = null

export function getPaymentGatewayConfigService(): PaymentGatewayConfigService {
  if (!paymentGatewayConfigService) {
    paymentGatewayConfigService = new PaymentGatewayConfigService()
  }

  return paymentGatewayConfigService
}
