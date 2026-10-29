import { z } from "zod";
import { monthsInRange, packageGross } from "../domain/money";
import type { SampleGenerateInput, SampleStreet } from "../domain/types";
import type { SampleInvoiceLimits } from "../services/sample-invoice-limits";

const MIN_STREETS = 5;
const MAX_STREETS = 2000;
const MAX_ADDONS = 10;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const text = (max: number) => z.string().trim().max(max);
const day = z.number().int().min(1).max(28);

const schema = z.object({
  mitraId: text(100).min(1, "Pilih mitra"),
  mitraName: text(200).min(1, "Pilih mitra"),
  issuer: z.object({
    name: text(200).min(1, "Nama perusahaan wajib diisi"),
    address: text(500),
    phone: text(50),
  }),
  packages: z
    .array(
      z
        .object({
          name: text(100).min(1, "Nama paket wajib diisi"),
          speed: text(50),
          price: z
            .number()
            .int("Harga paket harus bilangan bulat")
            .positive("Harga paket harus lebih dari 0"),
          addons: z
            .array(
              z.object({
                name: text(100).min(1, "Nama add-on wajib diisi"),
                price: z
                  .number()
                  .int("Harga add-on harus bilangan bulat")
                  .positive("Harga add-on harus lebih dari 0"),
              }),
            )
            .max(MAX_ADDONS, `Maksimal ${MAX_ADDONS} add-on per paket`)
            .optional(),
          discount: z
            .object({
              name: text(100).min(1, "Nama diskon wajib diisi"),
              kind: z.enum(["amount", "percent"]),
              value: z
                .number()
                .int("Nilai diskon harus bilangan bulat")
                .positive("Nilai diskon harus lebih dari 0"),
            })
            .optional(),
        })
        .refine(
          (pkg) =>
            !pkg.discount ||
            (pkg.discount.kind === "percent"
              ? pkg.discount.value < 100
              : pkg.discount.value < packageGross(pkg)),
          "Diskon harus lebih kecil dari harga paket + add-on",
        ),
    )
    .min(1, "Tambahkan minimal satu paket"),
  customerCount: z.number().int().min(1, "Jumlah pelanggan minimal 1"),
  fromMonth: z.string().regex(MONTH, "Bulan awal tidak valid"),
  toMonth: z.string().regex(MONTH, "Bulan akhir tidak valid"),
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  radiusM: z
    .number()
    .min(200, "Radius minimal 200 m")
    .max(10000, "Radius maksimal 10 km"),
  dueDay: day,
  payDate: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("random") }),
    z.object({ mode: z.literal("fixed"), day }),
  ]),
  ppn: z.enum(["none", "inclusive", "exclusive"]),
  streets: z.array(z.unknown()),
});

const optionalText = (value: unknown) => {
  const cleaned =
    typeof value === "string" ? value.replace(/[<>]/g, "").trim() : "";
  return cleaned ? cleaned.slice(0, 120) : undefined;
};

/** Daftar jalan datang dari browser, jadi dibersihkan di sini, bukan dipercaya. */
function cleanStreets(raw: unknown[]): SampleStreet[] {
  const seen = new Set<string>();
  const streets: SampleStreet[] = [];
  for (const item of raw) {
    if (streets.length >= MAX_STREETS) break;
    const record = (item ?? {}) as Record<string, unknown>;
    const name = optionalText(record.name);
    if (!name) continue;
    const street = {
      name,
      village: optionalText(record.village),
      district: optionalText(record.district),
      city: optionalText(record.city),
    };
    const key = `${name}|${street.village ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    streets.push(street);
  }
  return streets;
}

const number = (value: number) => value.toLocaleString("id-ID");

function checkRange(
  input: z.infer<typeof schema>,
  limits: SampleInvoiceLimits,
  today: string,
): string | null {
  const currentMonth = today.slice(0, 7);
  if (input.toMonth > currentMonth) {
    return "Bulan akhir tidak boleh melewati bulan berjalan";
  }
  if (input.fromMonth > input.toMonth) {
    return "Bulan awal harus sebelum atau sama dengan bulan akhir";
  }
  const months = monthsInRange(input.fromMonth, input.toMonth).length;
  if (input.customerCount > limits.maxCustomers) {
    return `Jumlah pelanggan ${number(input.customerCount)} melewati batas ${number(limits.maxCustomers)}`;
  }
  if (months > limits.maxMonths) {
    return `Rentang ${number(months)} bulan melewati batas ${number(limits.maxMonths)} bulan`;
  }
  const pdfs = input.customerCount * months;
  if (pdfs > limits.maxPdfs) {
    return `Jumlah PDF ${number(pdfs)} melewati batas ${number(limits.maxPdfs)}`;
  }
  const todayDay = Number(today.slice(8, 10));
  if (
    input.payDate.mode === "fixed" &&
    input.toMonth === currentMonth &&
    input.payDate.day > todayDay
  ) {
    return `Tanggal bayar ${input.payDate.day} bulan ini belum lewat; pilih tanggal ${todayDay} atau sebelumnya`;
  }
  return null;
}

export function parseGenerateInput(
  raw: unknown,
  limits: SampleInvoiceLimits,
  /** "YYYY-MM-DD" menurut WIB */
  today: string,
): { ok: true; input: SampleGenerateInput } | { ok: false; message: string } {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Isian tidak valid",
    };
  }
  const rangeError = checkRange(parsed.data, limits, today);
  if (rangeError) return { ok: false, message: rangeError };

  const streets = cleanStreets(parsed.data.streets);
  if (streets.length < MIN_STREETS) {
    return {
      ok: false,
      message: `Hanya ${streets.length} jalan bernama ditemukan; perbesar radius (minimal ${MIN_STREETS} jalan)`,
    };
  }
  // Skema di atas sudah memastikan bentuknya; zod tidak menyempitkan tipe
  // payDate tanpa strictNullChecks.
  return {
    ok: true,
    input: { ...parsed.data, streets } as SampleGenerateInput,
  };
}
