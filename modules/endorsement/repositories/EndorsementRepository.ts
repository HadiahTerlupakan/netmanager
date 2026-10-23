import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type {
  CreateEndorsementInput,
  EndorsementListFilters,
  EndorsementStatusExtra,
  IEndorsementRepository,
  RecordEventInput,
  SignerInboxFilters,
  SignerInboxScope,
  SignerUpdateData,
} from "../domain/ports/IEndorsementRepository";
import type {
  EndorsementEntity,
  EndorsementStatus,
  SignerStatus,
} from "../domain/entities/Endorsement";
import {
  toEndorsementEntity,
  type EndorsementRow,
} from "../mappers/endorsement.mapper";

/**
 * Akses data surat pengesahan.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak bergantung pada pemanggil.
 */

const SIGNER_ORDER: Prisma.EndorsementSignerOrderByWithRelationInput[] = [
  { order: "asc" },
  { createdAt: "asc" },
];

const withSigners = {
  signers: { orderBy: SIGNER_ORDER },
} satisfies Prisma.EndorsementInclude;

const UNDECIDED_SIGNER_STATUSES = ["PENDING", "VIEWED"];

/** Surat yang masih menunggu tanda tangan user ini dan masih bisa ditandatangani. */
function buildWaitingForUserWhere(
  userId: string,
  now: Date,
): Prisma.EndorsementWhereInput {
  return {
    status: "SENT",
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    signers: { some: { userId, status: { in: UNDECIDED_SIGNER_STATUSES } } },
  };
}

function buildSignerInboxWhere(
  userId: string,
  scope: SignerInboxScope,
  now: Date,
): Prisma.EndorsementWhereInput {
  const waiting = buildWaitingForUserWhere(userId, now);
  if (scope === "MENUNGGU") return waiting;

  return { signers: { some: { userId } }, NOT: waiting };
}

export class EndorsementRepository implements IEndorsementRepository {
  async findMany(filters: EndorsementListFilters) {
    const where: Prisma.EndorsementWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" } },
              { number: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.endorsement.findMany({
        where,
        include: withSigners,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.endorsement.count({ where }),
    ]);

    return {
      items: rows.map((row) => toEndorsementEntity(row as EndorsementRow)),
      total,
    };
  }

  async findById(id: string): Promise<EndorsementEntity | null> {
    const row = await prisma.endorsement.findUnique({
      where: { id },
      include: withSigners,
    });

    return row ? toEndorsementEntity(row as EndorsementRow) : null;
  }

  /**
   * Cari surat lewat sidik jari token penanda tangan.
   *
   * Penanda tangan pihak luar tidak punya konteks tenant, jadi pemanggil wajib
   * menjalankannya dalam konteks sistem; tenant surat ditentukan oleh token.
   */
  async findByTokenHash(tokenHash: string) {
    const signer = await prisma.endorsementSigner.findUnique({
      where: { tokenHash },
      select: { id: true, endorsementId: true },
    });

    if (!signer) return null;

    const endorsement = await this.findById(signer.endorsementId);
    if (!endorsement) return null;

    return { endorsement, signerId: signer.id };
  }

  async findLastNumber(tenantId: string | null): Promise<string | null> {
    const row = await prisma.endorsement.findFirst({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
      select: { number: true },
    });

    return row?.number ?? null;
  }

  async create(input: CreateEndorsementInput): Promise<EndorsementEntity> {
    const row = await prisma.endorsement.create({
      data: {
        number: input.number,
        title: input.title,
        description: input.description,
        status: "DRAFT",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceFileKey: input.sourceFileKey,
        sourceFileName: input.sourceFileName,
        sourceFileHash: input.sourceFileHash,
        expiresAt: input.expiresAt,
        createdById: input.createdById,
        signers: {
          create: input.signers.map((signer) => ({
            name: signer.name,
            role: signer.role,
            email: signer.email,
            phone: signer.phone,
            userId: signer.userId,
            tokenHash: signer.tokenHash,
            order: signer.order,
          })),
        },
      },
      include: withSigners,
    });

    return toEndorsementEntity(row as EndorsementRow);
  }

  async transitionStatus(
    id: string,
    fromStatuses: EndorsementStatus[],
    status: EndorsementStatus,
    extra?: EndorsementStatusExtra,
  ): Promise<boolean> {
    const { count } = await prisma.endorsement.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: { status, ...extra },
    });

    return count > 0;
  }

  async transitionSigner(
    signerId: string,
    fromStatuses: SignerStatus[],
    data: SignerUpdateData,
  ): Promise<boolean> {
    const { count } = await prisma.endorsementSigner.updateMany({
      where: { id: signerId, status: { in: fromStatuses } },
      data,
    });

    return count > 0;
  }

  async updateSignerTokenHash(
    signerId: string,
    tokenHash: string,
  ): Promise<void> {
    await prisma.endorsementSigner.update({
      where: { id: signerId },
      data: { tokenHash },
    });
  }

  /**
   * Catat jejak audit. `tenantId` diisi eksplisit: jalur penanda tangan pihak
   * luar berjalan dalam konteks sistem, sehingga ekstensi tenant tidak
   * menyuntikkannya dan event akan tersimpan tanpa tenant.
   */
  async recordEvent(input: RecordEventInput): Promise<void> {
    await prisma.endorsementEvent.create({
      data: {
        tenantId: input.tenantId,
        endorsementId: input.endorsementId,
        signerId: input.signerId,
        type: input.type,
        metadata: input.metadata as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findExpired(now: Date) {
    return prisma.endorsement.findMany({
      where: {
        status: "SENT",
        expiresAt: { lt: now },
        // Surat yang sudah ditandatangani semua menunggu finalisasi, bukan
        // kedaluwarsa — menggugurkannya membuang tanda tangan yang sah.
        signers: { some: { status: { not: "SIGNED" } } },
      },
      select: { id: true, tenantId: true },
    });
  }

  async findManyForSignerUser(filters: SignerInboxFilters) {
    const where = buildSignerInboxWhere(
      filters.userId,
      filters.scope,
      filters.now,
    );
    const [rows, total] = await Promise.all([
      prisma.endorsement.findMany({
        where,
        include: withSigners,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.endorsement.count({ where }),
    ]);

    return {
      items: rows.map((row) => toEndorsementEntity(row as EndorsementRow)),
      total,
    };
  }

  async countForSignerUser(userId: string, now: Date) {
    const [waitingCount, totalCount] = await Promise.all([
      prisma.endorsement.count({ where: buildWaitingForUserWhere(userId, now) }),
      prisma.endorsement.count({ where: { signers: { some: { userId } } } }),
    ]);

    return { waitingCount, totalCount };
  }

  async findFullySignedOpenIds(): Promise<string[]> {
    const rows = await prisma.endorsement.findMany({
      where: {
        status: "SENT",
        signers: { some: {}, every: { status: "SIGNED" } },
      },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
