import { TenantContextError } from "@/lib/prisma-extension";

/**
 * Tolak query tanpa tenant sebelum sampai ke database.
 *
 * `tenantId` kosong di `where` berarti "tanpa syarat" bagi Prisma, dan
 * ekstensi tenant tidak menyaring apa pun untuk super admin
 * (`lib/prisma-extension.ts`). Pola sama dengan `SalesRepository`.
 */
export function pastikanTenantTerisi(
  tenantId: string,
  keterangan: string,
): void {
  if (tenantId) return;
  throw new TenantContextError(
    "missing-context",
    `${keterangan} diminta tanpa tenantId`,
  );
}
