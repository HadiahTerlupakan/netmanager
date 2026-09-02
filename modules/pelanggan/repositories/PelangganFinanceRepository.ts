import { prisma } from "@/lib/prisma";
import type { PrismaClient, Pelanggan, Settings, Status } from "@prisma/client";

export class PelangganFinanceRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findById(id: string): Promise<Pelanggan | null> {
    return this.client.pelanggan.findUnique({ where: { id } });
  }

  async findOverdueActiveCustomers(today: Date): Promise<Pelanggan[]> {
    return this.client.pelanggan.findMany({
      where: { status: "AKTIF", autoIsolir: true, jatuhTempo: { lt: today } },
    });
  }

  async updateStatus(id: string, status: Status): Promise<Pelanggan> {
    return this.client.pelanggan.update({
      where: { id },
      data: { status },
    });
  }

  async updateJatuhTempo(id: string, jatuhTempo: Date): Promise<Pelanggan> {
    return this.client.pelanggan.update({
      where: { id },
      data: { jatuhTempo },
    });
  }

  async findWithHargaPaket(id: string) {
    return this.client.pelanggan.findUnique({
      where: { id },
      include: { hargaPaket: true },
    });
  }
}

export class MainSettingsRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findByKey(key: string): Promise<Settings | null> {
    return this.client.settings.findFirst({ where: { key } });
  }

  async findManyByKeys(keys: string[]): Promise<Settings[]> {
    return this.client.settings.findMany({
      where: { key: { in: keys } },
    });
  }

  async findManyByKeyPattern(pattern: string): Promise<Settings[]> {
    return this.client.settings.findMany({
      where: { key: { contains: pattern, mode: "insensitive" } },
    });
  }
}
