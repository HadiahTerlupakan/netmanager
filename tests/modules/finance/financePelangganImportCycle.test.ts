import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("finance-pelanggan import cycle", () => {
  it("keeps PelangganService free of top-level AutomaticBillingService imports", () => {
    const source = readSource("modules/pelanggan/services/PelangganService.ts");

    expect(source).not.toMatch(
      /^\s*import\s+\{\s*AutomaticBillingService\s*\}\s+from\s+["']@\/modules\/finance\/services\/AutomaticBillingService["']/m,
    );
  });

  it("keeps PelangganAdminMutationService free of top-level AutomaticBillingService imports", () => {
    const source = readSource(
      "modules/pelanggan/services/PelangganAdminMutationService.ts",
    );

    expect(source).not.toMatch(
      /^\s*import\s+\{\s*AutomaticBillingService\s*\}\s+from\s+["']@\/modules\/finance\/services\/AutomaticBillingService["']/m,
    );
  });

  it("loads AutomaticBillingService without triggering pelanggan barrel cycles", async () => {
    await expect(
      import("@/modules/finance/services/AutomaticBillingService"),
    ).resolves.toHaveProperty("AutomaticBillingService");
  });

  it("loads AutomaticIsolationService without triggering pelanggan barrel cycles", async () => {
    await expect(
      import("@/modules/finance/services/AutomaticIsolationService"),
    ).resolves.toHaveProperty("AutomaticIsolationService");
  });

  it("loads VoidInvoiceService without triggering pelanggan barrel cycles", async () => {
    await expect(
      import("@/modules/finance/services/VoidInvoiceService"),
    ).resolves.toHaveProperty("VoidInvoiceService");
  });
});
