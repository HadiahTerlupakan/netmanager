import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Produksi dibangun dari prisma/billing_migrations, sedangkan lingkungan
 * lokal sering dari `prisma db push`. WebhookEvent dan unik
 * (provider, tenantId) PaymentGatewayConfig hanya ada di skema: lokal hijau,
 * produksi gagal di setiap webhook dan setiap penyimpanan konfigurasi
 * gateway. Tes ini menjaga setiap model dan unik di skema punya migrasinya.
 */
const ROOT = path.resolve(__dirname, "../..");
const schema = readFileSync(path.join(ROOT, "prisma/billing.prisma"), "utf8");
const migrationsDir = path.join(ROOT, "prisma/billing_migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => !name.endsWith(".toml"))
  .map((name) =>
    readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"),
  )
  .join("\n");

const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(
  ([, name, body]) => ({ name, body }),
);

function uniqueIndexNames(model: { name: string; body: string }) {
  const composite = [...model.body.matchAll(/@@unique\(\[([^\]]+)\]/g)].map(
    ([, cols]) =>
      `${model.name}_${cols
        .split(",")
        .map((c) => c.trim())
        .join("_")}_key`,
  );
  const single = [...model.body.matchAll(/^\s+(\w+)\s+\S+[^\n]*@unique/gm)].map(
    ([, col]) => `${model.name}_${col}_key`,
  );
  return [...composite, ...single];
}

describe("migrasi billing mencakup skema", () => {
  it.each(models.map((m) => [m.name]))("tabel %s dibuat migrasi", (name) => {
    expect(migrations).toMatch(
      new RegExp(`CREATE TABLE (IF NOT EXISTS )?"${name}"`),
    );
  });

  it.each(models.flatMap((m) => uniqueIndexNames(m).map((i) => [i])))(
    "unik %s dibuat migrasi",
    (indexName) => {
      expect(migrations).toContain(`"${indexName}"`);
    },
  );
});
