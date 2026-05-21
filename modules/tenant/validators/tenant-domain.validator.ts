import { z } from "zod";

export const createTenantDomainSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  domain: z.string().min(4).max(253).optional(),
});

export const updateDomainSchema = z.object({
  domain: z.string().min(4).max(253),
});
