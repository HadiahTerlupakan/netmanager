import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export class InvestorRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findAll() {
    return this.client.investor.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { rabProjects: true },
        },
      },
    });
  }

  async findById(id: string) {
    return this.client.investor.findUnique({ where: { id } });
  }

  async findByIdWithCounts(id: string) {
    return this.client.investor.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rabProjects: true, payouts: true },
        },
      },
    });
  }

  async findByUsername(username: string) {
    return this.client.investor.findUnique({ where: { username } });
  }

  async findByUsernameInsensitive(username: string) {
    return this.client.investor.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });
  }

  async findByEmail(email: string) {
    return this.client.investor.findUnique({ where: { email } });
  }

  async create(data: Prisma.InvestorCreateInput) {
    return this.client.investor.create({ data });
  }

  async update(id: string, data: Prisma.InvestorUpdateInput) {
    return this.client.investor.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.client.investor.delete({ where: { id } });
  }
}
