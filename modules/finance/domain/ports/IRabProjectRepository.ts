import type { Prisma } from "@prisma/client";
import type { RabProjectEntity } from "../entities/RabProjectEntity";

/** Repository port for finance RAB project reads used by services. */
export interface IRabProjectRepository {
  findProjectsForStatusEvaluation(): Promise<RabProjectEntity[]>;
  updateProjectStatus(id: string, status: string): Promise<boolean>;
  findManyWithDetails(where: Prisma.RabProjectWhereInput): Promise<unknown[]>;
}
