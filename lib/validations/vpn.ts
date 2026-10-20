import * as z from "zod";

const MAX_PORT = 65535;
const MAX_NAME_LENGTH = 64;
const MAX_HOST_LENGTH = 253;

export const vpnServerCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(MAX_NAME_LENGTH),
  publicHost: z
    .string()
    .trim()
    .min(1, "Host publik wajib diisi")
    .max(MAX_HOST_LENGTH),
  listenPort: z.number().int().min(1).max(MAX_PORT).optional(),
});

export const tenantVpnServersSchema = z.object({
  serverIds: z
    .array(z.string().min(1))
    .refine((ids) => new Set(ids).size === ids.length, "Server VPN harus unik"),
});

export const vpnAdminPeerCreateSchema = z.object({
  label: z.string().trim().min(1, "Label wajib diisi").max(MAX_NAME_LENGTH),
});
