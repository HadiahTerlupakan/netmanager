import type {
  IChartOfAccountRepository,
  CoaCreateInput,
  CoaUpdateInput,
} from "../../domain/ports/IChartOfAccountRepository";
import type {
  ChartOfAccount,
  COAType,
} from "../../domain/entities/ChartOfAccount";
import { normalSideForType } from "../../domain/entities/ChartOfAccount";
import { AccountingError } from "../../errors";
import { logger } from "@/lib/logger";

export type ChartOfAccountWithBalance = ChartOfAccount & { balance: number };

const DEFAULT_COA: Omit<CoaCreateInput, "tenantId">[] = [
  // ============ ASET (1-xxx) ============
  {
    code: "1-000",
    name: "Aset",
    type: "ASSET",
    subtype: null,
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "1-100",
    name: "Aset Lancar",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
    parentCode: "1-000",
  },
  {
    code: "1-110",
    name: "Kas",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-120",
    name: "Bank",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-130",
    name: "Kas Kecil",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-150",
    name: "Piutang Karyawan",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-200",
    name: "Piutang Usaha",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-250",
    name: "PPN Masukan",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-280",
    name: "Persediaan Material",
    type: "ASSET",
    subtype: "CURRENT_ASSET",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "1-100",
  },
  {
    code: "1-300",
    name: "Aset Tetap",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
    parentCode: "1-000",
  },
  {
    code: "1-310",
    name: "Peralatan Jaringan (OLT, ODP, ODC, Router)",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },
  {
    code: "1-320",
    name: "Kabel Fiber Optik & Aksesori",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },
  {
    code: "1-330",
    name: "Kendaraan Operasional",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },
  {
    code: "1-340",
    name: "Peralatan Kantor & IT",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },
  {
    code: "1-350",
    name: "Tower & Infrastruktur",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },
  {
    code: "1-390",
    name: "Akumulasi Penyusutan",
    type: "ASSET",
    subtype: "FIXED_ASSET",
    normalSide: "CREDIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "1-300",
  },

  // ============ KEWAJIBAN (2-xxx) ============
  {
    code: "2-000",
    name: "Kewajiban",
    type: "LIABILITY",
    subtype: null,
    normalSide: "CREDIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "2-100",
    name: "Utang Usaha",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-200",
    name: "Utang Pajak",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-300",
    name: "Utang PPN Keluaran",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-350",
    name: "Utang Gaji",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-360",
    name: "Utang BPJS",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-400",
    name: "Utang PPh 21",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-410",
    name: "Utang PPh 23",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-420",
    name: "Utang PPh 4(2)",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-500",
    name: "Utang BHP",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-510",
    name: "Utang USO",
    type: "LIABILITY",
    subtype: "CURRENT_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },
  {
    code: "2-600",
    name: "Utang Investor",
    type: "LIABILITY",
    subtype: "LONG_TERM_LIABILITY",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "2-000",
  },

  // ============ EKUITAS (3-xxx) ============
  {
    code: "3-000",
    name: "Ekuitas",
    type: "EQUITY",
    subtype: null,
    normalSide: "CREDIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "3-100",
    name: "Modal Disetor",
    type: "EQUITY",
    subtype: "CONTRIBUTED_CAPITAL",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "3-000",
  },
  {
    code: "3-200",
    name: "Laba Ditahan",
    type: "EQUITY",
    subtype: "RETAINED_EARNINGS",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "3-000",
  },
  {
    code: "3-300",
    name: "Laba/Rugi Berjalan",
    type: "EQUITY",
    subtype: "RETAINED_EARNINGS",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "3-000",
  },

  // ============ PENDAPATAN (4-xxx) ============
  {
    code: "4-000",
    name: "Pendapatan",
    type: "REVENUE",
    subtype: null,
    normalSide: "CREDIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "4-100",
    name: "Pendapatan Layanan Internet",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "4-000",
  },
  {
    code: "4-200",
    name: "Pendapatan Instalasi & Aktivasi",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "4-000",
  },
  {
    code: "4-300",
    name: "Potongan Penjualan",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "DEBIT",
    isSystem: true,
    parentCode: "4-000",
  },
  {
    code: "4-400",
    name: "Pendapatan Jasa Teknis",
    type: "REVENUE",
    subtype: "OPERATING_REVENUE",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "4-000",
  },
  {
    code: "4-900",
    name: "Pendapatan Lainnya",
    type: "REVENUE",
    subtype: "OTHER_REVENUE",
    normalSide: "CREDIT",
    isSystem: true,
    parentCode: "4-000",
  },

  // ============ BEBAN OPERASIONAL / OPEX (5-xxx) ============
  {
    code: "5-000",
    name: "Beban",
    type: "EXPENSE",
    subtype: null,
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "5-100",
    name: "Beban Gaji & Upah",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-110",
    name: "Beban BPJS & Tunjangan",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-200",
    name: "Beban Bandwidth & Transit",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-210",
    name: "Beban Listrik & Colocation",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-300",
    name: "Beban Sewa (Kantor, Lahan, Tiang)",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-400",
    name: "Beban Penyusutan",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-500",
    name: "Beban Operasional Lainnya",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-510",
    name: "Beban Pemeliharaan Jaringan",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-520",
    name: "Beban Transportasi & BBM",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-600",
    name: "Beban Administrasi & Umum",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-700",
    name: "Beban Pajak & Regulasi",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-710",
    name: "Beban BHP (0.5% Revenue)",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-700",
  },
  {
    code: "5-720",
    name: "Beban USO (1.25% Revenue)",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-700",
  },
  {
    code: "5-800",
    name: "Beban Bagi Hasil Mitra",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },
  {
    code: "5-810",
    name: "Beban Bagi Hasil Investor",
    type: "EXPENSE",
    subtype: "OPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "OPERATING",
    isSystem: true,
    parentCode: "5-000",
  },

  // ============ BEBAN MODAL / CAPEX (6-xxx) ============
  {
    code: "6-000",
    name: "Belanja Modal (CAPEX)",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    isPostable: false,
    isSystem: true,
  },
  {
    code: "6-100",
    name: "Pembelian Peralatan Jaringan",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "6-000",
  },
  {
    code: "6-200",
    name: "Pembangunan Jaringan FO",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "6-000",
  },
  {
    code: "6-300",
    name: "Pembelian Kendaraan",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "6-000",
  },
  {
    code: "6-400",
    name: "Pembelian Peralatan IT & Kantor",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "6-000",
  },
  {
    code: "6-500",
    name: "Pembangunan Tower & Infrastruktur",
    type: "EXPENSE",
    subtype: "CAPEX",
    normalSide: "DEBIT",
    cashFlowCategory: "INVESTING",
    isSystem: true,
    parentCode: "6-000",
  },
] as (Omit<CoaCreateInput, "tenantId"> & { parentCode?: string })[];

export class ChartOfAccountService {
  constructor(private readonly coaRepo: IChartOfAccountRepository) {}

  async create(
    tenantId: string,
    input: Omit<CoaCreateInput, "tenantId" | "normalSide"> & {
      normalSide?: ChartOfAccount["normalSide"];
    },
  ): Promise<ChartOfAccount> {
    const existing = await this.coaRepo.findByCode(tenantId, input.code);
    if (existing) {
      throw new AccountingError(
        `Kode akun ${input.code} sudah digunakan`,
        "COA_CODE_DUPLICATE",
      );
    }

    if (input.parentId) {
      const parent = await this.coaRepo.findById(input.parentId);
      if (!parent) {
        throw new AccountingError(
          "Parent COA tidak ditemukan",
          "COA_PARENT_NOT_FOUND",
        );
      }
    }

    return this.coaRepo.create({
      ...input,
      tenantId,
      normalSide: input.normalSide ?? normalSideForType(input.type),
    });
  }

  async update(id: string, input: CoaUpdateInput): Promise<ChartOfAccount> {
    const coa = await this.coaRepo.findById(id);
    if (!coa) {
      throw new AccountingError("COA tidak ditemukan", "COA_NOT_FOUND");
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new AccountingError(
          "COA tidak bisa jadi parent dirinya sendiri",
          "COA_SELF_PARENT",
        );
      }
    }

    return this.coaRepo.update(id, input);
  }

  async delete(id: string): Promise<void> {
    const coa = await this.coaRepo.findById(id);
    if (!coa) {
      throw new AccountingError("COA tidak ditemukan", "COA_NOT_FOUND");
    }
    if (coa.isSystem) {
      throw new AccountingError(
        "Akun system tidak bisa dihapus",
        "COA_SYSTEM_DELETE",
      );
    }

    const childCount = await this.coaRepo.countChildren(id);
    if (childCount > 0) {
      throw new AccountingError(
        "COA masih punya child accounts",
        "COA_HAS_CHILDREN",
      );
    }

    const lineCount = await this.coaRepo.countLines(id);
    if (lineCount > 0) {
      throw new AccountingError(
        "COA sudah digunakan di jurnal",
        "COA_HAS_LINES",
      );
    }

    await this.coaRepo.delete(id);
  }

  async resetSystemAccounts(tenantId: string): Promise<void> {
    await this.coaRepo.deleteSystemAccounts(tenantId);
  }

  async list(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccount[]> {
    await this.ensureDefaultCoa(tenantId);
    return this.coaRepo.list(tenantId, filter);
  }

  async listWithBalances(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccountWithBalance[]> {
    await this.ensureDefaultCoa(tenantId);
    const items = await this.coaRepo.list(tenantId, filter);
    const balanceRows = await this.coaRepo.getAccountBalances(
      tenantId,
      items.map((i) => i.id),
    );

    const balanceMap = new Map<string, number>();
    for (const row of balanceRows) {
      const current = balanceMap.get(row.coaId) ?? 0;
      if (row.side === "DEBIT") {
        balanceMap.set(row.coaId, current + row.total);
      } else {
        balanceMap.set(row.coaId, current - row.total);
      }
    }

    return items.map((item) => ({
      ...item,
      balance: balanceMap.get(item.id) ?? 0,
    }));
  }

  private async ensureDefaultCoa(tenantId: string): Promise<void> {
    const existing = await this.coaRepo.list(tenantId, {});
    const hasSystemAccounts = existing.some((a) => a.isSystem);
    if (hasSystemAccounts) return;

    logger.info(`[COA] Auto-seeding default COA for tenant ${tenantId}`);

    const codeToId = new Map<string, string>();

    for (const template of DEFAULT_COA as (Omit<CoaCreateInput, "tenantId"> & {
      parentCode?: string;
    })[]) {
      const { parentCode, ...input } = template;
      const parentId = parentCode ? (codeToId.get(parentCode) ?? null) : null;

      const created = await this.coaRepo.create({
        ...input,
        tenantId,
        parentId,
        normalSide:
          input.normalSide ?? normalSideForType(input.type as COAType),
      });
      codeToId.set(input.code, created.id);
    }

    logger.info(
      `[COA] Seeded ${DEFAULT_COA.length} default accounts for tenant ${tenantId}`,
    );
  }

  async findById(id: string): Promise<ChartOfAccount | null> {
    return this.coaRepo.findById(id);
  }

  async findByCode(
    tenantId: string,
    code: string,
  ): Promise<ChartOfAccount | null> {
    return this.coaRepo.findByCode(tenantId, code);
  }
}
