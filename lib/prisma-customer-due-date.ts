import { Prisma } from "@prisma/client";
import { toStartOfDay } from "./utils/datetime";

type DateInput = Date | string;
type DueDateField = DateInput | { set?: DateInput | null } | null | undefined;

function startOfDay(value: DateInput, timezone: string) {
  return toStartOfDay(value, timezone);
}

function normalizeField(value: DueDateField, timezone: string): DueDateField {
  if (value instanceof Date || typeof value === "string") {
    return startOfDay(value, timezone);
  }
  if (value && typeof value === "object" && value.set) {
    return { ...value, set: startOfDay(value.set, timezone) };
  }
  return value;
}

/** Bulatkan `jatuhTempo` pada data tulis Prisma (objek atau array) ke awal hari. */
export function normalizeCustomerDueDateData(data: unknown, timezone: string) {
  if (!data || typeof data !== "object") return;
  for (const item of Array.isArray(data) ? data : [data]) {
    const record = item as { jatuhTempo?: DueDateField };
    if ("jatuhTempo" in record) {
      record.jatuhTempo = normalizeField(record.jatuhTempo, timezone);
    }
  }
}

// get-timezone mengimpor lib/prisma; impor statis di sini membentuk siklus.
async function currentTimezone() {
  const { getTimezoneSync } = await import("./utils/get-timezone");
  return getTimezoneSync();
}

/**
 * Jatuh tempo pelanggan adalah tanggal: setiap penulisan dibulatkan ke awal
 * hari zona waktu tenant, apa pun jalurnya (admin, registrasi, pelunasan,
 * perpanjangan). Dulu tagihan yang dibuat dengan `new Date()` membawa jam
 * pembuatannya ke jatuh tempo pelanggan saat dilunasi.
 */
export const normalizeCustomerDueDates = Prisma.defineExtension({
  name: "normalize-customer-due-dates",
  query: {
    pelanggan: {
      async create({ args, query }) {
        normalizeCustomerDueDateData(args.data, await currentTimezone());
        return query(args);
      },
      async createMany({ args, query }) {
        normalizeCustomerDueDateData(args.data, await currentTimezone());
        return query(args);
      },
      async update({ args, query }) {
        normalizeCustomerDueDateData(args.data, await currentTimezone());
        return query(args);
      },
      async updateMany({ args, query }) {
        normalizeCustomerDueDateData(args.data, await currentTimezone());
        return query(args);
      },
      async upsert({ args, query }) {
        const timezone = await currentTimezone();
        normalizeCustomerDueDateData(args.create, timezone);
        normalizeCustomerDueDateData(args.update, timezone);
        return query(args);
      },
    },
  },
});
