import { prismaMitraAuth, prismaMitra } from "../lib/prisma-mitra";
import { compare } from "bcryptjs";
import { logger } from "../lib/logger";

async function verifyMitra() {
  logger.info("--- MITRA MULTI-TENANT AUDIT ---");

  // 1. Check a known Mitra (from previous logs or database)
  const mitras = await prismaMitraAuth.mitra.findMany({ take: 1 });
  if (mitras.length === 0) {
    logger.info("No Mitra found in database. Please seed some data first.");
    return;
  }

  const testMitra = mitras[0];
  logger.info(
    `Testing Mitra: ${testMitra.email} (Tenant: ${testMitra.tenantId})`,
  );

  // 2. Test Login Logic (Non-isolated)
  const foundMitra = await prismaMitraAuth.mitra.findFirst({
    where: { email: { equals: testMitra.email, mode: "insensitive" } },
  });
  logger.info(`Login Lookup Result: ${foundMitra ? "FOUND" : "NOT FOUND"}`);

  // 3. Test Dashboard Data (Isolated)
  // We need to mock the tenant context. Since we are running in a script,
  // we can use the IS_CUSTOM_SERVER trick or set manual headers if possible.
  // Actually, the easiest way to test isolation is to see if it filters correctly
  // when a tenantId IS present in the context.

  // Set global context for script
  (globalThis as any).IS_CUSTOM_SERVER = false; // Simulate request

  logger.info("\n--- Testing Isolation ---");
  try {
    // This should normally fail or return nothing if no context is found
    // because effectiveTenantId will be '___MISSING_TENANT_ID___'
    const result = await prismaMitra.mitra.findUnique({
      where: { id: testMitra.id },
    });
    logger.info(
      `Lookup with NO context: ${result ? "FOUND (LEAK!)" : "NOT FOUND (SAFE/EXPECTED)"}`,
    );
  } catch (err: any) {
    logger.info(`Lookup with NO context errored: ${err.message}`);
  }

  // To truly test isolation in a script, we'd need to mock next/headers
  // which is hard. But we can see if findUnique is causing issues.
}

verifyMitra().catch(logger.error);
