import { z } from "zod";

const oltVendorEnum = z.enum(["ZTE", "HSGQ", "HIOSO", "CDATA"]);
const supportedVendorEnum = z.enum(["ZTE"], {
  message: "Saat ini hanya vendor ZTE yang didukung",
});
const oltStatusEnum = z.enum(["ACTIVE", "MAINTENANCE", "OFFLINE"]);

const ipAddressRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const safeIdentifierRegex = /^[A-Za-z0-9._\- ]*$/;

export const createOltDeviceSchema = z.object({
  name: z.string().min(1, "Nama OLT wajib diisi").max(100),
  vendor: supportedVendorEnum,
  model: z.string().min(1, "Model wajib diisi").max(50),
  ipAddress: z
    .string()
    .min(1, "IP Address wajib diisi")
    .regex(ipAddressRegex, "Format IP tidak valid"),
  snmpCommunity: z.string().max(100).regex(safeIdentifierRegex).optional(),
  snmpPort: z.coerce.number().int().min(1).max(65535).optional(),
  telnetPort: z.coerce.number().int().min(1).max(65535).optional(),
  telnetUser: z.string().max(100).regex(safeIdentifierRegex).optional(),
  telnetPass: z.string().max(100).optional(),
  telnetEnablePass: z.string().max(100).optional(),
  defaultSlotFrame: z.coerce.number().int().min(1).max(20).optional(),
  defaultSlot: z.coerce.number().int().min(1).max(20).optional(),
  totalPonPorts: z.coerce.number().int().min(1).max(128),
  location: z.string().max(200).optional(),
});

export const updateOltDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(50).optional(),
  ipAddress: z
    .string()
    .regex(ipAddressRegex, "Format IP tidak valid")
    .optional(),
  snmpCommunity: z.string().max(100).regex(safeIdentifierRegex).optional(),
  snmpPort: z.coerce.number().int().min(1).max(65535).optional(),
  telnetPort: z.coerce.number().int().min(1).max(65535).optional(),
  telnetUser: z.string().max(100).regex(safeIdentifierRegex).optional(),
  telnetPass: z.string().max(100).optional(),
  telnetEnablePass: z.string().max(100).optional(),
  defaultSlotFrame: z.coerce.number().int().min(1).max(20).optional(),
  defaultSlot: z.coerce.number().int().min(1).max(20).optional(),
  totalPonPorts: z.coerce.number().int().min(1).max(128).optional(),
  location: z.string().max(200).optional(),
  status: oltStatusEnum.optional(),
});

export const oltDeviceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  vendor: oltVendorEnum.optional(),
  status: oltStatusEnum.optional(),
  search: z.string().optional(),
});

export type CreateOltDeviceInput = z.infer<typeof createOltDeviceSchema>;
export type UpdateOltDeviceInput = z.infer<typeof updateOltDeviceSchema>;
export type OltDeviceListQuery = z.infer<typeof oltDeviceListQuerySchema>;
