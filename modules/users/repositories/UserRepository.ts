import { randomUUID } from "crypto";

import {
  AttendanceGeofencePolicy,
  Prisma,
  WorkingHourMode,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  UserEntity,
  UserListResultEntity,
  UserScheduleEntity,
} from "../domain/entities/UserEntity";
import type {
  CreateUserRepositoryInput,
  FindUsersParams,
  IUserRepository,
  UpdateUserRepositoryInput,
} from "../domain/ports/IUserRepository";
import { UserMapper } from "../mappers/UserMapper";
import {
  buildUserFindAllQuery,
  USER_BASE_SELECT,
  USER_DETAIL_SELECT,
} from "./user-repository.helpers";

/** Menangani persistence inti user untuk CRUD dan kontrak domain. */
export class UserRepository implements IUserRepository {
  /** Ambil list user dengan filter dan pagination. */
  async findAll(params: FindUsersParams = {}): Promise<UserListResultEntity> {
    const query = buildUserFindAllQuery(params);
    const activeWhere = { ...(query.where ?? {}), isActive: true };
    const inactiveWhere = { ...(query.where ?? {}), isActive: false };
    const [users, total, activeCount, inactiveCount] =
      await prisma.$transaction([
        prisma.user.findMany(query),
        prisma.user.count({ where: query.where }),
        prisma.user.count({ where: activeWhere }),
        prisma.user.count({ where: inactiveWhere }),
      ]);

    return {
      total,
      active: params.isActive === false ? 0 : activeCount,
      inactive: params.isActive === true ? 0 : inactiveCount,
      data: users.map((user) => UserMapper.toDomain(user)),
    };
  }

  /** Ambil satu user dasar berdasarkan id. */
  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_BASE_SELECT,
    });

    return user ? UserMapper.toDomain(user) : null;
  }

  /** Ambil detail user lengkap berdasarkan id. */
  async findByIdWithRelations(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_DETAIL_SELECT,
    });

    return user ? UserMapper.toDomain(user) : null;
  }

  /** Ambil user berdasarkan email. */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? UserMapper.toDomain(user) : null;
  }

  /** Ambil konteks izin upload user. */
  findUploadPermissionContextById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permission: true } } },
    });
  }

  /** Buat user baru. */
  async create(data: CreateUserRepositoryInput): Promise<UserEntity> {
    const userId = randomUUID();
    const user = await prisma.user.create({
      data: {
        id: userId,
        updatedAt: new Date(),
        ...UserMapper.toRepositoryCreateInput(data),
        workingHourMode: data.workingHourMode as WorkingHourMode | undefined,
        attendanceGeofencePolicy: data.attendanceGeofencePolicy as
          | AttendanceGeofencePolicy
          | undefined,
        targetSchema:
          data.targetSchema as Prisma.UserCreateInput["targetSchema"],
        overtimeCalcTypeNormal:
          data.overtimeCalcTypeNormal as Prisma.UserCreateInput["overtimeCalcTypeNormal"],
        overtimeCalcTypeHoliday:
          data.overtimeCalcTypeHoliday as Prisma.UserCreateInput["overtimeCalcTypeHoliday"],
        overtimeCalcTypeNational:
          data.overtimeCalcTypeNational as Prisma.UserCreateInput["overtimeCalcTypeNormal"],
      },
    });

    return UserMapper.toDomain(user);
  }

  /** Buat user baru dengan sites dalam satu transaksi. */
  async createWithSites(
    data: CreateUserRepositoryInput,
    userSites: Array<{ siteId: string; isPrimary?: boolean }>,
  ): Promise<UserEntity> {
    const userId = randomUUID();

    const user = await prisma.$transaction(async (tx) => {
      // 1. Create user
      const newUser = await tx.user.create({
        data: {
          id: userId,
          updatedAt: new Date(),
          ...UserMapper.toRepositoryCreateInput(data),
          workingHourMode: data.workingHourMode as WorkingHourMode | undefined,
          attendanceGeofencePolicy: data.attendanceGeofencePolicy as
            | AttendanceGeofencePolicy
            | undefined,
          targetSchema:
            data.targetSchema as Prisma.UserCreateInput["targetSchema"],
          overtimeCalcTypeNormal:
            data.overtimeCalcTypeNormal as Prisma.UserCreateInput["overtimeCalcTypeNormal"],
          overtimeCalcTypeHoliday:
            data.overtimeCalcTypeHoliday as Prisma.UserCreateInput["overtimeCalcTypeHoliday"],
          overtimeCalcTypeNational:
            data.overtimeCalcTypeNational as Prisma.UserCreateInput["overtimeCalcTypeNational"],
        },
      });

      // 2. Create userSites if provided
      if (userSites.length > 0) {
        await tx.userSite.createMany({
          data: userSites.map((userSite) => ({
            userId,
            siteId: userSite.siteId,
            isPrimary: userSite.isPrimary || false,
          })),
        });

        // 3. Update user.siteId with primary site
        const primarySite = userSites.find((us) => us.isPrimary);
        if (primarySite) {
          await tx.user.update({
            where: { id: userId },
            data: { siteId: primarySite.siteId },
          });
        }
      }

      return newUser;
    });

    return UserMapper.toDomain(user);
  }

  /** Perbarui user yang ada. */
  async update(
    id: string,
    data: UpdateUserRepositoryInput,
  ): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: { ...(data as Prisma.UserUpdateInput), updatedAt: new Date() },
    });

    return UserMapper.toDomain(user);
  }

  /** Hapus user dan kembalikan entity terakhirnya. */
  async delete(id: string): Promise<UserEntity> {
    const user = await prisma.user.delete({ where: { id } });
    return UserMapper.toDomain(user);
  }

  /** Sinkronkan assignment multi-site user. */
  async syncUserSites(
    userId: string,
    userSites: Array<{ siteId: string; isPrimary?: boolean }>,
  ): Promise<void> {
    if (userSites.length === 0) {
      return;
    }

    await prisma.userSite.createMany({
      data: userSites.map((userSite) => ({
        userId,
        siteId: userSite.siteId,
        isPrimary: userSite.isPrimary || false,
      })),
    });

    const primarySite = userSites.find((userSite) => userSite.isPrimary);
    if (!primarySite) {
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { siteId: primarySite.siteId },
    });
  }

  /** Perbarui jam kerja user. */
  async updateWorkingHours(
    id: string,
    data: UserScheduleEntity,
  ): Promise<UserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: UserMapper.toWorkingHoursUpdate(data),
    });

    return UserMapper.toDomain(user);
  }
}
