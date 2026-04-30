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
  async updateProjectWithRelations(
    id: string,
    input: RabProjectUpdateInput,
  ): Promise<UpdatedRabProject> {
    return this.client.$transaction(async (tx) => {
      await tx.rabProject.update(buildProjectUpdateQuery(id, input));
      if (input.items !== undefined) await this.replaceItems(tx, id, input);
      await this.syncInvestors(tx, id, input);
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
  ) {
    if (input.investorIds !== undefined) {
      await this.replaceInvestors(tx, projectId, input);
      return;
    }
    if (hasInvestorFundingBaseChange(input)) {
      await this.recalculateExistingInvestors(tx, projectId, input);
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

  private async recalculateExistingInvestors(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    const existingInvestors = await tx.rabInvestor.findMany({
      where: { rabProjectId: projectId },
    });
    if (existingInvestors.length === 0) return;
    await this.updateExistingInvestorAmounts(
      tx,
      projectId,
      input,
      existingInvestors,
    );
  }

  private async updateExistingInvestorAmounts(
    tx: RabProjectTransactionClient,
    projectId: string,
    input: RabProjectUpdateInput,
    investors: Array<{ investorId: string }>,
  ) {
    const context = await this.getInvestmentContext(tx, projectId, input);
    const investorIds = investors.map((investor) => investor.investorId);
    const amounts = splitInvestmentBase(context.investmentBase, investorIds);
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
