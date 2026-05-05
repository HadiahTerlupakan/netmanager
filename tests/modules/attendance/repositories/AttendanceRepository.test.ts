import { describe, it, expect, beforeEach, vi } from "vitest";
import { AttendanceRepository } from "@/modules/attendance/repositories/AttendanceRepository";
import { prisma } from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe("AttendanceRepository", () => {
  let attendanceRepository: AttendanceRepository;

  const mockAttendance = {
    id: "att-1",
    userId: "user-1",
    tenantId: "tenant-1",
    checkIn: new Date("2026-05-05T08:00:00Z"),
    checkOut: new Date("2026-05-05T17:00:00Z"),
    status: "present",
    photoCheckIn: "photo1.jpg",
    photoCheckOut: "photo2.jpg",
    locationCheckIn: "Office",
    locationCheckOut: "Office",
    latitudeCheckIn: -6.2088,
    longitudeCheckIn: 106.8456,
    latitudeCheckOut: -6.2088,
    longitudeCheckOut: 106.8456,
    notesCheckIn: "Check in",
    notesCheckOut: "Check out",
    createdAt: new Date("2026-05-05T08:00:00Z"),
    updatedAt: new Date("2026-05-05T17:00:00Z"),
  };

  beforeEach(() => {
    attendanceRepository = new AttendanceRepository();
    vi.clearAllMocks();
  });

  describe("findMany", () => {
    it("harus return list of attendances", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([
        mockAttendance,
      ] as never);

      const result = await attendanceRepository.findMany({
        where: { userId: "user-1" },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("att-1");
      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("harus filter by tenantId", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([
        mockAttendance,
      ] as never);

      await attendanceRepository.findMany({
        where: { tenantId: "tenant-1" },
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
      });
    });

    it("harus filter by date range", async () => {
      const startDate = new Date("2026-05-01");
      const endDate = new Date("2026-05-31");

      vi.mocked(prisma.attendance.findMany).mockResolvedValue([
        mockAttendance,
      ] as never);

      await attendanceRepository.findMany({
        where: {
          checkIn: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: {
          checkIn: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });
  });

  describe("findUnique", () => {
    it("harus return attendance by id", async () => {
      vi.mocked(prisma.attendance.findUnique).mockResolvedValue(
        mockAttendance as never,
      );

      const result = await attendanceRepository.findUnique({
        where: { id: "att-1" },
      });

      expect(result?.id).toBe("att-1");
      expect(prisma.attendance.findUnique).toHaveBeenCalledWith({
        where: { id: "att-1" },
      });
    });

    it("harus return null jika tidak ditemukan", async () => {
      vi.mocked(prisma.attendance.findUnique).mockResolvedValue(null);

      const result = await attendanceRepository.findUnique({
        where: { id: "att-999" },
      });

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("harus create attendance", async () => {
      const createData = {
        id: "att-new",
        userId: "user-1",
        tenantId: "tenant-1",
        checkIn: new Date("2026-05-05T08:00:00Z"),
        status: "present" as AttendanceStatus,
        photoCheckIn: "photo1.jpg",
        locationCheckIn: "Office",
        updatedAt: new Date("2026-05-05T08:00:00Z"),
      };

      vi.mocked(prisma.attendance.create).mockResolvedValue(
        mockAttendance as never,
      );

      const result = await attendanceRepository.create(createData);

      expect(result.id).toBe("att-1");
      expect(prisma.attendance.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  describe("update", () => {
    it("harus update attendance", async () => {
      const updateData = {
        checkOut: new Date("2026-05-05T17:00:00Z"),
        photoCheckOut: "photo2.jpg",
        locationCheckOut: "Office",
      };

      const updatedAttendance = {
        ...mockAttendance,
        ...updateData,
      };

      vi.mocked(prisma.attendance.update).mockResolvedValue(
        updatedAttendance as never,
      );

      const result = await attendanceRepository.update("att-1", updateData);

      expect(result.checkOut).toEqual(updateData.checkOut);
      expect(prisma.attendance.update).toHaveBeenCalledWith({
        where: { id: "att-1" },
        data: updateData,
      });
    });
  });

  describe("deleteMany", () => {
    it("harus delete attendances by filter", async () => {
      vi.mocked(prisma.attendance.deleteMany).mockResolvedValue({
        count: 1,
      } as never);

      await attendanceRepository.deleteMany({ userId: "user-1" });

      expect(prisma.attendance.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });
  });

  describe("findMany with pagination", () => {
    it("harus support pagination", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([
        mockAttendance,
      ] as never);

      await attendanceRepository.findMany({
        skip: 10,
        take: 20,
        where: { userId: "user-1" },
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 20,
        where: { userId: "user-1" },
      });
    });

    it("harus support ordering", async () => {
      vi.mocked(prisma.attendance.findMany).mockResolvedValue([
        mockAttendance,
      ] as never);

      await attendanceRepository.findMany({
        where: { userId: "user-1" },
        orderBy: { checkIn: "desc" },
      });

      expect(prisma.attendance.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { checkIn: "desc" },
      });
    });
  });
});
