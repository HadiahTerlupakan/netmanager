import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../../setup";

vi.mock("@/modules/database", () => ({
  prisma: prismaMock,
}));

import { NotificationDeadLetterRepository } from "@/modules/notification/repositories/NotificationDeadLetterRepository";

describe("NotificationDeadLetterRepository", () => {
  let repo: NotificationDeadLetterRepository;

  const baseInput = {
    channel: "email" as const,
    pelangganId: "cust-1",
    templateKey: "invoicePaid",
    params: { customerName: "Budi", invoiceNumber: "INV/1", amountDue: 100000 },
    error: "SMTP connection timeout",
    tenantId: "tenant-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new NotificationDeadLetterRepository();
  });

  describe("record", () => {
    it("insert DLQ entry dengan semua field dan return id", async () => {
      prismaMock.notificationDeadLetter.create.mockResolvedValue({
        id: "dlq-1",
        channel: "email",
        pelangganId: "cust-1",
        templateKey: "invoicePaid",
        params: baseInput.params,
        error: "SMTP connection timeout",
        attemptCount: 1,
        lastAttemptAt: new Date(),
        resolvedAt: null,
        tenantId: "tenant-1",
        createdAt: new Date(),
      });

      const id = await repo.record(baseInput);

      expect(id).toBe("dlq-1");
      expect(prismaMock.notificationDeadLetter.create).toHaveBeenCalledWith({
        data: {
          channel: "email",
          pelangganId: "cust-1",
          templateKey: "invoicePaid",
          params: baseInput.params,
          error: "SMTP connection timeout",
          attemptCount: 1,
          lastAttemptAt: expect.any(Date),
          tenantId: "tenant-1",
        },
      });
    });

    it("gunakan attemptCount default 1 jika tidak diberikan", async () => {
      prismaMock.notificationDeadLetter.create.mockResolvedValue({
        id: "dlq-2",
      } as never);

      await repo.record({ ...baseInput, attemptCount: undefined });

      expect(prismaMock.notificationDeadLetter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ attemptCount: 1 }),
      });
    });

    it("set tenantId null jika tidak diberikan", async () => {
      prismaMock.notificationDeadLetter.create.mockResolvedValue({
        id: "dlq-3",
      } as never);

      await repo.record({ ...baseInput, tenantId: undefined });

      expect(prismaMock.notificationDeadLetter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId: null }),
      });
    });
  });

  describe("resolve", () => {
    it("update resolvedAt ke timestamp sekarang", async () => {
      prismaMock.notificationDeadLetter.update.mockResolvedValue({} as never);

      await repo.resolve("dlq-1");

      expect(prismaMock.notificationDeadLetter.update).toHaveBeenCalledWith({
        where: { id: "dlq-1" },
        data: { resolvedAt: expect.any(Date) },
      });
    });
  });

  describe("findUnresolved", () => {
    it("query dengan filter resolvedAt null", async () => {
      prismaMock.notificationDeadLetter.findMany.mockResolvedValue([]);

      await repo.findUnresolved();

      expect(prismaMock.notificationDeadLetter.findMany).toHaveBeenCalledWith({
        where: { resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });

    it("filter per channel jika diberikan", async () => {
      prismaMock.notificationDeadLetter.findMany.mockResolvedValue([]);

      await repo.findUnresolved({ channel: "whatsapp", limit: 20 });

      expect(prismaMock.notificationDeadLetter.findMany).toHaveBeenCalledWith({
        where: { resolvedAt: null, channel: "whatsapp" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    });

    it("return array hasil query", async () => {
      const mockEntry = {
        id: "dlq-1",
        channel: "email",
        pelangganId: "cust-1",
        templateKey: "invoicePaid",
        params: {} as Record<string, unknown>,
        error: "timeout",
        attemptCount: 1,
        lastAttemptAt: new Date(),
        tenantId: null as string | null,
        createdAt: new Date(),
      };
      prismaMock.notificationDeadLetter.findMany.mockResolvedValue([mockEntry]);

      const result = await repo.findUnresolved();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "dlq-1", channel: "email" });
    });
  });
});
