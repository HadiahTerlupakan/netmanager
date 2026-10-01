import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  IRoleRepository,
  CreateRoleRepositoryInput,
  RoleFilterOptions,
  UpdateRoleRepositoryInput,
} from "../domain/ports/IRoleRepository";
import type {
  RoleEntity,
  UserRoleContextEntity,
} from "../domain/entities/RoleEntity";
import { RoleMapper } from "../mappers/RoleMapper";
import {
  PERSONA_KARYAWAN_DEFAULT,
  isSalesDariPersona,
  type PersonaKaryawan,
} from "../domain/persona-karyawan";

const SUPER_ADMIN_ROLE_NAME = "SUPER_ADMIN";

export class RoleRepository implements IRoleRepository {
  /** Get all roles with optional restriction filter. */
  async findAll(filter?: RoleFilterOptions): Promise<RoleEntity[]> {
    const where = this.buildWhereClause(filter);
    const roles = await prisma.role.findMany({
      where,
      include: {
        _count: { select: { user: true } },
        permission: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return RoleMapper.toDomains(roles);
  }

  /** Get user role context for access filtering. */
  async findUserRoleContext(
    userId?: string | null,
  ): Promise<UserRoleContextEntity> {
    if (!userId) {
      return { roleId: null, roleName: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        roleId: true,
        role: { select: { name: true } },
      },
    });

    return {
      roleId: user?.roleId ?? null,
      roleName: user?.role?.name ?? null,
    };
  }

  /** Find role by ID. */
  async findById(id: string): Promise<RoleEntity | null> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { user: true } }, permission: true },
    });

    return role ? RoleMapper.toDomain(role) : null;
  }

  /** Find role by ID with permissions loaded. */
  async findByIdWithPermissions(id: string): Promise<RoleEntity | null> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { user: true } }, permission: true },
    });

    return role ? RoleMapper.toDomain(role) : null;
  }

  /** Find role by name. */
  async findByName(name: string): Promise<RoleEntity | null> {
    const role = await prisma.role.findFirst({
      where: { name },
      include: { _count: { select: { user: true } }, permission: true },
    });

    return role ? RoleMapper.toDomain(role) : null;
  }

  /** Create a new role entity. */
  async create(data: CreateRoleRepositoryInput): Promise<RoleEntity> {
    const role = await prisma.role.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: data.name,
        description: data.description,
        accessAdminPanel: data.accessAdminPanel ?? false,
        accessEmployeePanel: data.accessEmployeePanel ?? false,
        isRestricted: data.isRestricted ?? false,
        isTechnical: data.isTechnical ?? false,
        persona: data.persona ?? PERSONA_KARYAWAN_DEFAULT,
        isSuperAdmin: data.isSuperAdmin ?? false,
        canApproveRab: data.canApproveRab ?? false,
        canReceiveWhatsappApproval: data.canReceiveWhatsappApproval ?? false,
        permission: {
          connect: this.mapPermissionConnections(data.permissionIds),
        },
      },
      include: { _count: { select: { user: true } }, permission: true },
    });

    return RoleMapper.toDomain(role);
  }

  /**
   * Update an existing role entity. Bila persona ikut dikirim, `User.isSales`
   * seluruh pengguna role ini disinkronkan dalam transaksi yang sama, karena
   * kolom itu turunan persona role (`isSalesDariPersona`).
   */
  async update(
    id: string,
    data: UpdateRoleRepositoryInput,
  ): Promise<RoleEntity> {
    const role = await prisma.$transaction(async (tx) => {
      const updatedRole = await tx.role.update({
        where: { id },
        data: {
          ...this.buildUpdateData(data),
          updatedAt: new Date(),
        },
        include: { _count: { select: { user: true } }, permission: true },
      });

      if (data.persona !== undefined) {
        await this.syncUserIsSales(tx, updatedRole);
      }

      return updatedRole;
    });

    return RoleMapper.toDomain(role);
  }

  /** Samakan `User.isSales` pengguna role (tenant role) dengan persona role. */
  private async syncUserIsSales(
    tx: Prisma.TransactionClient,
    role: { id: string; tenantId: string | null; persona: PersonaKaryawan },
  ): Promise<void> {
    const isSales = isSalesDariPersona(role.persona);
    await tx.user.updateMany({
      where: {
        roleId: role.id,
        isSales: { not: isSales },
        ...(role.tenantId ? { tenantId: role.tenantId } : {}),
      },
      data: { isSales },
    });
  }

  /** Delete role entity by ID. */
  async delete(id: string): Promise<RoleEntity> {
    const role = await prisma.role.delete({
      where: { id },
      include: { _count: { select: { user: true } }, permission: true },
    });

    return RoleMapper.toDomain(role);
  }

  /** Count users assigned to a role. */
  async countUsers(id: string): Promise<number> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { user: true } } },
    });

    return role?._count.user ?? 0;
  }

  private buildWhereClause(filter?: RoleFilterOptions): Prisma.RoleWhereInput {
    if (
      !filter?.filterRestricted ||
      filter.currentUserRoleName === SUPER_ADMIN_ROLE_NAME
    ) {
      return {};
    }

    return {
      OR: [{ isRestricted: false }, { id: filter.currentUserRoleId ?? "" }],
    };
  }

  private buildUpdateData(
    data: UpdateRoleRepositoryInput,
  ): Prisma.RoleUpdateInput {
    const updateData: Prisma.RoleUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.accessAdminPanel !== undefined)
      updateData.accessAdminPanel = data.accessAdminPanel;
    if (data.accessEmployeePanel !== undefined)
      updateData.accessEmployeePanel = data.accessEmployeePanel;
    if (data.isRestricted !== undefined)
      updateData.isRestricted = data.isRestricted;
    if (data.isTechnical !== undefined)
      updateData.isTechnical = data.isTechnical;
    if (data.persona !== undefined) updateData.persona = data.persona;
    if (data.isSuperAdmin !== undefined)
      updateData.isSuperAdmin = data.isSuperAdmin;
    if (data.canApproveRab !== undefined)
      updateData.canApproveRab = data.canApproveRab;
    if (data.canReceiveWhatsappApproval !== undefined) {
      updateData.canReceiveWhatsappApproval = data.canReceiveWhatsappApproval;
    }
    if (data.permissionIds !== undefined) {
      updateData.permission = {
        set: this.mapPermissionConnections(data.permissionIds),
      };
    }

    return updateData;
  }

  private mapPermissionConnections(permissionIds?: string[]) {
    return (permissionIds ?? []).map((id) => ({ id }));
  }
}
