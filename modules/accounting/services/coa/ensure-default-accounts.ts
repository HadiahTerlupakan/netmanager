import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { COAType } from "../../domain/entities/ChartOfAccount";
import { normalSideForType } from "../../domain/entities/ChartOfAccount";
import { AccountingError, CoaNotFoundError } from "../../errors";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import { logger } from "@/lib/logger";
import { DEFAULT_COA } from "./default-coa";

/**
 * Pastikan akun default `codes` ada di COA tenant, dibuat dari template
 * DEFAULT_COA bila belum ada.
 *
 * Tenant lama di-seed sebelum akun itu masuk DEFAULT_COA, dan seed otomatis
 * (`ensureDefaultCoa`) hanya berjalan bila tenant belum punya akun sistem sama
 * sekali, jadi akun baru tidak pernah ikut terbentuk. Akun induknya harus sudah
 * ada; COA yang belum di-seed sama sekali tetap melempar CoaNotFoundError,
 * sama dengan handler jurnal lain yang melewati tenant tanpa COA.
 *
 * Dua job yang berlomba membuat akun yang sama: yang kalah mendapat unique
 * violation (tenantId, code) dan membaca ulang akun pemenangnya.
 */
export async function ensureDefaultAccounts(
  coaRepo: IChartOfAccountRepository,
  tenantId: string,
  codes: readonly string[],
): Promise<void> {
  for (const code of codes) {
    if (await coaRepo.findByCode(tenantId, code)) continue;
    await createFromTemplate(coaRepo, tenantId, code);
  }
}

async function createFromTemplate(
  coaRepo: IChartOfAccountRepository,
  tenantId: string,
  code: string,
): Promise<void> {
  const template = DEFAULT_COA.find((entry) => entry.code === code);
  if (!template) {
    throw new AccountingError(
      `Akun ${code} tidak ada di COA default`,
      "COA_TEMPLATE_NOT_FOUND",
    );
  }
  const { parentCode, ...input } = template;
  const parent = parentCode
    ? await coaRepo.findByCode(tenantId, parentCode)
    : null;
  if (parentCode && !parent) throw new CoaNotFoundError(parentCode);

  try {
    await coaRepo.create({
      ...input,
      tenantId,
      parentId: parent?.id ?? null,
      normalSide: input.normalSide ?? normalSideForType(input.type as COAType),
    });
    logger.info(`[COA] Akun ${code} ditambahkan untuk tenant ${tenantId}`);
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
  }
}
