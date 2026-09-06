import * as z from "zod";
import {
  Status,
  TipePelanggan,
  DiscountType,
  DurasiUnit,
} from "@prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Helper for parsing boolean from FormData/string
const booleanString = z.union([z.boolean(), z.string()]).transform((val) => {
  if (typeof val === "boolean") return val;
  return val === "true" || val === "on" || val === "1";
});

// Helper for parsing number from FormData/string
const numberString = z
  .union([z.number(), z.string(), z.null()])
  .transform((val) => {
    if (val === null || val === "") return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  });

/**
 * Nilai rupiah untuk kolom bertipe `Int` di Prisma.
 *
 * `numberString` meneruskan pecahan apa adanya, sementara `biayaInstalasi`,
 * `biayaSewaPerangkat`, `biayaLainnya`, dan `discountDuration` adalah `Int?`.
 * Masukan seperti 150000,5 lolos validasi lalu ditolak Prisma sebagai
 * `PrismaClientValidationError` — error yang selama ini tersamar jadi "Gagal
 * memproses upload file". Dibulatkan di sini karena rupiah tidak punya pecahan
 * yang bermakna pada kolom ini.
 */
const integerNumberString = numberString.transform((val) =>
  val === null ? null : Math.round(val),
);

export const createPelangganSchema = z.object({
  idPelanggan: z
    .string()
    .length(8, "ID Pelanggan harus 8 digit")
    .regex(/^\d+$/, "ID Pelanggan harus angka"),
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .regex(
      /^[a-zA-Z0-9_\-\.]+$/,
      "Username hanya boleh huruf, angka, dot, dash, underscore",
    ),
  password: z.string().min(1, "Password PPPoE wajib diisi"),
  passwordLogin: z.string().min(6, "Password login minimal 6 karakter"),
  hargaPaketId: z.string().min(1, "Paket layanan wajib dipilih"),
  tipe: z.enum(TipePelanggan).default(TipePelanggan.REGULER),

  // Dates need to be strings "YYYY-MM-DD"
  tanggalAktif: z.string().regex(dateRegex, "Format tanggal harus YYYY-MM-DD"),
  jatuhTempo: z.string().regex(dateRegex, "Format tanggal harus YYYY-MM-DD"),

  status: z.enum(Status).default(Status.AKTIF),
  autoIsolir: booleanString.default(true),

  // Optional contact/address info
  alamat: z.string().optional().nullable(),
  provinsi: z.string().optional().nullable(),
  kabupatenKota: z.string().optional().nullable(),
  kelurahanDesa: z.string().optional().nullable(),
  kecamatan: z.string().optional().nullable(),
  noTelp: z.string().optional().nullable(),
  email: z
    .union([z.email({ error: "Email tidak valid" }), z.literal("")])
    .optional()
    .nullable(),

  // Geo
  latitude: numberString.optional().nullable(),
  longitude: numberString.optional().nullable(),

  // Docs
  jenisDokumen: z.string().optional().nullable(),
  noDokumen: z.string().optional().nullable(),

  // Billing Config
  usePPN: booleanString.default(true),
  useDiscount: booleanString.default(false),
  useProrate: booleanString.default(false),
  catatan: z.string().optional().nullable(),

  // Discounts
  discountType: z.enum(DiscountType).optional().nullable(),
  discountValue: numberString.optional().nullable(),
  discountDuration: integerNumberString.optional().nullable(),
  discountDurationUnit: z.enum(DurasiUnit).optional().nullable(),

  // One time fees
  biayaInstalasi: integerNumberString.optional().nullable(),
  biayaInstalasiIsRecurring: booleanString.default(false),
  biayaInstalasiDiskon: numberString.optional().nullable(),

  biayaSewaPerangkat: integerNumberString.optional().nullable(),
  biayaSewaPerangkatIsRecurring: booleanString.default(true),
  biayaSewaPerangkatDiskon: numberString.optional().nullable(),

  biayaLainnya: integerNumberString.optional().nullable(),
  biayaLainnyaIsRecurring: booleanString.default(false),
  biayaLainnyaDiskon: numberString.optional().nullable(),
  keteranganBiayaLainnya: z.string().optional().nullable(),

  // Infrastructure
  odpId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  resellerId: z.string().optional().nullable(),
  resellerOutletId: z.string().optional().nullable(),

  // Billing Action
  billingAction: z
    .enum(["CREATE_PAID_INVOICE", "CREATE_UNPAID_INVOICE", "DO_NOTHING"])
    .default("DO_NOTHING"),
});

export type CreatePelangganSchema = z.infer<typeof createPelangganSchema>;

/**
 * Field profil, dokumen, dan biaya yang boleh diubah lewat halaman edit.
 *
 * Sebelumnya PUT `/api/pelanggan-ppp/{id}` membaca FormData secara manual dan
 * hanya mengenal 17 key. Semua field di bawah ini dikirim form edit tetapi
 * dibuang diam-diam di server: admin mengubah alamat, koordinat, atau rincian
 * biaya, menerima "Data pelanggan berhasil diperbarui", lalu menemukan datanya
 * tidak berubah.
 *
 * Semuanya opsional: yang tidak dikirim berarti tidak diubah.
 */
export const updatePelangganProfileSchema = z.object({
  alamat: z.string().optional().nullable(),
  provinsi: z.string().optional().nullable(),
  kabupatenKota: z.string().optional().nullable(),
  kelurahanDesa: z.string().optional().nullable(),
  kecamatan: z.string().optional().nullable(),
  noTelp: z.string().optional().nullable(),
  latitude: numberString.optional().nullable(),
  longitude: numberString.optional().nullable(),
  jenisDokumen: z.string().optional().nullable(),
  noDokumen: z.string().optional().nullable(),
  catatan: z.string().optional().nullable(),

  usePPN: booleanString.optional(),
  useDiscount: booleanString.optional(),
  useProrate: booleanString.optional(),
  discountType: z.enum(DiscountType).optional().nullable(),
  discountValue: numberString.optional().nullable(),
  discountDuration: integerNumberString.optional().nullable(),
  discountDurationUnit: z.enum(DurasiUnit).optional().nullable(),

  biayaInstalasi: integerNumberString.optional().nullable(),
  biayaInstalasiIsRecurring: booleanString.optional(),
  biayaInstalasiDiskon: numberString.optional().nullable(),
  biayaSewaPerangkat: integerNumberString.optional().nullable(),
  biayaSewaPerangkatIsRecurring: booleanString.optional(),
  biayaSewaPerangkatDiskon: numberString.optional().nullable(),
  biayaLainnya: integerNumberString.optional().nullable(),
  biayaLainnyaIsRecurring: booleanString.optional(),
  biayaLainnyaDiskon: numberString.optional().nullable(),
  keteranganBiayaLainnya: z.string().optional().nullable(),
});

export type UpdatePelangganProfileInput = z.infer<
  typeof updatePelangganProfileSchema
>;
