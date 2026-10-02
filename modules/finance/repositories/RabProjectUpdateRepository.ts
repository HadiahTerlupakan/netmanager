import type {
  PrismaClient,
  RabDisbursement,
  RabItem,
  RabProject,
  RabWbs,
} from "@prisma/client";
import type { RabProjectUpdateInput } from "./rabProject.types";
import {
  buildInvestmentContext,
  buildInvestorCreateRows,
  buildItemCreateData,
  buildProjectFindQuery,
  buildProjectUpdateQuery,
  buildUpdatedProjectQuery,
  createDisbursementRows,
  getInvestmentItems,
  hasInvestorFundingBaseChange,
} from "./rabProject.update-helpers";
import { splitInvestmentBase } from "./shared/rabInvestmentCalculator";

/** Proyek sudah punya bagi hasil investor; investor & modalnya tidak boleh berubah. */
export class ModalInvestorTerkunciError extends Error {
  constructor() {
    super(
      "Proyek ini sudah punya bagi hasil investor. Daftar investor dan modalnya tidak bisa diubah lagi.",
    );
    this.name = "ModalInvestorTerkunciError";
  }
}

function isHimpunanSama(kiri: readonly string[], kanan: readonly string[]): boolean {
  const a = new Set(kiri);
  const b = new Set(kanan);
  return a.size === b.size && [...a].every((id) => b.has(id));
}

type RabProjectTransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

type UpdatedRabProject =
  | (RabProject & {
      items: (RabItem & { disbursements: RabDisbursement[] })[];
      wbsGroups: RabWbs[];
    })
  | null;

export class RabProjectUpdateRepository {
  constructor(private readonly client: PrismaClient) {}

  /** Update a RAB project and nested relations in one transaction. */
  /**
   * @param kunciModalInvestor true bila proyek sudah punya bagi hasil investor:
   *   daftar investor & modalnya tidak boleh berubah (seluruh update dibatalkan).
   */
  async updateProjectWithRelations(
    id: string,
    input: RabProjectUpdateInput,
    kunciModalInvestor = false,
  ): Promise<UpdatedRabProject> {
    return this.client.$transaction(async (tx) => {
      await tx.rabProject.update(buildProjectUpdateQuery(id, input));
      if (input.items !== undefined) await this.replaceItems(tx, id, input);
      await this.syncInvestors(tx, id, input, kunciModalInvestor);
      return tx.rabProject.findUnique(buildUpdatedProjectQuery(id));
    });
  }

  private async replaceItems(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    await tx.rabItem.deleteMany({ where: { rabProjectId: projectId } });
    await tx.rabWbs.deleteMany({ where: { rabProjectId: projectId } });
    const wbsMap = await this.createWbsGroups(
      tx,
      projectId,
      input.wbsGroups || [],
    );
    for (const item of input.items || []) {
      await this.createItemWithDisbursements(tx, projectId, item, wbsMap);
    }
  }

  private async createWbsGroups(
    tx: RabProjectTransactionClient,
    projectId: string,
    wbsGroups: NonNullable<RabProjectUpdateInput["wbsGroups"]>,
  ) {
    const wbsMap = new Map<string, string>();
    for (const wbs of wbsGroups) {
      const createdWbs = await tx.rabWbs.create({
        data: { rabProjectId: projectId, name: wbs.name, order: wbs.order },
      });
      if (wbs.id) wbsMap.set(wbs.id, createdWbs.id);
    }
    return wbsMap;
  }

  private async createItemWithDisbursements(
    tx: RabProjectTransactionClient,
    projectId: string,
    item: NonNullable<RabProjectUpdateInput["items"]>[number],
    wbsMap: Map<string, string>,
  ) {
    const createdItem = await tx.rabItem.create({
      data: buildItemCreateData(projectId, item, wbsMap),
    });
    await this.createDisbursements(
      tx,
      createdItem.id,
      item.disbursements || [],
    );
  }

  private async createDisbursements(
    tx: RabProjectTransactionClient,
    rabItemId: string,
    disbursements: NonNullable<
      NonNullable<RabProjectUpdateInput["items"]>[number]["disbursements"]
    >,
  ) {
    const rows = createDisbursementRows(rabItemId, disbursements);
    if (rows.length === 0) return;
    await tx.rabDisbursement.createMany({ data: rows });
  }

  private async syncInvestors(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
    kunciModalInvestor: boolean,
  ) {
    const existing = await tx.rabInvestor.findMany({
      where: { rabProjectId: projectId },
      select: { investorId: true, investmentAmount: true },
    });
    const isDaftarBerubah =
      input.investorIds !== undefined &&
      !isHimpunanSama(existing.map((investor) => investor.investorId), input.investorIds);

    if (isDaftarBerubah) {
      if (kunciModalInvestor) throw new ModalInvestorTerkunciError();
      await this.replaceInvestors(tx, projectId, input);
      return;
    }
    // Daftar sama: baris investor dipertahankan (tidak dihapus-buat ulang),
    // hanya nominal modal yang disesuaikan bila dasar pendanaan berubah.
    if (existing.length > 0 && hasInvestorFundingBaseChange(input)) {
      await this.updateExistingInvestorAmounts(tx, projectId, input, existing, kunciModalInvestor);
    }
  }

  private async replaceInvestors(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    await tx.rabInvestor.deleteMany({ where: { rabProjectId: projectId } });
    if (!input.investorIds?.length) return;
    const context = await this.getInvestmentContext(tx, projectId, input);
    const amounts = splitInvestmentBase(
      context.investmentBase,
      input.investorIds,
    );
    await tx.rabInvestor.createMany({
      data: buildInvestorCreateRows(
        projectId,
        input.investorIds,
        amounts,
        context.profitSharePercent,
      ),
    });
  }

  private async updateExistingInvestorAmounts(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
    investors: Array<{ investorId: string; investmentAmount: bigint }>,
    kunciModalInvestor: boolean,
  ) {
    const context = await this.getInvestmentContext(tx, projectId, input);
    const investorIds = investors.map((investor) => investor.investorId);
    const amounts = splitInvestmentBase(context.investmentBase, investorIds);
    const isModalBerubah = investors.some(
      (investor, index) => investor.investmentAmount !== BigInt(amounts[index] ?? 0),
    );
    if (isModalBerubah && kunciModalInvestor) throw new ModalInvestorTerkunciError();
    for (const [index, investorId] of investorIds.entries()) {
      await tx.rabInvestor.updateMany({
        where: { rabProjectId: projectId, investorId },
        data: {
          investmentAmount: BigInt(amounts[index] ?? 0),
          profitSharePercent: context.profitSharePercent,
        },
      });
    }
  }

  private async getInvestmentContext(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    const project = await tx.rabProject.findUnique(
      buildProjectFindQuery(projectId),
    );
    const projectWithItems = project as Awaited<
      ReturnType<typeof tx.rabProject.findUnique>
    > & {
      items?: RabProjectUpdateInput["items"];
    };
    const items = getInvestmentItems(
      input.items,
      projectWithItems?.items ?? [],
    );
    return buildInvestmentContext(input, projectWithItems, items);
  }
}
