import * as z from "zod";

const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;

const hostnameRegex =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** IP address atau hostname (FQDN). */
const ipOrHostnameSchema = z
  .string()
  .min(1, "Wajib diisi")
  .max(253)
  .refine((value) => ipv4Regex.test(value) || hostnameRegex.test(value), {
    message: "Harus berupa IP address atau hostname yang valid",
  });

const portSchema = z
  .number()
  .int("Port harus bilangan bulat")
  .min(1, "Port minimal 1")
  .max(65535, "Port maksimal 65535");

/** Validate payload untuk membuat accel-ppp server. */
export const accelPppServerCreateSchema = z.object({
  name: z.string().min(1, "Nama server wajib diisi").max(120),
  ipAddress: ipOrHostnameSchema,
  description: z.string().max(500).optional().nullable(),

  nasIdentifier: z.string().max(120).optional().nullable(),
  radiusSecret: z.string().min(8, "RADIUS secret minimal 8 karakter").max(255),
  authPort: portSchema.default(1812),
  acctPort: portSchema.default(1813),
  coaPort: portSchema.default(3799),

  cliHost: ipOrHostnameSchema,
  cliPort: portSchema.default(2001),
  cliPassword: z.string().max(255).optional().nullable(),

  siteId: z.string().min(1).optional().nullable(),
});

/** Validate payload untuk update accel-ppp server. */
export const accelPppServerUpdateSchema = accelPppServerCreateSchema
  .partial()
  .extend({
    radiusSecret: z
      .string()
      .min(8, "RADIUS secret minimal 8 karakter")
      .max(255)
      .optional(),
  });

/** Validate URL param `id`. */
export const accelPppServerIdParamSchema = z.object({
  id: z.string().min(1, "ID tidak valid"),
});

/** Validate URL param `id` + `username` (untuk kick session). */
export const accelPppKickParamSchema = z.object({
  id: z.string().min(1, "ID tidak valid"),
  username: z.string().min(1, "Username wajib diisi").max(120),
});

/** Validate query filter untuk daftar accel-ppp server. */
export const accelPppServerListQuerySchema = z.object({
  search: z.string().optional(),
  siteId: z.string().optional(),
  pingStatus: z.enum(["online", "offline"]).optional(),
});

export type AccelPppServerCreateInput = z.infer<
  typeof accelPppServerCreateSchema
>;
export type AccelPppServerUpdateInput = z.infer<
  typeof accelPppServerUpdateSchema
>;
export type AccelPppServerListQuery = z.infer<
  typeof accelPppServerListQuerySchema
>;
