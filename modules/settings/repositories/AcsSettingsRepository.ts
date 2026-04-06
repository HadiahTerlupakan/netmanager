import { prisma } from '@/modules/database'
import type { Prisma } from '@prisma/client'

export type AcsVendorInput = {
  name: string
  manufacturerPatterns: string
  productPatterns: string
  parameterPrefix?: string | null
  priority?: number
  enabled?: boolean
  description?: string | null
}

export type AcsWifiSecurityInput = {
  productClass: string
  parameterPath: string
  wpaTypes?: string | null
  encryptTypes?: string | null
}

export const AcsSettingsRepository = {
  findAllVendors: async () => {
    return prisma.acsVendor.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    })
  },

  createVendor: async (payload: AcsVendorInput) => {
    return prisma.acsVendor.create({
      data: {
        name: payload.name,
        manufacturerPatterns: payload.manufacturerPatterns,
        productPatterns: payload.productPatterns,
        parameterPrefix: payload.parameterPrefix ?? null,
        priority: payload.priority ?? 10,
        enabled: payload.enabled ?? true,
        description: payload.description ?? null,
        serviceListPath: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*.WANPPPConnection.*.X_BROADCOM_COM_IGMP_VLANID',
        vlanIdPath: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.*.WANPPPConnection.*.X_BROADCOM_COM_IGMP_VLANID',
      },
    })
  },

  updateVendor: async (id: string, payload: AcsVendorInput) => {
    return prisma.acsVendor.update({
      where: { id },
      data: {
        name: payload.name,
        manufacturerPatterns: payload.manufacturerPatterns,
        productPatterns: payload.productPatterns,
        parameterPrefix: payload.parameterPrefix ?? null,
        priority: payload.priority,
        enabled: payload.enabled,
        description: payload.description ?? null,
      },
    })
  },

  deleteVendor: async (id: string) => {
    await prisma.acsVendor.delete({ where: { id } })
  },

  findWifiSecurityByTenant: async (tenantId?: string | null) => {
    const whereClause: Prisma.AcsWifiSecurityWhereInput = tenantId
      ? {
          OR: [
            { tenantId: null },
            { tenantId: tenantId },
          ],
        }
      : { tenantId: null }

    return prisma.acsWifiSecurity.findMany({
      where: whereClause,
      orderBy: { productClass: 'asc' },
    })
  },

  upsertWifiSecurityByTenantAndProductClass: async (tenantId: string | null, payload: AcsWifiSecurityInput) => {
    return prisma.acsWifiSecurity.upsert({
      where: {
        tenantId_productClass: {
          tenantId,
          productClass: payload.productClass,
        },
      },
      update: {
        parameterPath: payload.parameterPath,
        wpaTypes: payload.wpaTypes ?? null,
        encryptTypes: payload.encryptTypes ?? null,
      },
      create: {
        productClass: payload.productClass,
        parameterPath: payload.parameterPath,
        wpaTypes: payload.wpaTypes ?? null,
        encryptTypes: payload.encryptTypes ?? null,
        tenantId,
      },
    })
  },

  updateWifiSecurity: async (id: string, payload: AcsWifiSecurityInput) => {
    return prisma.acsWifiSecurity.update({
      where: { id },
      data: {
        productClass: payload.productClass,
        parameterPath: payload.parameterPath,
        wpaTypes: payload.wpaTypes ?? null,
        encryptTypes: payload.encryptTypes ?? null,
      },
    })
  },

  deleteWifiSecurity: async (id: string) => {
    await prisma.acsWifiSecurity.delete({ where: { id } })
  },
}

export function normalizeAcsVendorPayload(payload: AcsVendorInput): AcsVendorInput {
  return {
    name: payload.name.trim(),
    manufacturerPatterns: payload.manufacturerPatterns.trim(),
    productPatterns: payload.productPatterns.trim(),
    parameterPrefix: payload.parameterPrefix?.trim() || null,
    priority: payload.priority ?? 10,
    enabled: payload.enabled ?? true,
    description: payload.description?.trim() || null,
  }
}

export function normalizeAcsWifiSecurityPayload(payload: AcsWifiSecurityInput): AcsWifiSecurityInput {
  return {
    productClass: payload.productClass.trim(),
    parameterPath: payload.parameterPath.trim(),
    wpaTypes: payload.wpaTypes?.trim() || null,
    encryptTypes: payload.encryptTypes?.trim() || null,
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as Prisma.PrismaClientKnownRequestError).code === 'P2002'
  )
}
