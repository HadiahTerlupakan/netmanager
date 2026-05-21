import * as z from "zod";

export const acsTaskSchema = z.object({
  taskName: z.string().optional(),
  parameter: z.string().optional(),
  value: z.unknown().optional(),
  type: z.string().optional(),
  connectionRequest: z.boolean().optional(),
});

export const acsWanConfigSchema = z.object({
  username: z.string().min(1, "Username PPPoE wajib diisi"),
  password: z.string().optional(),
});

export type AcsTaskInput = z.infer<typeof acsTaskSchema>;
export type AcsWanConfigInput = z.infer<typeof acsWanConfigSchema>;
