import { PrismaClient, Role } from '@prisma/client'
import type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
import { prisma } from '@/lib/prisma'

export class UserRepository implements IUserRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findAll(): Promise<UserPublic[]> {
    const users = await this.client.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })
    return users
  }

  async findById(id: string): Promise<UserPublic | null> {
    const user = await this.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    })
    return user
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const user = await this.client.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        passwordHash: true,
      },
    })
    return user
  }

  async create(data: UserCreateData): Promise<{ id: string }> {
    const user = await this.client.user.create({
      data,
      select: { id: true },
    })
    return user
  }

  async update(id: string, data: UserUpdateData): Promise<void> {
    await this.client.user.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.client.user.delete({
      where: { id },
    })
  }

  async count(): Promise<number> {
    return await this.client.user.count()
  }

  async countByRole(role: Role): Promise<number> {
    return await this.client.user.count({
      where: { role },
    })
  }
}

