import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type {
  CreateEndorsementInput,
  EndorsementListFilters,
  IEndorsementRepository,
  RecordEventInput,
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
   * Memakai `prismaUnsafe`? Tidak — pencarian ini tetap lewat klien yang sama;
   * penanda tangan pihak luar tidak punya konteks tenant, jadi rutenya berjalan
   * dalam konteks sistem yang ditetapkan pemanggil.
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

  async updateStatus(
    id: string,
    status: EndorsementStatus,
    extra?: {
      completedAt?: Date;
      cancelledAt?: Date;
      cancelReason?: string;
      signedFileKey?: string;
      signedFileHash?: string;
    },
  ): Promise<void> {
    await prisma.endorsement.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  async updateSigner(
    signerId: string,
    data: {
      status?: SignerStatus;
      signatureKey?: string;
      viewedAt?: Date;
      signedAt?: Date;
      declinedAt?: Date;
      declineReason?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    await prisma.endorsementSigner.update({ where: { id: signerId }, data });
  }

  async recordEvent(input: RecordEventInput): Promise<void> {
    await prisma.endorsementEvent.create({
      data: {
        endorsementId: input.endorsementId,
        signerId: input.signerId,
        type: input.type,
        metadata: input.metadata as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findExpiredIds(now: Date): Promise<string[]> {
    const rows = await prisma.endorsement.findMany({
      where: { status: "SENT", expiresAt: { lt: now } },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }
}
