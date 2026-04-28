import type { RabProjectEntity } from "../entities/RabProjectEntity";

export type RabProjectFilter = Record<string, unknown>;

/** Repository port for finance RAB project reads used by services. */
export interface IRabProjectRepository {
  findProjectsForStatusEvaluation(): Promise<RabProjectEntity[]>;
  updateProjectStatus(id: string, status: string): Promise<boolean>;
  findManyWithDetails(where: RabProjectFilter): Promise<unknown[]>;
}
