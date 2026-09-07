import { describe, it, expect } from "vitest";
import {
  buildHolidayNotificationTitle,
  buildHolidayNotificationMessage,
  buildHolidayNotificationLink,
} from "@/modules/notification/services/NotificationService.holiday";

describe("Holiday Notification Helpers", () => {
  describe("buildHolidayNotificationTitle", () => {
    it("should return correct title", () => {
      expect(buildHolidayNotificationTitle()).toBe("🎉 Libur Baru Ditambahkan");
    });
  });

  describe("buildHolidayNotificationMessage", () => {
    it("should build message with date", () => {
      const date = new Date("2026-04-10");
      const message = buildHolidayNotificationMessage(
        "Hari Raya Idul Fitri",
        date,
      );
      expect(message).toContain("Hari Raya Idul Fitri");
      expect(message).toContain("2026");
    });

    it("should build message with description", () => {
      const date = new Date("2026-04-10");
      const message = buildHolidayNotificationMessage(
        "Cuti Bersama",
        date,
        "Libur nasional",
      );
      expect(message).toContain("Cuti Bersama");
      expect(message).toContain("Libur nasional");
    });

    it("should build message without description", () => {
      const date = new Date("2026-08-17");
      const message = buildHolidayNotificationMessage("Hari Kemerdekaan", date);
      expect(message).toContain("Hari Kemerdekaan");
      expect(message).not.toContain("undefined");
    });

    it("should format date in Indonesian locale", () => {
      const date = new Date("2026-12-25");
      const message = buildHolidayNotificationMessage("Natal", date);
      expect(message).toMatch(/Natal - \w+, \d+ \w+ 2026/);
    });
  });

  describe("buildHolidayNotificationLink", () => {
    // `/employee/holidays` bukan rute yang ada — portal karyawan tidak punya
    // halaman hari libur, sehingga penerima notifikasi mendarat di 404.
    // Pesannya sudah memuat tanggal dan keterangan, jadi notifikasi ini
    // informatif tanpa tautan.
    it("tidak menautkan ke halaman yang tidak ada", () => {
      expect(buildHolidayNotificationLink()).toBeUndefined();
    });
  });
});
