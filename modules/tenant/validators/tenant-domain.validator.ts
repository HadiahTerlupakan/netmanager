import { z } from "zod";
import { TENANT_SLUG_PATTERN } from "../services/tenant-slug";

/**
 * Slug boleh dikosongkan: bila tidak diisi, service menurunkannya dari nama
 * tenant. Memaksa super admin mengarang slug hanya menambah cara untuk salah.
 */
export const createTenantDomainSchema = z.object({
  tenantId: z.string().min(1),
  slug: z.string().min(3).max(63).regex(TENANT_SLUG_PATTERN).optional(),
  domain: z.string().min(4).max(253).optional(),
});

export const updateDomainSchema = z.object({
  domain: z.string().min(4).max(253),
});
