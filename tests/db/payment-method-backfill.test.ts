import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Payment Duitku dari portal dulu tersimpan dengan paymentMethod OTHER walau
 * gatewayProvider-nya kode kanal (mis. "BC"). Migration billing ini memberi
 * baris lama enum yang sama dengan findBillingPaymentMethod; dijalankan apa
 * adanya terhadap billing_test, dua kali, karena migration data harus aman
 * diulang.
 */

import { prismaBillingAuth } from "@/lib/prisma-billing";
import { findBillingPaymentMethod } from "@/modules/payment-gateway/catalog";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL_BILLING);
const describeDb = hasTestDb ? describe : describe.skip;

const MIGRATION = path.resolve(
  __dirname,
  "../../prisma/billing_migrations/20261101160000_backfill_duitku_payment_method/migration.sql",
);
const PELANGGAN = "pel-pmbf-backfill";

type Method = "CASH" | "BANK_TRANSFER" | "E_WALLET" | "OTHER";

// Kanal Duitku di katalog saat migration ini ditulis, dan enum yang
// seharusnya; ritel tetap OTHER.
const DUITKU_CHANNELS: Record<string, Method> = {
  BC: "BANK_TRANSFER",
  M2: "BANK_TRANSFER",
  BR: "BANK_TRANSFER",
  SP: "E_WALLET",
  DA: "E_WALLET",
  OV: "E_WALLET",
  SA: "E_WALLET",
  LA: "E_WALLET",
  FT: "OTHER",
  IR: "OTHER",
};

function statementsOf(sql: string) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function runMigration() {
  for (const statement of statementsOf(readFileSync(MIGRATION, "utf8"))) {
    await prismaBillingAuth.$executeRawUnsafe(statement);
  }
}

async function createPayment(
  gatewayProvider: string | null,
  paymentMethod: Method,
) {
  const id = `pmbf-${randomUUID()}`;
  await prismaBillingAuth.payment.create({
    data: {
      id,
      pelangganId: PELANGGAN,
      amount: 100000n,
      paymentDate: new Date(),
      paymentMethod,
      gatewayProvider,
      gatewayStatus: "PAID",
      updatedAt: new Date(),
    },
  });
  return id;
}

async function methodOf(id: string) {
  const payment = await prismaBillingAuth.payment.findUniqueOrThrow({
    where: { id },
    select: { paymentMethod: true },
  });
  return payment.paymentMethod;
}

const cleanup = () =>
  prismaBillingAuth.payment.deleteMany({ where: { pelangganId: PELANGGAN } });

it("tabel kanal di tes ini sama dengan findBillingPaymentMethod", () => {
  for (const [code, method] of Object.entries(DUITKU_CHANNELS)) {
    expect([code, findBillingPaymentMethod(code) ?? "OTHER"]).toEqual([
      code,
      method,
    ]);
  }
});

describeDb("backfill enum PaymentMethod payment Duitku (DB nyata)", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("payment OTHER berkode kanal Duitku memperoleh enum katalog", async () => {
    const ids = Object.fromEntries(
      await Promise.all(
        Object.keys(DUITKU_CHANNELS).map(
          async (code) => [code, await createPayment(code, "OTHER")] as const,
        ),
      ),
    );

    await runMigration();

    const methods = Object.fromEntries(
      await Promise.all(
        Object.entries(ids).map(
          async ([code, id]) => [code, await methodOf(id)] as const,
        ),
      ),
    );
    expect(methods).toEqual(DUITKU_CHANNELS);
  });

  it("baris lain tidak disentuh", async () => {
    const untouched = {
      tanpaKanal: await createPayment(null, "OTHER"),
      gatewayLain: await createPayment("MIDTRANS_SNAP", "OTHER"),
      kanalTripay: await createPayment("BRIVA", "OTHER"),
      tunai: await createPayment("BC", "CASH"),
      sudahBenar: await createPayment("SP", "E_WALLET"),
    };

    await runMigration();

    const methods = Object.fromEntries(
      await Promise.all(
        Object.entries(untouched).map(
          async ([label, id]) => [label, await methodOf(id)] as const,
        ),
      ),
    );
    expect(methods).toEqual({
      tanpaKanal: "OTHER",
      gatewayLain: "OTHER",
      kanalTripay: "OTHER",
      tunai: "CASH",
      sudahBenar: "E_WALLET",
    });
  });

  it("aman dijalankan ulang", async () => {
    const va = await createPayment("BC", "OTHER");
    const qris = await createPayment("SP", "OTHER");

    await runMigration();
    await runMigration();

    expect([await methodOf(va), await methodOf(qris)]).toEqual([
      "BANK_TRANSFER",
      "E_WALLET",
    ]);
  });
});
