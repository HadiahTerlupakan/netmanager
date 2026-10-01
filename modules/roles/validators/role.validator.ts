import * as z from "zod";
import {
  PERSONA_KARYAWAN,
  PERSONA_KARYAWAN_DEFAULT,
} from "../domain/persona-karyawan";

const personaKaryawanSchema = z.enum(PERSONA_KARYAWAN, {
  error: "Persona tidak valid",
});

/** Schema input pembuatan role (POST /api/roles). */
export const createRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  accessAdminPanel: z.boolean().optional().default(false),
  accessEmployeePanel: z.boolean().optional().default(false),
  isRestricted: z.boolean().optional().default(false),
  isTechnical: z.boolean().optional().default(false),
  persona: personaKaryawanSchema.optional().default(PERSONA_KARYAWAN_DEFAULT),
  isSuperAdmin: z.boolean().optional().default(false),
  canApproveRab: z.boolean().optional().default(false),
  canReceiveWhatsappApproval: z.boolean().optional().default(false),
});

/** Schema input perubahan role (PUT /api/roles/[id]). */
export const updateRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  accessAdminPanel: z.boolean().optional(),
  accessEmployeePanel: z.boolean().optional(),
  isRestricted: z.boolean().optional(),
  isTechnical: z.boolean().optional(),
  persona: personaKaryawanSchema.optional(),
  isSuperAdmin: z.boolean().optional(),
  canApproveRab: z.boolean().optional(),
  canReceiveWhatsappApproval: z.boolean().optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
