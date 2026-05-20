import type { ChartOfAccount as PrismaCoa } from "@prisma/client";
import type { ChartOfAccount } from "../domain/entities/ChartOfAccount";

export function toChartOfAccount(row: PrismaCoa): ChartOfAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype,
    normalSide: row.normalSide,
    cashFlowCategory: row.cashFlowCategory,
    parentId: row.parentId,
    isPostable: row.isPostable,
    isSystem: row.isSystem,
    isActive: row.isActive,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
