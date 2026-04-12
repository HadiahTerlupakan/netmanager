import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  IUserRepository,
  UserCreateData,
  UserUpdateData,
  UserPublic,
  UserWithPassword,
} from "./IUserRepository";
import { prisma } from "@/lib/prisma";

export class UserRepository implements IUserRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<UserPublic[]> {
    const users = await this.client.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        departmentId: true,
        siteId: true,
        isActive: true,
        createdAt: true,
      },
    });
    return users;
  }

  async findById(id: string): Promise<UserPublic | null> {
    const user = await this.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        departmentId: true,
        siteId: true,
        isActive: true,
        createdAt: true,
      },
    });
    return user;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await this.client.user.findUnique({
      where: {
        email,
        passwordHash: { not: null }, // Only find users with password
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        departmentId: true,
        siteId: true,
        isActive: true,
        createdAt: true,
        passwordHash: true,
      },
    });
    if (!user || !user.passwordHash) {
      return null;
    }
    return {
      ...user,
      passwordHash: user.passwordHash, // Type assertion that it's not null
    };
  }

  async create(data: UserCreateData): Promise<{ id: string }> {
    const user = await this.client.user.create({
      data: {
        id: randomUUID(),
        ...data,
        name: data.name ?? null,
        phone: data.phone ?? null,
        departmentId: data.departmentId ?? null,
        siteId: data.siteId ?? null,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
    return user;
  }

  async update(id: string, data: UserUpdateData): Promise<void> {
    await this.client.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.user.delete({
      where: { id },
    });
  }

  async count(): Promise<number> {
    return await this.client.user.count();
  }

  async findManyWithFullDetails(userIds: string[]): Promise<
    Array<{
      id: string;
      name: string | null;
      image: string | null;
      role: { name: string } | null;
      sites: { name: string } | null;
      departments: { name: string } | null;
    }>
  > {
    return this.client.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        image: true,
        role: { select: { name: true } },
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });
  }
}
