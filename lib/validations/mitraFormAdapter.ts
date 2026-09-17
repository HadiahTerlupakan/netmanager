/**
 * RHF-friendly adapter schema for the Mitra admin form.
 *
 * Derives from `lib/validations/mitra.ts` but keeps all values as strings
 * (matching `MitraFormState`) so React Hook Form manages string inputs and
 * `mitraFormPayload.ts` builders handle the string → API payload coercion.
 *
 * `z.infer` of both schemas yields a type structurally identical to
 * `MitraFormState`, so `useForm<MitraFormState>` type-checks cleanly.
 */
import * as z from "zod";

const employeeTypeEnum = z.enum(["MITRA_TEKNISI", "MITRA_SALES"]);

/** Optional text field: accepts any string including empty. */
const optionalTextField = z.string();

/** Optional numeric string: must parse as non-negative number if non-empty. */
const optionalNumberField = z
  .string()
  .refine(
    (val) => val === "" || (!Number.isNaN(Number(val)) && Number(val) >= 0),
    { message: "Nilai harus angka ≥ 0" },
  );

/** Optional coordinate string: must parse as number within range if non-empty. */
const optionalCoordField = (min: number, max: number) =>
  z
    .string()
    .refine(
      (val) =>
        val === "" ||
        (!Number.isNaN(Number(val)) &&
          Number(val) >= min &&
          Number(val) <= max),
      { message: `Nilai harus antara ${min} dan ${max}` },
    );

/** Optional date string: must be valid date if non-empty. */
const optionalDateField = z
  .string()
  .refine((val) => val === "" || !Number.isNaN(Date.parse(val)), {
    message: "Format tanggal tidak valid",
  });

const baseFormShape = {
  name: z.string().trim().min(1, "Nama wajib diisi"),
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string(),
  phone: optionalTextField,
  employeeType: employeeTypeEnum,
  siteId: optionalTextField,
  mitraRateWoPsb: optionalNumberField,
  mitraRateWoMaintenance: optionalNumberField,
  mitraRateCanvasing: optionalNumberField,
  bankName: optionalTextField,
  bankAccountNo: optionalTextField,
  bankAccountName: optionalTextField,
  targetHarian: optionalNumberField,
  minWithdrawal: optionalNumberField,
  garansiHari: optionalNumberField,
  slaGaransiJam: optionalNumberField,
  penaltyPsb: optionalNumberField,
  penaltyMaintenance: optionalNumberField,
  nik: optionalTextField,
  tempatLahir: optionalTextField,
  tanggalLahir: optionalDateField,
  alamat: optionalTextField,
  latitudeRumah: optionalCoordField(-90, 90),
  longitudeRumah: optionalCoordField(-180, 180),
  fotoDiri: optionalTextField,
  fotoKtp: optionalTextField,
  fotoSim: optionalTextField,
  fotoKk: optionalTextField,
} as const;

/** Form schema for add — name/email/password required, password ≥6 chars. */
export const mitraAddFormSchema = z.object({
  ...baseFormShape,
  password: z.string().min(6, "Password minimal 6 karakter"),
});

/** Form schema for edit — name/email/password optional (empty = don't change). */
export const mitraEditFormSchema = z.object({
  ...baseFormShape,
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

export type MitraAddFormValues = z.infer<typeof mitraAddFormSchema>;
export type MitraEditFormValues = z.infer<typeof mitraEditFormSchema>;
