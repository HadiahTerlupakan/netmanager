import { z } from "zod";
import { paymentSchema } from "@/lib/validations/payment";

const PANJANG_REFERENSI_MAKS = 100;
const PANJANG_CATATAN_MAKS = 1000;

/** Body `POST /api/pelanggan-ppp/[id]/renew`. */
export const renewPelangganSchema = z.object({
  statusBayar: z.enum(["LUNAS", "BELUM_LUNAS"]),
  paymentMethod: paymentSchema.shape.paymentMethod,
  reference: z.string().trim().max(PANJANG_REFERENSI_MAKS).optional(),
  notes: z.string().trim().max(PANJANG_CATATAN_MAKS).optional(),
});

export type RenewPelangganInput = z.infer<typeof renewPelangganSchema>;
