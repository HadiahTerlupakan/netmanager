import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { SalaryMapper } from "../mappers/SalaryMapper";
import type {
  SalaryComponentEntity,
  UserSalaryComponentEntity,
  UserSalaryComponentWithComponentEntity,
} from "../domain/entities/SalaryComponentEntity";
import type {
  CreateSalaryComponentInput,
  ISalaryComponentRepository,
  UpdateSalaryComponentInput,
} from "../domain/ports/ISalaryComponentRepository";
import type { SalaryComponentType } from "../domain/entities/SalaryEntity";

const BASIC_SALARY_COMPONENT_NAME = "Gaji Pokok";
const EMPTY_AMOUNT = 0;

export type ComponentWithUserAmount = SalaryComponentEntity;

export class SalaryComponentRepository implements ISalaryComponentRepository {
  /** Get all active components. */
  async findAll(type?: SalaryComponentType): Promise<SalaryComponentEntity[]> {
    const where: Prisma.SalaryComponentWhereInput = { isActive: true };

    if (type) {
      where.type = type;
    }

    const components = await prisma.salaryComponent.findMany({
      where,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return components.map((component) =>
      SalaryMapper.toDomainComponent(component),
    );
  }

  /** Get component by ID. */
  async findById(id: string): Promise<SalaryComponentEntity | null> {
    const component = await prisma.salaryComponent.findUnique({
      where: { id },
    });
    return component ? SalaryMapper.toDomainComponent(component) : null;
  }

  /** Find component by name. */
  async findByName(name: string): Promise<SalaryComponentEntity | null> {
    const component = await prisma.salaryComponent.findFirst({
      where: { name },
    });
    return component ? SalaryMapper.toDomainComponent(component) : null;
  }

  /** Create component. */
  async create(
    data: CreateSalaryComponentInput,
  ): Promise<SalaryComponentEntity> {
    const component = await prisma.salaryComponent.create({ data });
    return SalaryMapper.toDomainComponent(component);
  }

  /** Update component. */
  async update(
    id: string,
    data: UpdateSalaryComponentInput,
  ): Promise<SalaryComponentEntity> {
    const component = await prisma.salaryComponent.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });

    return SalaryMapper.toDomainComponent(component);
  }

  /** Delete component by deactivating it. */
  async delete(id: string): Promise<void> {
    await prisma.salaryComponent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Get user's salary components. */
  async getUserComponents(
    userId: string,
  ): Promise<UserSalaryComponentWithComponentEntity[]> {
    const userComponents = await prisma.userSalaryComponent.findMany({
      where: { userId, isActive: true },
      include: { component: true },
    });

    return userComponents.map((component) =>
      SalaryMapper.toDomainUserComponentWithComponent(component),
    );
  }

  /** Get active user basic salary component amount. */
  async findBasicSalaryAmount(userId: string): Promise<number> {
    const component = await prisma.userSalaryComponent.findFirst({
      where: {
        userId,
        isActive: true,
        component: {
          type: "EARNING",
          name: BASIC_SALARY_COMPONENT_NAME,
        },
      },
      select: { amount: true },
    });

    return component?.amount ?? EMPTY_AMOUNT;
  }

  /** Get active users with their basic salary component amount. */
  async findActiveUsersWithBasicSalaryComponent(userIds?: string[]) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(userIds && userIds.length > 0 ? { id: { in: userIds } } : {}),
      },
      select: {
        id: true,
        userSalaryComponents: {
          where: {
            isActive: true,
            component: { name: BASIC_SALARY_COMPONENT_NAME },
          },
          select: { amount: true },
        },
      },
    });

    return users.map((user) => ({
      id: user.id,
      basicSalaryAmount: user.userSalaryComponents[0]?.amount ?? EMPTY_AMOUNT,
    }));
  }

  /** Delete user salary component assignment by ID. */
  async deleteUserComponentAssignment(assignmentId: string): Promise<void> {
    await prisma.userSalaryComponent.delete({ where: { id: assignmentId } });
  }

  /** Get user's component for a specific component ID. */
  async getUserComponent(
    userId: string,
    componentId: string,
  ): Promise<UserSalaryComponentEntity | null> {
    const component = await prisma.userSalaryComponent.findUnique({
      where: { userId_componentId: { userId, componentId } },
    });

    return component ? SalaryMapper.toDomainUserComponent(component) : null;
  }

  /** Assign component to user. */
  async assignToUser(
    userId: string,
    componentId: string,
    amount: number,
    notes?: string,
  ): Promise<UserSalaryComponentEntity> {
    const component = await prisma.userSalaryComponent.upsert({
      where: { userId_componentId: { userId, componentId } },
      create: {
        userId,
        componentId,
        amount,
        notes: notes ?? null,
        isActive: true,
      },
      update: {
        amount,
        notes: notes ?? null,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return SalaryMapper.toDomainUserComponent(component);
  }

  /** Remove component from user. */
  async removeFromUser(userId: string, componentId: string): Promise<void> {
    await prisma.userSalaryComponent.update({
      where: { userId_componentId: { userId, componentId } },
      data: { isActive: false },
    });
  }

  /** Bulk assign component to multiple users. */
  async bulkAssign(
    componentId: string,
    assignments: Array<{ userId: string; amount: number; notes?: string }>,
  ): Promise<number> {
    let count = EMPTY_AMOUNT;

    for (const assignment of assignments) {
      await this.assignToUser(
        assignment.userId,
        componentId,
        assignment.amount,
        assignment.notes,
      );
      count += 1;
    }

    return count;
  }

  /** Get all users with a specific component. */
  async getComponentUsers(componentId: string) {
    const assignments = await prisma.userSalaryComponent.findMany({
      where: { componentId, isActive: true },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return assignments.map((assignment) => ({
      ...SalaryMapper.toDomainUserComponent(assignment),
      user: assignment.user,
    }));
  }
}
