import { prisma } from "@/lib/prisma";
import type {
  SalaryComponent,
  SalaryComponentType,
  UserSalaryComponent,
  Prisma,
  User,
} from "@prisma/client";

export interface ComponentWithUserAmount extends SalaryComponent {
  userComponents?: UserSalaryComponent[];
}

const BASIC_SALARY_COMPONENT_NAME = "Gaji Pokok";

export class SalaryComponentRepository {
  /**
   * Get all active components
   */
  async findAll(type?: SalaryComponentType): Promise<SalaryComponent[]> {
    const where: Prisma.SalaryComponentWhereInput = { isActive: true };
    if (type) where.type = type;

    return prisma.salaryComponent.findMany({
      where,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Get component by ID
   */
  async findById(id: string): Promise<SalaryComponent | null> {
    return prisma.salaryComponent.findUnique({
      where: { id },
    });
  }

  /**
   * Find component by name
   */
  async findByName(name: string): Promise<SalaryComponent | null> {
    return prisma.salaryComponent.findFirst({
      where: { name },
    });
  }

  /**
   * Create component
   */
  async create(
    data: Prisma.SalaryComponentCreateInput,
  ): Promise<SalaryComponent> {
    return prisma.salaryComponent.create({ data });
  }

  /**
   * Update component
   */
  async update(
    id: string,
    data: Prisma.SalaryComponentUpdateInput,
  ): Promise<SalaryComponent> {
    return prisma.salaryComponent.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /**
   * Delete component (soft delete by deactivating)
   */
  async delete(id: string): Promise<void> {
    await prisma.salaryComponent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get user's salary components
   */
  async getUserComponents(
    userId: string,
  ): Promise<Array<UserSalaryComponent & { component: SalaryComponent }>> {
    return prisma.userSalaryComponent.findMany({
      where: { userId, isActive: true },
      include: { component: true },
    });
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
      select: {
        amount: true,
      },
    });

    return component?.amount ?? 0;
  }

  /** Get active users with their basic salary component amount. */
  async findActiveUsersWithBasicSalaryComponent(
    userIds?: string[],
  ): Promise<
    Array<
      Pick<User, "id"> & { userSalaryComponents: Array<{ amount: number }> }
    >
  > {
    return prisma.user.findMany({
      where: {
        isActive: true,
        ...(userIds && userIds.length > 0 ? { id: { in: userIds } } : {}),
      },
      select: {
        id: true,
        userSalaryComponents: {
          where: {
            isActive: true,
            component: {
              name: BASIC_SALARY_COMPONENT_NAME,
            },
          },
          select: {
            amount: true,
          },
        },
      },
    });
  }

  /** Delete user salary component assignment by ID. */
  async deleteUserComponentAssignment(assignmentId: string): Promise<void> {
    await prisma.userSalaryComponent.delete({
      where: { id: assignmentId },
    });
  }

  /**
   * Get user's component for a specific component ID
   */
  async getUserComponent(
    userId: string,
    componentId: string,
  ): Promise<UserSalaryComponent | null> {
    return prisma.userSalaryComponent.findUnique({
      where: {
        userId_componentId: { userId, componentId },
      },
    });
  }

  /**
   * Assign component to user
   */
  async assignToUser(
    userId: string,
    componentId: string,
    amount: number,
    notes?: string,
  ): Promise<UserSalaryComponent> {
    return prisma.userSalaryComponent.upsert({
      where: {
        userId_componentId: { userId, componentId },
      },
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
  }

  /**
   * Remove component from user
   */
  async removeFromUser(userId: string, componentId: string): Promise<void> {
    await prisma.userSalaryComponent.update({
      where: {
        userId_componentId: { userId, componentId },
      },
      data: { isActive: false },
    });
  }

  /**
   * Bulk assign component to multiple users
   */
  async bulkAssign(
    componentId: string,
    assignments: Array<{ userId: string; amount: number; notes?: string }>,
  ): Promise<number> {
    let count = 0;
    for (const assignment of assignments) {
      await this.assignToUser(
        assignment.userId,
        componentId,
        assignment.amount,
        assignment.notes,
      );
      count++;
    }
    return count;
  }

  /**
   * Get all users with a specific component
   */
  async getComponentUsers(
    componentId: string,
  ): Promise<
    Array<
      UserSalaryComponent & {
        user: { id: string; name: string | null; email: string };
      }
    >
  > {
    return prisma.userSalaryComponent.findMany({
      where: { componentId, isActive: true },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
