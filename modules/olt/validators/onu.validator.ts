import { z } from "zod";

const SERIAL_NUMBER_REGEX = /^[A-Za-z0-9]{1,32}$/;

export const serialNumberSchema = z
  .string()
  .min(1, "Serial number wajib diisi")
  .max(32)
  .regex(SERIAL_NUMBER_REGEX, "Serial number hanya boleh huruf dan angka");

export const registerOnuSchema = z.object({
  oltId: z.string().min(1, "oltId wajib diisi"),
  serialNumber: serialNumberSchema,
  ponPort: z.coerce.number().int().min(1),
  onuIndex: z.coerce.number().int().min(1).optional(),
  bandwidthProfile: z
    .string()
    .max(50)
    .regex(/^[A-Za-z0-9_-]*$/, "Profile name tidak valid")
    .optional(),
  vlanId: z.coerce.number().int().min(1).max(4094).optional(),
});

export const assignOnuSchema = z.object({
  pelangganId: z.string().min(1, "pelangganId wajib diisi"),
});

export const preRegisterSchema = z.object({
  serialNumber: serialNumberSchema,
  oltId: z.string().optional(),
  pelangganId: z.string().optional(),
  bandwidthProfile: z
    .string()
    .max(50)
    .regex(/^[A-Za-z0-9_-]*$/, "Profile name tidak valid")
    .optional(),
  vlanId: z.coerce.number().int().min(1).max(4094).optional(),
});

export const onuListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  oltId: z.string().optional(),
  slotFrame: z.coerce.number().int().min(0).optional(),
  slot: z.coerce.number().int().min(0).optional(),
  ponPort: z.coerce.number().int().min(1).optional(),
  status: z
    .enum([
      "UNREGISTERED",
      "REGISTERED",
      "ACTIVE",
      "OFFLINE",
      "DISABLED",
      "LOS",
      "DYING_GASP",
    ])
    .optional(),
  search: z.string().optional(),
});

export const searchOnuSchema = z.object({
  sn: serialNumberSchema,
  oltId: z.string().optional(),
});

export const firmwareUpgradeSchema = z.object({
  firmwareFile: z
    .string()
    .min(1, "firmwareFile wajib diisi")
    .max(120)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Nama file firmware hanya boleh huruf, angka, titik, underscore, dan strip",
    ),
});

export type RegisterOnuInput = z.infer<typeof registerOnuSchema>;
export type AssignOnuInput = z.infer<typeof assignOnuSchema>;
export type PreRegisterInput = z.infer<typeof preRegisterSchema>;
export type OnuListQuery = z.infer<typeof onuListQuerySchema>;
export type SearchOnuInput = z.infer<typeof searchOnuSchema>;
export type FirmwareUpgradeInput = z.infer<typeof firmwareUpgradeSchema>;
