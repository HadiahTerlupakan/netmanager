import type {
  Salary,
  SalaryComponent,
  SalaryDetail,
  SalaryRevision,
  UserSalaryComponent,
} from "@prisma/client";
import type {
  SalaryComponentDTO,
  SalaryDetailDTO,
  SalaryListItemDTO,
  SalarySlipDTO,
} from "../dto/SalaryDTO";
import type {
  SalaryComponentEntity,
  UserSalaryComponentWithComponentEntity,
} from "../domain/entities/SalaryComponentEntity";
import type {
  SalaryEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";
import {
  formatSalaryPeriod,
  toSalaryComponentDTO,
  toSalaryComponentEntity,
  toSalaryDetailDTO,
  toSalaryDetailEntity,
  toSalaryEntity,
  toSalaryListItemDTO,
  toSalaryRevisionEntity,
  toSalarySlipDTO,
  toSalaryWithDetailsEntity,
  toUserSalaryComponentEntity,
  toUserSalaryComponentWithComponentEntity,
  type SalaryWithRelations,
  type UserSalaryComponentWithRelations,
} from "./SalaryMapper.helpers";

export class SalaryMapper {
  /** Map Prisma salary detail to domain entity. */
  static toDomainDetail(detail: SalaryDetail) {
    return toSalaryDetailEntity(detail);
  }
  /** Map Prisma salary revision to domain entity. */
  static toDomainRevision(revision: SalaryRevision) {
    return toSalaryRevisionEntity(revision);
  }
  /** Map Prisma salary to domain entity. */
  static toDomain(entity: SalaryWithRelations): SalaryWithDetailsEntity {
    return toSalaryWithDetailsEntity(entity);
  }
  /** Map base salary record to domain entity. */
  static toDomainSalary(entity: Salary): SalaryEntity {
    return toSalaryEntity(entity);
  }
  /** Map Prisma salary component to domain entity. */
  static toDomainComponent(entity: SalaryComponent): SalaryComponentEntity {
    return toSalaryComponentEntity(entity);
  }
  /** Map Prisma user component to domain entity. */
  static toDomainUserComponent(entity: UserSalaryComponent) {
    return toUserSalaryComponentEntity(entity);
  }
  /** Map Prisma user component with component relation to domain entity. */
  static toDomainUserComponentWithComponent(
    entity: UserSalaryComponentWithRelations,
  ): UserSalaryComponentWithComponentEntity {
    return toUserSalaryComponentWithComponentEntity(entity);
  }
  /** Map domain salary to list DTO. */
  static toListItem(entity: SalaryWithDetailsEntity): SalaryListItemDTO {
    return toSalaryListItemDTO(entity);
  }
  /** Map domain salaries to list DTOs. */
  static toListItems(entities: SalaryWithDetailsEntity[]): SalaryListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }
  /** Map domain salary to detail DTO. */
  static toDetail(entity: SalaryWithDetailsEntity): SalaryDetailDTO {
    return toSalaryDetailDTO(entity);
  }
  /** Map domain salary to slip DTO. */
  static toSlip(entity: SalaryWithDetailsEntity): SalarySlipDTO {
    return toSalarySlipDTO(entity);
  }
  /** Map domain component to DTO. */
  static componentToDTO(entity: SalaryComponentEntity): SalaryComponentDTO {
    return toSalaryComponentDTO(entity);
  }
  /** Map domain components to DTOs. */
  static componentsToDTO(
    entities: SalaryComponentEntity[],
  ): SalaryComponentDTO[] {
    return entities.map((entity) => this.componentToDTO(entity));
  }
  /** Format salary period text. */
  static formatPeriod(month: number, year: number): string {
    return formatSalaryPeriod(month, year);
  }
}
