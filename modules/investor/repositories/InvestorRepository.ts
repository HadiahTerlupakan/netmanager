import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Batas perangkat per investor; token tertua dibuang lebih dulu. */
const MAKS_FCM_TOKEN_INVESTOR = 5;

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

  /** Akun investor untuk login mobile: cocok username atau email, abaikan huruf besar. */
  async findByLoginIdentifier(identifier: string) {
    return this.client.investor.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });
  }

  /** Mencabut semua token mobile investor (logout) dengan menaikkan tokenVersion. */
  async incrementTokenVersion(id: string) {
    return this.client.investor.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true },
    });
  }

  /** Token FCM perangkat investor (kosong bila belum pernah login di HP). */
  async findFcmTokens(id: string): Promise<string[]> {
    const investor = await this.client.investor.findUnique({
      where: { id },
      select: { fcmTokens: true, isActive: true },
    });
    return investor?.isActive ? investor.fcmTokens : [];
  }

  /**
   * Daftarkan token FCM ke investor. Token yang sama dilepas dari investor
   * lain (HP dipakai bergantian), dan hanya `MAKS_FCM_TOKEN_INVESTOR` token
   * terbaru yang disimpan. Mengembalikan false bila investor tidak ada.
   */
  async addFcmToken(id: string, token: string): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const investor = await tx.investor.findUnique({
        where: { id },
        select: { fcmTokens: true },
      });
      if (!investor) return false;

      const pemilikLain = await tx.investor.findMany({
        where: { id: { not: id }, fcmTokens: { has: token } },
        select: { id: true, fcmTokens: true },
      });
      for (const lain of pemilikLain) {
        await tx.investor.update({
          where: { id: lain.id },
          data: { fcmTokens: { set: lain.fcmTokens.filter((t) => t !== token) } },
        });
      }

      const tokens = [...investor.fcmTokens.filter((t) => t !== token), token];
      await tx.investor.update({
        where: { id },
        data: {
          fcmTokens: { set: tokens.slice(-MAKS_FCM_TOKEN_INVESTOR) },
          pushTokenUpdatedAt: new Date(),
        },
      });
      return true;
    });
  }

  /** Lepas token FCM dari investor (logout di HP itu). */
  async removeFcmToken(id: string, token: string): Promise<void> {
    const investor = await this.client.investor.findUnique({
      where: { id },
      select: { fcmTokens: true },
    });
    if (!investor?.fcmTokens.includes(token)) return;
    await this.client.investor.update({
      where: { id },
      data: { fcmTokens: { set: investor.fcmTokens.filter((t) => t !== token) } },
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
