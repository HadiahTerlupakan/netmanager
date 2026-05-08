import { z } from "zod";

export const AVAILABLE_WORK_ORDER_STATUS = "PENDING";
export const CLAIMED_WORK_ORDER_STATUS = "IN_PROGRESS";
export const MOBILE_AVAILABLE_WORK_ORDER_LIMIT = 50;
export const MOBILE_CLAIM_ROLE = "PIC";

const MOBILE_MATERIAL_CONDITIONS = ["BARU", "BEKAS", "RUSAK"] as const;

const mobileMaterialItemSchema = z.object({
  barangId: z.string().trim().min(1, "barangId wajib diisi"),
  gudangId: z.string().trim().min(1, "gudangId wajib diisi"),
  jumlah: z.number().refine((value) => Number.isFinite(value), {
    message: "jumlah wajib berupa angka",
  }),
  kondisi: z
    .enum(MOBILE_MATERIAL_CONDITIONS, {
      message: "kondisi tidak valid",
    })
    .optional(),
});

const mobileMaterialPayloadSchema = z.object({
  items: z.array(mobileMaterialItemSchema).min(1, "Items wajib diisi"),
});

export type MobileMaterialItemPayload = z.infer<
  typeof mobileMaterialItemSchema
>;
export type MobileMaterialPayload = z.infer<typeof mobileMaterialPayloadSchema>;

/** Validasi payload material mobile untuk work order. */
export function validateMobileMaterialPayload(
  payload: unknown,
): MobileMaterialPayload {
  return mobileMaterialPayloadSchema.parse(payload);
}
