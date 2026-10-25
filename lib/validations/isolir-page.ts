import * as z from "zod";

const MAX_PAYMENTS = 10;
const WHATSAPP_PATTERN = /^[0-9 +-]+$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const HTTP_URL_PATTERN = /^https?:\/\//i;

// Form mengirim "" untuk kolom yang dikosongkan; itu berarti "pakai default".
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((value) => value || null);
}

const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} wajib diisi`)
    .max(max, `Maksimal ${max} karakter`);

const paymentSchema = z.object({
  label: requiredText(60, "Label"),
  number: requiredText(60, "Nomor"),
  holder: requiredText(100, "Atas nama"),
});

/** logoUrl sengaja tidak ada: logo hanya lewat unggahan ke penyimpanan kita. */
export const isolirPageSchema = z.object({
  ispName: optionalText(120),
  title: optionalText(120),
  message: optionalText(2000),
  contactText: optionalText(500),
  whatsappNumber: optionalText(20).refine(
    (value) => value === null || WHATSAPP_PATTERN.test(value),
    "Nomor WhatsApp hanya boleh berisi angka, spasi, + dan -",
  ),
  whatsappText: optionalText(300),
  linkLabel: optionalText(60),
  linkUrl: optionalText(500).refine(
    (value) => value === null || HTTP_URL_PATTERN.test(value),
    "URL harus diawali http:// atau https://",
  ),
  primaryColor: optionalText(7).refine(
    (value) => value === null || HEX_COLOR_PATTERN.test(value),
    "Warna harus berformat #RRGGBB",
  ),
  payments: z.array(paymentSchema).max(MAX_PAYMENTS).optional(),
});

export type IsolirPageBody = z.infer<typeof isolirPageSchema>;
