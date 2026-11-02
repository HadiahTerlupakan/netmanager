import type { RabProjectEntity } from "../entities/RabProjectEntity";

export type RabProjectFilter = Record<string, unknown>;

/** Repository port for finance RAB project reads used by services. */
export interface IRabProjectRepository {
  findProjectsForStatusEvaluation(): Promise<RabProjectEntity[]>;
  updateProjectStatus(id: string, status: string): Promise<boolean>;
  findManyWithDetails(where: RabProjectFilter): Promise<unknown[]>;
}

/** Port baca site proyek untuk penjaga lingkup `expense:site_only`. */
export interface IRabProjectSiteLookup {
  findById(id: string): Promise<{ siteId: string | null } | null>;
}
