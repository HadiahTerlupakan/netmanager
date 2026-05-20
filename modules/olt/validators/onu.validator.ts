import { z } from "zod";

export const registerOnuSchema = z.object({
  oltId: z.string().min(1, "oltId wajib diisi"),
  serialNumber: z.string().min(1, "Serial number wajib diisi").max(32),
  ponPort: z.coerce.number().int().min(1),
  onuIndex: z.coerce.number().int().min(1).optional(),
  bandwidthProfile: z.string().max(50).optional(),
  vlanId: z.coerce.number().int().min(1).max(4094).optional(),
});

export const assignOnuSchema = z.object({
  pelangganId: z.string().min(1, "pelangganId wajib diisi"),
});

export const preRegisterSchema = z.object({
  serialNumber: z.string().min(1, "Serial number wajib diisi").max(32),
  oltId: z.string().optional(),
  pelangganId: z.string().optional(),
  bandwidthProfile: z.string().max(50).optional(),
  vlanId: z.coerce.number().int().min(1).max(4094).optional(),
});

export const onuListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  oltId: z.string().optional(),
  status: z
    .enum([
      "UNREGISTERED",
      "REGISTERED",
      "ACTIVE",
      "OFFLINE",
      "DISABLED",
      "LOS",
    ])
    .optional(),
  search: z.string().optional(),
});

export const searchOnuSchema = z.object({
  sn: z.string().min(1, "Serial number wajib diisi"),
  oltId: z.string().optional(),
});

export type RegisterOnuInput = z.infer<typeof registerOnuSchema>;
export type AssignOnuInput = z.infer<typeof assignOnuSchema>;
export type PreRegisterInput = z.infer<typeof preRegisterSchema>;
export type OnuListQuery = z.infer<typeof onuListQuerySchema>;
export type SearchOnuInput = z.infer<typeof searchOnuSchema>;
