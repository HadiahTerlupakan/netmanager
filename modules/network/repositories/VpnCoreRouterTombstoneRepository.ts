import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";

/** Akses database untuk antrean penghapusan router core. */
export class VpnCoreRouterTombstoneRepository implements IVpnCoreRouterTombstoneRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Mencatat id router core; mencatat id yang sama dua kali tidak berefek. */
  async add(coreRouterId: string): Promise<void> {
    await this.client.vpnCoreRouterTombstone.upsert({
      where: { coreRouterId },
      create: { coreRouterId },
      update: {},
    });
  }

  /** Id router core yang paling lama menunggu, paling lama lebih dulu. */
  async listOldest(limit: number): Promise<string[]> {
    const rows = await this.client.vpnCoreRouterTombstone.findMany({
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((row) => row.coreRouterId);
  }

  /** Menghapus catatan; tidak gagal bila catatan sudah tidak ada. */
  async remove(coreRouterId: string): Promise<void> {
    await this.client.vpnCoreRouterTombstone.deleteMany({
      where: { coreRouterId },
    });
  }
}
