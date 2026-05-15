import * as z from "zod";
import { optionalIdSchema } from "./common";

const employeeTypeEnum = z.enum(["MITRA_TEKNISI", "MITRA_SALES"]);
const withdrawMethodEnum = z.enum(["TRANSFER", "CASH"]);

const dateInputSchema = z.preprocess((val) => {
  if (val === "" || val === null || val === undefined) return undefined;
  if (val instanceof Date) return val;
  return new Date(val as string);
}, z.date().optional());

const optionalString = z.string().trim().min(1).optional().or(z.literal(""));
const optionalPositiveNumber = z.coerce.number().min(0).optional();

const baseMitraShape = {
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.email({ error: "Format email tidak valid" }),
  phone: optionalString,
  employeeType: employeeTypeEnum,
  departmentId: optionalIdSchema,
  siteId: optionalIdSchema,
  roleId: optionalIdSchema,
  mitraRateWoPsb: optionalPositiveNumber,
  mitraRateWoMaintenance: optionalPositiveNumber,
  mitraRateCanvasing: optionalPositiveNumber,
  mitraRateFeePelanggan: optionalPositiveNumber,
  enableFeePelanggan: z.boolean().optional(),
  mixradiusOwnerNames: z.array(z.string()).optional(),
  bankName: optionalString,
  bankAccountNo: optionalString,
  bankAccountName: optionalString,
  targetHarian: optionalPositiveNumber,
  minWithdrawal: optionalPositiveNumber,
  garansiHari: optionalPositiveNumber,
  slaGaransiJam: optionalPositiveNumber,
  penaltyPsb: optionalPositiveNumber,
  penaltyMaintenance: optionalPositiveNumber,
  nik: optionalString,
  tempatLahir: optionalString,
  tanggalLahir: dateInputSchema,
  alamat: optionalString,
  latitudeRumah: z.coerce.number().min(-90).max(90).optional(),
  longitudeRumah: z.coerce.number().min(-180).max(180).optional(),
  fotoDiri: optionalString,
  fotoKtp: optionalString,
  fotoSim: optionalString,
  fotoKk: optionalString,
  requiresFaceVerification: z.boolean().optional(),
  tenantId: optionalIdSchema,
} as const;

/** Schema untuk membuat mitra baru. */
export const createMitraSchema = z.object({
  ...baseMitraShape,
  password: z.string().min(6, "Password minimal 6 karakter"),
});

/** Schema untuk update mitra — semua field optional. */
export const updateMitraSchema = z
  .object({
    ...baseMitraShape,
    name: baseMitraShape.name.optional(),
    email: baseMitraShape.email.optional(),
    employeeType: baseMitraShape.employeeType.optional(),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .optional()
      .or(z.literal("")),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi untuk update",
  });

/** Schema untuk request penarikan. */
export const withdrawRequestSchema = z.object({
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  method: withdrawMethodEnum,
  bankName: optionalString,
  accountNumber: optionalString,
  accountName: optionalString,
  notes: optionalString,
});

/** Schema untuk sinkronisasi komisi mitra. */
export const syncCommissionSchema = z.object({
  mitraId: z.string().min(1, "Mitra ID wajib diisi"),
  amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
  description: z.string().optional(),
  referenceId: z.string().min(1, "Reference ID wajib diisi"),
});

/** Schema untuk reject withdrawal. */
export const rejectWithdrawSchema = z.object({
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

/** Schema untuk adjustment wallet manual (admin). */
export const walletAdjustmentSchema = z.object({
  amount: z.coerce.number().refine((val) => val !== 0, {
    message: "Amount tidak boleh nol",
  }),
  description: z.string().min(1, "Deskripsi wajib diisi"),
});

export type CreateMitraInput = z.infer<typeof createMitraSchema>;
export type UpdateMitraInput = z.infer<typeof updateMitraSchema>;
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;
export type SyncCommissionInput = z.infer<typeof syncCommissionSchema>;
export type RejectWithdrawInput = z.infer<typeof rejectWithdrawSchema>;
export type WalletAdjustmentInput = z.infer<typeof walletAdjustmentSchema>;
