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

export type ChartOfAccountWithBalance = ChartOfAccount & { balance: number };

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

  async list(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccount[]> {
    return this.coaRepo.list(tenantId, filter);
  }

  async listWithBalances(
    tenantId: string,
    filter?: { type?: COAType; isActive?: boolean },
  ): Promise<ChartOfAccountWithBalance[]> {
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
