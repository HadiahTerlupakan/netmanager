import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

const mockFns = vi.hoisted(() => ({
  getMobileAuthPayload: vi.fn(),
  repoFindAll: vi.fn(),
  repoCreate: vi.fn(),
  findRequesterContext: vi.fn(),
  findApproverIdsForMobileLeaveNotification: vi.fn(),
  hasEnoughDays: vi.fn(),
  getRemainingDays: vi.fn(),
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
  convertAndSaveBase64: vi.fn(),
  mobileLeaveRequestServiceCreate: vi.fn(),
}));

vi.mock("@/lib/mobile-api-auth", () => ({
  getMobileAuthPayload: mockFns.getMobileAuthPayload,
}));

vi.mock("@/modules/attendance/repositories/LeaveRepository", () => ({
  LeaveRepository: class MockLeaveRepository {
    findAll = mockFns.repoFindAll;
    create = mockFns.repoCreate;
    findRequesterContext = mockFns.findRequesterContext;
    findApproverIdsForMobileLeaveNotification =
      mockFns.findApproverIdsForMobileLeaveNotification;
  },
}));

vi.mock("@/modules/attendance/repositories/LeaveBalanceRepository", () => ({
  LeaveBalanceRepository: class MockLeaveBalanceRepository {
    hasEnoughDays = mockFns.hasEnoughDays;
    getRemainingDays = mockFns.getRemainingDays;
  },
}));

vi.mock("@/modules/notification/services/NotificationService", () => ({
  createNotification: mockFns.createNotification,
}));

vi.mock("@/lib/utils/image-upload", () => ({
  convertAndSaveBase64: mockFns.convertAndSaveBase64,
  convertAndSaveImage: mockFns.convertAndSaveBase64,
  uploadInventoryPhotos: vi.fn(),
}));

import { POST } from "@/app/api/mobile/leaves/route";

describe("mobile leaves route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getMobileAuthPayload.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
    });
    mockFns.hasEnoughDays.mockResolvedValue(true);
    mockFns.repoCreate.mockResolvedValue({ id: "leave-1" });
    mockFns.findRequesterContext.mockResolvedValue({
      workingHourMode: "REGULAR",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      name: "Budi",
      siteId: "site-1",
    });
    mockFns.findApproverIdsForMobileLeaveNotification.mockResolvedValue([
      { id: "admin-1" },
    ]);
  });

  it("scopes admin leave notifications to the requester site", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      workingHourMode: "REGULAR",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      name: "Budi",
      siteId: "site-1",
    });
    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/leaves", {
        method: "POST",
        body: JSON.stringify({
          type: "CUTI",
          startDate: "2026-03-10",
          endDate: "2026-03-10",
          reason: "Keperluan keluarga",
          photos: [],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(
      mockFns.findApproverIdsForMobileLeaveNotification,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      siteId: "site-1",
    });
    expect(mockFns.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        sourceType: "LEAVE",
        sourceId: "leave-1",
        tenantId: "tenant-1",
      }),
    );
  });

  it("uses working-day calculation for leave quota checks", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      workingHourMode: "REGULAR",
      workDays: "Mon,Tue,Wed,Thu,Fri",
      name: "Budi",
      siteId: "site-1",
    });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.holiday.findFirst.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/mobile/leaves", {
        method: "POST",
        body: JSON.stringify({
          type: "CUTI",
          startDate: "2026-03-13",
          endDate: "2026-03-15",
          reason: "Libur keluarga",
          photos: [],
        }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(201);
    expect(mockFns.hasEnoughDays).toHaveBeenCalledWith(
      "user-1",
      2026,
      "CUTI",
      1,
      "tenant-1",
    );
  });
});
