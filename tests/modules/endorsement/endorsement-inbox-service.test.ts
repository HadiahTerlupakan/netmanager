import { describe, expect, it, vi } from "vitest";
import { EndorsementInboxService } from "@/modules/endorsement/services/EndorsementInboxService";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "@/modules/endorsement";

/**
 * Kotak masuk penanda tangan internal di aplikasi mobile: hak aksesnya adalah
 * "ditunjuk di surat ini", jadi setiap jalur harus tersaring per user.
 */

const signer = (
  over: Partial<EndorsementSignerEntity> = {},
): EndorsementSignerEntity => ({
  id: "signer-1",
  endorsementId: "end-1",
  name: "Direktur",
  role: "Direktur Utama",
  email: "dir@contoh.id",
  phone: "0812",
  userId: "user-9",
  status: "PENDING",
  signatureKey: null,
  viewedAt: null,
  signedAt: null,
  declinedAt: null,
  declineReason: null,
  order: 0,
  ...over,
});

const endorsement = (over: Partial<EndorsementEntity> = {}): EndorsementEntity => ({
  id: "end-1",
  number: "PGS/202610/0001",
  title: "Kontrak Kerja Sama",
  description: null,
  status: "SENT",
  sourceType: "UPLOAD",
  sourceId: null,
  sourceFileKey: "kunci-sumber",
  sourceFileName: "kontrak.pdf",
  sourceFileHash: "a".repeat(64),
  signedFileKey: null,
  signedFileHash: null,
  expiresAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdById: "legal-1",
  tenantId: "tenant-1",
  createdAt: new Date("2026-10-04T00:00:00.000Z"),
  signers: [
    signer(),
    signer({ id: "signer-2", name: "Staff Legal", userId: "user-2", phone: "0899" }),
  ],
  ...over,
});

const buildDeps = () => {
  const repository = {
    countForSignerUser: vi.fn().mockResolvedValue({ waitingCount: 1, totalCount: 3 }),
    findManyForSignerUser: vi
      .fn()
      .mockResolvedValue({ items: [endorsement()], total: 1 }),
  };
  const endorsements = {
    resolveForUser: vi.fn(async () => ({
      endorsement: endorsement(),
      signer: signer(),
    })),
    markSignerViewed: vi.fn(),
    readDocumentFor: vi.fn().mockResolvedValue({ buffer: Buffer.from("pdf"), fileName: "kontrak.pdf" }),
    signAs: vi.fn().mockResolvedValue({ completed: true }),
    declineAs: vi.fn(),
  };
  const service = new EndorsementInboxService(
    repository as never,
    endorsements as never,
  );

  return { repository, endorsements, service };
};

describe("EndorsementInboxService", () => {
  it("menyajikan status penanda tangan milik user sendiri di daftar", async () => {
    const { repository, service } = buildDeps();

    const result = await service.list({
      userId: "user-2",
      scope: "MENUNGGU",
      page: 1,
      limit: 20,
    });

    expect(repository.findManyForSignerUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2", scope: "MENUNGGU" }),
    );
    expect(result.items[0]).toMatchObject({
      id: "end-1",
      mySignerStatus: "PENDING",
      canSign: true,
      signerCount: 2,
      signedCount: 0,
    });
  });

  it("detail menandai sudah dibuka dan tidak membocorkan kontak penanda tangan lain", async () => {
    const { endorsements, service } = buildDeps();

    const detail = await service.detail("end-1", "user-9", { ipAddress: "1.1.1.1" });

    expect(endorsements.markSignerViewed).toHaveBeenCalled();
    expect(detail.signers.find((item) => item.isMe)?.id).toBe("signer-1");
    expect(JSON.stringify(detail)).not.toContain("0899");
  });

  // Tombol "Lihat dokumen" mengikuti aturan yang sama dengan endpoint berkas,
  // supaya surat yang gugur tidak menawarkan unduhan yang pasti ditolak.
  it("detail menandai dokumen tidak bisa dibuka pada surat yang dibatalkan", async () => {
    const { endorsements, service } = buildDeps();
    endorsements.resolveForUser.mockResolvedValue({
      endorsement: endorsement({ status: "CANCELLED" }),
      signer: signer(),
    });

    const detail = await service.detail("end-1", "user-9", {});

    expect(detail.canViewDocument).toBe(false);
  });

  it("tanda tangan memakai penanda tangan hasil resolusi sesi user", async () => {
    const { endorsements, service } = buildDeps();

    const result = await service.sign("end-1", "user-9", {
      buffer: Buffer.from("png"),
      context: {},
    });

    expect(endorsements.resolveForUser).toHaveBeenCalledWith("end-1", "user-9");
    expect(endorsements.signAs).toHaveBeenCalled();
    expect(result).toEqual({ completed: true });
  });

  it("penolakan meneruskan alasan", async () => {
    const { endorsements, service } = buildDeps();

    await service.decline("end-1", "user-9", { reason: "Nilai salah", context: {} });

    expect(endorsements.declineAs).toHaveBeenCalledWith(
      expect.anything(),
      "Nilai salah",
      {},
    );
  });

  it("ringkasan diambil per user", async () => {
    const { repository, service } = buildDeps();

    expect(await service.summary("user-9")).toEqual({ waitingCount: 1, totalCount: 3 });
    expect(repository.countForSignerUser).toHaveBeenCalledWith("user-9", expect.any(Date));
  });
});
