import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

import { EmailDeliveryLogRepository } from "@/modules/notification/repositories/EmailDeliveryLogRepository";

describe("EmailDeliveryLogRepository", () => {
  let repo: EmailDeliveryLogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new EmailDeliveryLogRepository();
  });

  describe("logAttempt", () => {
    it("membuat record dengan status PENDING dan return id", async () => {
      prismaMock.emailDeliveryLog.create.mockResolvedValue({
        id: "log-1",
        to: "user@test.id",
        subject: "Test Subject",
        status: "PENDING",
        provider: "SMTP",
        messageId: null,
        error: null,
        sentAt: null,
        bouncedAt: null,
        tenantId: null,
        createdAt: new Date(),
      });

      const id = await repo.logAttempt({
        to: "user@test.id",
        subject: "Test Subject",
        tenantId: null,
      });

      expect(id).toBe("log-1");
      expect(prismaMock.emailDeliveryLog.create).toHaveBeenCalledWith({
        data: {
          to: "user@test.id",
          subject: "Test Subject",
          status: "PENDING",
          tenantId: null,
        },
      });
    });

    it("menyimpan tenantId jika diberikan", async () => {
      prismaMock.emailDeliveryLog.create.mockResolvedValue({
        id: "log-2",
        to: "user@test.id",
        subject: "Subject",
        status: "PENDING",
        provider: "SMTP",
        messageId: null,
        error: null,
        sentAt: null,
        bouncedAt: null,
        tenantId: "tenant-1",
        createdAt: new Date(),
      });

      await repo.logAttempt({
        to: "user@test.id",
        subject: "Subject",
        tenantId: "tenant-1",
      });

      expect(prismaMock.emailDeliveryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId: "tenant-1" }),
      });
    });
  });

  describe("markSent", () => {
    it("update status ke SENT dengan sentAt dan messageId", async () => {
      prismaMock.emailDeliveryLog.update.mockResolvedValue({} as never);

      await repo.markSent("log-1", "msg-abc");

      expect(prismaMock.emailDeliveryLog.update).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: {
          status: "SENT",
          sentAt: expect.any(Date),
          messageId: "msg-abc",
        },
      });
    });

    it("set messageId null jika tidak diberikan", async () => {
      prismaMock.emailDeliveryLog.update.mockResolvedValue({} as never);

      await repo.markSent("log-1");

      expect(prismaMock.emailDeliveryLog.update).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: expect.objectContaining({ messageId: null }),
      });
    });
  });

  describe("markFailed", () => {
    it("update status ke FAILED dengan pesan error berformat kategori", async () => {
      prismaMock.emailDeliveryLog.update.mockResolvedValue({} as never);

      await repo.markFailed("log-1", "Autentikasi SMTP gagal", "AUTH");

      expect(prismaMock.emailDeliveryLog.update).toHaveBeenCalledWith({
        where: { id: "log-1" },
        data: { status: "FAILED", error: "[AUTH] Autentikasi SMTP gagal" },
      });
    });
  });
});
