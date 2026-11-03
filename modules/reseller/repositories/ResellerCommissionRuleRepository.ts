import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CommissionRuleScope,
  CommissionRuleWindow,
  CreateCommissionRuleData,
  IResellerCommissionRuleRepository,
  UpdateCommissionRuleData,
} from "../domain/ports/IResellerCommissionRuleRepository";
import type {
  ResellerCommissionRuleEntity,
  ResellerCommissionRuleListItem,
} from "../domain/entities/ResellerCommissionEntity";
import { toRateNumber, withNumericRate } from "./commission-rate-mapper";

const ACTIVE_STATUS = "ACTIVE";
const RULE_LOCK_PREFIX = "reseller-commission-rule";

type RuleDb = PrismaClient | Prisma.TransactionClient;

export class ResellerCommissionRuleRepository implements IResellerCommissionRuleRepository {
  /**
   * @param db klien untuk query (bisa klien transaksi dari `runExclusive`).
   * @param root klien akar untuk membuka transaksi baru.
   */
  constructor(
    private readonly db: RuleDb = prisma,
    private readonly root: PrismaClient = prisma,
  ) {}

  /**
   * Kunci advisory per tenant+reseller+paket selama transaksi. Pola cek-lalu-
   * insert tanpa kunci membiarkan dua POST bersamaan sama-sama lolos cek
   * bentrok dan membuat dua aturan ACTIVE yang beririsan.
   */
  async runExclusive<T>(
    scope: CommissionRuleScope,
    work: (repository: IResellerCommissionRuleRepository) => Promise<T>,
  ): Promise<T> {
    const lockKey = [
      RULE_LOCK_PREFIX,
      scope.tenantId,
      scope.resellerId,
      scope.hargaPaketId ?? "",
    ].join(":");
    return this.root.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return work(new ResellerCommissionRuleRepository(tx, this.root));
    });
  }

  /** Aturan reseller terbaru dulu, beserta nama paketnya. */
  async listByReseller(
    tenantId: string,
    resellerId: string,
  ): Promise<readonly ResellerCommissionRuleListItem[]> {
    const rows = await this.db.resellerCommissionRule.findMany({
      where: { tenantId, resellerId, deletedAt: null },
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      include: { hargaPaket: { select: { name: true } } },
    });
    return rows.map(({ hargaPaket, ...rule }) => ({
      ...rule,
      rate: toRateNumber(rule.rate),
      hargaPaketName: hargaPaket?.name ?? null,
    }));
  }

  /** Aturan milik reseller di tenant. */
  async findById(
    tenantId: string,
    resellerId: string,
    ruleId: string,
  ): Promise<ResellerCommissionRuleEntity | null> {
    const rule = await this.db.resellerCommissionRule.findFirst({
      where: { id: ruleId, tenantId, resellerId, deletedAt: null },
    });
    return rule ? withNumericRate(rule) : null;
  }

  /**
   * Dua rentang [mulai, akhir] beririsan bila masing-masing mulai sebelum
   * yang lain berakhir; akhir null berarti tanpa batas.
   */
  async findOverlappingActiveRule(
    window: CommissionRuleWindow,
  ): Promise<ResellerCommissionRuleEntity | null> {
    const where: Prisma.ResellerCommissionRuleWhereInput = {
      tenantId: window.tenantId,
      resellerId: window.resellerId,
      hargaPaketId: window.hargaPaketId,
      status: ACTIVE_STATUS,
      deletedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gte: window.startsAt } }],
      ...(window.endsAt ? { startsAt: { lte: window.endsAt } } : {}),
      ...(window.excludeRuleId ? { id: { not: window.excludeRuleId } } : {}),
    };
    const rule = await this.db.resellerCommissionRule.findFirst({ where });
    return rule ? withNumericRate(rule) : null;
  }

  /** Simpan aturan baru (ACTIVE). */
  async create(
    data: CreateCommissionRuleData,
  ): Promise<ResellerCommissionRuleEntity> {
    const rule = await this.db.resellerCommissionRule.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        resellerId: data.resellerId,
        hargaPaketId: data.hargaPaketId,
        type: data.type,
        rate: data.rate,
        fixedAmount: data.fixedAmount,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      },
    });
    return withNumericRate(rule);
  }

  /** Ubah aturan; pemanggil sudah memastikan aturan milik tenant. */
  async update(
    ruleId: string,
    data: UpdateCommissionRuleData,
  ): Promise<ResellerCommissionRuleEntity> {
    const rule = await this.db.resellerCommissionRule.update({
      where: { id: ruleId },
      data,
    });
    return withNumericRate(rule);
  }

  /** Reseller ada (belum dihapus) di tenant. */
  async resellerExists(tenantId: string, resellerId: string): Promise<boolean> {
    const reseller = await this.db.reseller.findFirst({
      where: { id: resellerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    return reseller !== null;
  }

  /** Paket ada di tenant. */
  async packageExists(
    tenantId: string,
    hargaPaketId: string,
  ): Promise<boolean> {
    const hargaPaket = await this.db.hargaPaket.findFirst({
      where: { id: hargaPaketId, tenantId },
      select: { id: true },
    });
    return hargaPaket !== null;
  }
}
