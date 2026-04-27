import type {
  SalaryComponentEntity,
  UserBasicSalaryEntity,
  UserSalaryComponentEntity,
  UserSalaryComponentWithComponentEntity,
} from "../entities/SalaryComponentEntity";
import type { RateType, SalaryComponentType } from "../entities/SalaryEntity";

export interface CreateSalaryComponentInput {
  name: string;
  type: SalaryComponentType;
  rateType: RateType;
  defaultAmount?: number | null;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateSalaryComponentInput {
  name?: string;
  type?: SalaryComponentType;
  rateType?: RateType;
  defaultAmount?: number | null;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ISalaryComponentRepository {
  /** Get all active salary components. */
  findAll(type?: SalaryComponentType): Promise<SalaryComponentEntity[]>;

  /** Find salary component by ID. */
  findById(id: string): Promise<SalaryComponentEntity | null>;

  /** Find salary component by name. */
  findByName(name: string): Promise<SalaryComponentEntity | null>;

  /** Create salary component. */
  create(data: CreateSalaryComponentInput): Promise<SalaryComponentEntity>;

  /** Update salary component. */
  update(
    id: string,
    data: UpdateSalaryComponentInput,
  ): Promise<SalaryComponentEntity>;

  /** Soft delete salary component. */
  delete(id: string): Promise<void>;

  /** Get user salary component assignments. */
  getUserComponents(
    userId: string,
  ): Promise<UserSalaryComponentWithComponentEntity[]>;

  /** Get user's basic salary amount from active component. */
  findBasicSalaryAmount(userId: string): Promise<number>;

  /** Get active users with basic salary component. */
  findActiveUsersWithBasicSalaryComponent(
    userIds?: string[],
  ): Promise<UserBasicSalaryEntity[]>;

  /** Delete component assignment by ID. */
  deleteUserComponentAssignment(assignmentId: string): Promise<void>;

  /** Get one user component assignment. */
  getUserComponent(
    userId: string,
    componentId: string,
  ): Promise<UserSalaryComponentEntity | null>;

  /** Upsert component assignment to user. */
  assignToUser(
    userId: string,
    componentId: string,
    amount: number,
    notes?: string,
  ): Promise<UserSalaryComponentEntity>;

  /** Deactivate component assignment from user. */
  removeFromUser(userId: string, componentId: string): Promise<void>;

  /** Bulk assign component to users. */
  bulkAssign(
    componentId: string,
    assignments: Array<{ userId: string; amount: number; notes?: string }>,
  ): Promise<number>;

  /** Get all user assignments for one component. */
  getComponentUsers(componentId: string): Promise<
    Array<
      UserSalaryComponentEntity & {
        user: { id: string; name: string | null; email: string };
      }
    >
  >;
}
