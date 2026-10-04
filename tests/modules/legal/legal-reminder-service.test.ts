import { beforeEach, describe, expect, it, vi } from "vitest";

const createNotification = vi.hoisted(() => vi.fn());
vi.mock("@/modules/notification", () => ({ createNotification }));

import { LegalReminderService } from "@/modules/legal/services/LegalReminderService";
import { buildLegalRepository, legalDocument, wib } from "./legal-fixtures";

/**
 * Pengingat harus sampai tepat sekali per tenggat per ambang — cron yang
 * berjalan ulang tidak boleh mengirim dobel, dan dokumen yang baru diinput
 * dekat tenggat langsung mendapat ambang yang sesuai.
 */

const NOW = new Date("2026-10-04T03:00:00.000Z");
let repository: ReturnType<typeof buildLegalRepository>;

beforeEach(() => {
  vi.clearAllMocks();
  repository = buildLegalRepository();
});

const run = () => new LegalReminderService(repository as never).run(NOW);

describe("LegalReminderService", () => {
  it("mengirim ambang terketat yang berlaku dan mencatatnya", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ endDate: wib("2026-10-24") }),
    ]);

    expect(await run()).toBe(1);
    expect(repository.recordReminder).toHaveBeenCalledWith({
      documentId: "doc-1",
      deadlineKey: "END:2026-10-24",
      threshold: "H30",
      tenantId: "tenant-1",
    });
  });

  it("tidak mengirim ulang pengingat yang sudah tercatat", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ endDate: wib("2026-10-24") }),
    ]);
    repository.recordReminder.mockResolvedValue(false);

    expect(await run()).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("mengirim ke PIC dan pembuat, tanpa dobel bila orangnya sama", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ endDate: wib("2026-10-08"), pic: { id: "admin-1", name: "Admin" } }),
    ]);

    await run();

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        priority: "HIGH",
        link: "/admin/legal/dokumen/doc-1",
        sourceType: "LEGAL_DOCUMENT",
        tenantId: "tenant-1",
      }),
    );
  });

  it("dokumen kedaluwarsa diingatkan mingguan; tenggat lain yang lewat tidak", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({
        endDate: wib("2026-09-01"),
        guaranteeEndDate: wib("2026-09-15"),
      }),
    ]);

    expect(await run()).toBe(1);
    expect(repository.recordReminder).toHaveBeenCalledWith(
      expect.objectContaining({ deadlineKey: "END:2026-09-01", threshold: "OVERDUE:2026-W40" }),
    );
  });

  it("tenggat lebih dari 90 hari belum diingatkan", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ endDate: wib("2027-06-01") }),
    ]);

    expect(await run()).toBe(0);
    expect(repository.recordReminder).not.toHaveBeenCalled();
  });

  it("satu dokumen gagal tidak menghentikan yang lain", async () => {
    repository.findMonitoredDocuments.mockResolvedValue([
      legalDocument({ id: "rusak", endDate: wib("2026-10-04") }),
      legalDocument({ id: "baik", endDate: wib("2026-10-04") }),
    ]);
    repository.recordReminder
      .mockRejectedValueOnce(new Error("db putus"))
      .mockResolvedValue(true);

    expect(await run()).toBe(1);
  });

  it("memindai dokumen rahasia juga — cron berjalan dengan akses penuh", async () => {
    await run();

    expect(repository.findMonitoredDocuments).toHaveBeenCalledWith({
      canViewConfidential: true,
    });
  });
});
