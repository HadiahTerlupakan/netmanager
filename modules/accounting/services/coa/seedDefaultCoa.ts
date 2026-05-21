import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import type {
  COAType,
  COASubtype,
  CashFlowCategory,
} from "../../domain/entities/ChartOfAccount";

interface DefaultCoa {
  code: string;
  name: string;
  type: COAType;
  subtype: COASubtype | null;
  normalSide: "DEBIT" | "CREDIT";
  cashFlowCategory: CashFlowCategory | null;
  isSystem: boolean;
  isPostable: boolean;
}

const DEFAULT_COA: DefaultCoa[] = [
  {
    code: "1-100",
    name: "Kas",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "1-110",
    name: "Bank",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: false,
  },
  {
    code: "1-200",
    name: "Piutang Usaha",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "1-300",
    name: "Persediaan",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "1-400",
    name: "Aset Tetap",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "1-410",
    name: "Akumulasi Penyusutan",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "CREDIT",
    cashFlowCategory: null,
    isSystem: false,
    isPostable: true,
  },
  {
    code: "2-100",
    name: "Utang Usaha",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "2-200",
    name: "Utang Pajak",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "3-100",
    name: "Modal Disetor",
    type: "EQUITY",
    subtype: "CONTRIBUTED_CAPITAL",
    normalSide: "CREDIT",
    cashFlowCategory: "FINANCING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "3-200",
    name: "Laba Ditahan",
    type: "EQUITY",
    subtype: "RETAINED_EARNINGS",
    normalSide: "CREDIT",
    cashFlowCategory: null,
    isSystem: true,
    isPostable: true,
  },
  {
    code: "3-300",
    name: "Laba/Rugi Berjalan",
    type: "EQUITY",
    subtype: "RETAINED_EARNINGS",
    normalSide: "CREDIT",
    cashFlowCategory: null,
    isSystem: true,
    isPostable: true,
  },
  {
    code: "4-100",
    name: "Pendapatan Layanan PPP",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "CREDIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "4-200",
    name: "Pendapatan Lain-lain",
    type: "REVENUE",
    subtype: "OTHER_REVENUE",
    normalSide: "CREDIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "4-300",
    name: "Potongan Penjualan",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
  {
    code: "5-100",
    name: "Beban Bandwidth",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "5-200",
    name: "Beban Gaji",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "5-300",
    name: "Beban Operasional",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: false,
    isPostable: true,
  },
  {
    code: "5-400",
    name: "Beban Penyusutan",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: null,
    isSystem: false,
    isPostable: true,
  },
  {
    code: "5-500",
    name: "Beban Lain-lain",
    type: "EXPENSE",
    subtype: "OTHER_EXPENSE",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    isPostable: true,
  },
];

export async function seedDefaultCoa(tenantId: string): Promise<void> {
  const repo = new ChartOfAccountRepository();

  for (const coa of DEFAULT_COA) {
    const existing = await repo.findByCode(tenantId, coa.code);
    if (existing) continue;

    await repo.create({
      tenantId,
      code: coa.code,
      name: coa.name,
      type: coa.type,
      subtype: coa.subtype,
      normalSide: coa.normalSide,
      cashFlowCategory: coa.cashFlowCategory,
      isPostable: coa.isPostable,
      isSystem: coa.isSystem,
    });
  }
}
