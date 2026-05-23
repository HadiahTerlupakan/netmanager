import { z } from "zod";
import { serialNumberSchema } from "./onu.validator";

export const bulkDisableEnableSchema = z.object({
  onuIds: z
    .array(z.string().min(1))
    .min(1, "Minimal 1 ONU")
    .max(50, "Maksimal 50 ONU per batch"),
});

export const bulkRegisterSchema = z.object({
  items: z
    .array(
      z.object({
        oltId: z.string().min(1),
        serialNumber: serialNumberSchema,
        ponPort: z.coerce.number().int().min(1),
        onuIndex: z.coerce.number().int().min(1).optional(),
      }),
    )
    .min(1, "Minimal 1 item")
    .max(20, "Maksimal 20 per batch"),
});

export type BulkDisableEnableInput = z.infer<typeof bulkDisableEnableSchema>;
export type BulkRegisterInput = z.infer<typeof bulkRegisterSchema>;
