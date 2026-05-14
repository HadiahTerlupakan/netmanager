import { z } from "zod";
import { IntegrationFactory } from "../factories/IntegrationFactory";

export function validateMixRadiusBaseUrl(baseUrl: string) {
  const normalizedBaseUrl =
    IntegrationFactory.normalizeMixRadiusBaseUrl(baseUrl);
  const validation = IntegrationFactory.validateUrl(normalizedBaseUrl);

  return {
    normalizedBaseUrl,
    validation,
  };
}

export const mixRadiusConfigCreateSchema = z.object({
  name: z.string().min(1, "Nama konfigurasi wajib diisi"),
  baseUrl: z.string().min(1, "URL wajib diisi"),
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  isActive: z.boolean().optional().default(false),
  tenantId: z.string().optional(),
});

export const mixRadiusConfigUpdateSchema =
  mixRadiusConfigCreateSchema.partial();

export const investorSiteSchema = z.object({
  name: z.string().min(1, "Nama belum diisi"),
  owners: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});
