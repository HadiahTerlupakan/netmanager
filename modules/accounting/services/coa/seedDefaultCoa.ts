import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { ChartOfAccountService } from "./ChartOfAccountService";

/**
 * @deprecated Gunakan ChartOfAccountService.list() yang otomatis menyeed default COA
 * via ensureDefaultCoa(). File ini hanya tetap eksis untuk kompatibilitas
 * skrip prisma/seed-accounting.ts.
 *
 * Sumber kebenaran tunggal untuk DEFAULT_COA ada di:
 *   modules/accounting/services/coa/ChartOfAccountService.ts
 */
export async function seedDefaultCoa(tenantId: string): Promise<void> {
  const service = new ChartOfAccountService(new ChartOfAccountRepository());
  await service.list(tenantId);
}
