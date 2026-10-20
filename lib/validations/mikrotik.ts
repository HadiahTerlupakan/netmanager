import * as z from 'zod'
import { vpnIdSchema } from './vpn'

// Script VPN membuka API RouterOS pada port bawaan ini, jadi mode VPN tidak bisa memakai port lain.
const VPN_API_PORT = 8728

const mikrotikRouterCreateBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nama Router wajib diisi'),
  ipAddress: z.string().trim().min(1, 'IP Router wajib diisi'),
  timezone: z.string().trim().optional(),
  apiPort: z.number().int().min(1).max(65535).optional(),
  apiUsername: z.string().trim().min(1, 'Username API wajib diisi'),
  apiPassword: z.string().min(1, 'Password API wajib diisi'),
  authPort: z.number().int().min(1).max(65535).optional(),
  accountingPort: z.number().int().min(1).max(65535).optional(),
  secretRadius: z.string().trim().optional(),
  isolirUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  siteId: z.string().optional().nullable(),
  rosVersion: z.enum(['V6', 'V7']).optional(),
  connectionMode: z.enum(['PUBLIC', 'VPN']).optional(),
  vpnServerIds: z
    .array(vpnIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, 'Server VPN harus unik')
    .optional(),
  vpnDraftId: vpnIdSchema.optional(),
})

type MikrotikRouterCreateInput = z.infer<typeof mikrotikRouterCreateBaseSchema>

function addVpnModeIssues(data: MikrotikRouterCreateInput, ctx: z.RefinementCtx) {
  if (data.connectionMode !== 'VPN') return
  const addIssue = (field: keyof MikrotikRouterCreateInput, message: string) =>
    ctx.addIssue({ code: 'custom', path: [field], message })

  if (data.rosVersion !== 'V7') addIssue('rosVersion', 'Mode VPN memerlukan RouterOS v7')
  if (!data.vpnServerIds?.length) addIssue('vpnServerIds', 'Pilih minimal satu server VPN')
  if (!data.vpnDraftId) addIssue('vpnDraftId', 'Draft VPN wajib diisi')
  if (data.apiPort !== undefined && data.apiPort !== VPN_API_PORT) {
    addIssue('apiPort', `Port API mode VPN harus ${VPN_API_PORT}`)
  }
}

export const mikrotikRouterCreateSchema =
  mikrotikRouterCreateBaseSchema.superRefine(addVpnModeIssues)

export const mikrotikRouterUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  ipAddress: z.string().trim().min(1).optional(),
  timezone: z.string().trim().optional(),
  apiPort: z.number().int().min(1).max(65535).optional(),
  apiUsername: z.string().trim().min(1).optional(),
  apiPassword: z.string().optional(),
  authPort: z.number().int().min(1).max(65535).optional(),
  accountingPort: z.number().int().min(1).max(65535).optional(),
  secretRadius: z.string().trim().min(1).optional(),
  isolirUrl: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  siteId: z.string().optional().nullable(),
  rosVersion: z.enum(['V6', 'V7']).optional(),
})

