import { z } from "zod";

export const createVlanConfigSchema = z.object({
  oltId: z.string().min(1, "oltId wajib diisi"),
  ponPort: z.coerce.number().int().min(1).optional(),
  vlanId: z.coerce.number().int().min(1).max(4094, "VLAN ID maksimal 4094"),
  vlanName: z.string().max(50).optional(),
  purpose: z.enum(["INTERNET", "IPTV", "VOIP", "MANAGEMENT"]).optional(),
});

export type CreateVlanConfigInput = z.infer<typeof createVlanConfigSchema>;
