import * as z from "zod";

const MAX_PORT = 65535;
const MAX_NAME_LENGTH = 64;
const MAX_HOST_LENGTH = 253;

/** Id dari core netmanager-vpn: heksadesimal huruf kecil. */
export const vpnIdSchema = z.string().regex(/^[0-9a-f]{1,64}$/);

/** Protokol tunnel router; tanpa isian berarti WireGuard supaya klien lama tetap jalan. */
export const vpnProtocolSchema = z.enum(["WIREGUARD", "L2TP"]);

// Urutan = prioritas: elemen pertama server utama.
const orderedVpnServerIdsSchema = z
  .array(vpnIdSchema)
  .min(1, "Pilih minimal satu server VPN")
  .refine((ids) => new Set(ids).size === ids.length, "Server VPN harus unik");

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
    .array(vpnIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, "Server VPN harus unik"),
});

export const routerVpnServersSchema = z.object({
  serverIds: orderedVpnServerIdsSchema,
});

export const routerVpnEnableSchema = z.object({
  serverIds: orderedVpnServerIdsSchema,
  protocol: vpnProtocolSchema.default("WIREGUARD"),
  previousDraftId: vpnIdSchema.optional(),
});

export const routerVpnProtocolSchema = z.object({
  protocol: vpnProtocolSchema,
});

export const routerVpnTunnelTestSchema = z.object({
  draftId: vpnIdSchema,
});

export const routerVpnMigrateSchema = z.object({
  draftId: vpnIdSchema,
  serverIds: orderedVpnServerIdsSchema,
});

export const vpnAdminPeerCreateSchema = z.object({
  label: z.string().trim().min(1, "Label wajib diisi").max(MAX_NAME_LENGTH),
});

const API_PASSWORD_PATTERN = /^[A-Za-z0-9_-]{24,64}$/;
const API_USERNAME_PATTERN = /^netmanager-[0-9a-f]{8}$/;

export const vpnDraftCreateSchema = z.object({
  serverIds: orderedVpnServerIdsSchema,
  protocol: vpnProtocolSchema.default("WIREGUARD"),
  previousDraftId: vpnIdSchema.optional(),
  apiUsername: z.string().regex(API_USERNAME_PATTERN).optional(),
  apiPassword: z.string().regex(API_PASSWORD_PATTERN).optional(),
});
