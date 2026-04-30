import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient, RabStatus } from "@prisma/client";
import type { IRabProjectRepository } from "../domain/ports/IRabProjectRepository";
import { RabProjectUpdateRepository } from "./RabProjectUpdateRepository";
import {
  buildActualAchievementUpsertArgs,
  buildDuplicateProjectCreateArgs,
  createBasicProjectQuery,
  createDraftProjectDeleteTransaction,
  createFullProjectInTransaction,
  createProjectDetailQuery,
  createProjectDuplicateQuery,
  createProjectListQuery,
  createProjectStatusEvaluationQuery,
  createProjectWithItemsQuery,
  createRevisionProfitLossQuery,
  createStatusUpdateData,
  type FullProjectCreateInput,
  type RabProjectStatusCandidate,
  type RabProjectWithDetails,
} from "./rabProject.repository-helpers";
import type { RabProjectUpdateInput } from "./rabProject.types";

export type {
  RabProjectStatusCandidate,
  RabProjectUpdateInput,
} from "./rabProject.types";

export class RabProjectRepository implements IRabProjectRepository {
  private readonly updateRepository: RabProjectUpdateRepository;

  constructor(private readonly client: PrismaClient = prisma) {
    this.updateRepository = new RabProjectUpdateRepository(this.client);
  }

  /** Get active projects that need status evaluation. */
  async findProjectsForStatusEvaluation(): Promise<
    RabProjectStatusCandidate[]
  > {
    return this.client.rabProject.findMany(
      createProjectStatusEvaluationQuery(),
    ) as Promise<RabProjectStatusCandidate[]>;
  }

  /** Update a single RAB project status. */
  async updateProjectStatus(id: string, status: RabStatus): Promise<boolean> {
    try {
      await this.client.rabProject.update({
        where: { id },
        data: createStatusUpdateData(status),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Get many RAB projects with nested detail relations. */
  async findManyWithDetails(
    where: Prisma.RabProjectWhereInput,
  ): Promise<RabProjectWithDetails[]> {
    return this.client.rabProject.findMany(
      createProjectListQuery(where),
    ) as Promise<RabProjectWithDetails[]>;
  }

  /** Create a basic RAB project. */
  async createProject(data: Prisma.RabProjectCreateInput) {
    return this.client.rabProject.create({ data });
  }

  /** Find a RAB project with items and WBS groups. */
  async findByIdWithItems(id: string) {
    return this.client.rabProject.findUnique(createProjectWithItemsQuery(id));
  }

  /** Find a detailed RAB project for route responses. */
  async findDetailById(id: string) {
    return this.client.rabProject.findUnique(createProjectDetailQuery(id));
  }

  /** Find a RAB project for revision profit-loss analysis. */
  async findRevisionProfitLossProject(id: string) {
    return this.client.rabProject.findUnique(createRevisionProfitLossQuery(id));
  }

  /** Find a lightweight RAB project by id. */
  async findById(id: string) {
    return this.client.rabProject.findUnique(createBasicProjectQuery(id));
  }

  /** Delete a draft RAB project and detach dependent expenses. */
  async deleteDraftProject(id: string) {
    return this.client.$transaction([
      ...createDraftProjectDeleteTransaction(this.client, id),
    ]);
  }

  /** Duplicate a RAB project with all items as a new draft. */
  async duplicateProject(id: string, userId: string) {
    const sourceProject = await this.findProjectForDuplication(id);
    if (!sourceProject) {
      return null;
    }

    return this.client.rabProject.create(
      buildDuplicateProjectCreateArgs(sourceProject, userId),
    );
  }

  /** Finds the source project used during duplication. */
  private findProjectForDuplication(id: string) {
    return this.client.rabProject.findUnique(createProjectDuplicateQuery(id));
  }

  /** Upsert actual achievement for a RAB project period. */
  async upsertActualAchievement(input: {
    rabProjectId: string;
    month: number;
    year: number;
    actualSubscribers: number;
    actualRevenue: bigint;
    actualOpex: bigint;
    manualRecoveryInstallment: bigint | null;
    manualInvestorShare: bigint | null;
    manualCompanyShare: bigint | null;
    manualInvestorProfitSharePercent: number | null;
    notes?: string;
  }) {
    return this.client.rabActualAchievement.upsert(
      buildActualAchievementUpsertArgs(input),
    );
  }

  /** Update a RAB project and nested relations in one transaction. */
  async updateProjectWithRelations(id: string, input: RabProjectUpdateInput) {
    return this.updateRepository.updateProjectWithRelations(id, input);
  }

  /** Create a complete RAB project with nested items and investors. */
  async createFullProject(
    data: FullProjectCreateInput,
  ): Promise<RabProjectWithDetails | null> {
    return this.client.$transaction((tx) =>
      createFullProjectInTransaction(tx, data),
    );
  }
}
