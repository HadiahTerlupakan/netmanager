import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveService } from "@/modules/attendance/services/LeaveService";

const mockLeaveRepo = {
  findApprovedInRangeWithUser: vi.fn(),
  findByIdWithUser: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
};

const mockBalanceRepo = {
  incrementUsed: vi.fn(),
  decrementUsed: vi.fn(),
  hasEnoughDays: vi.fn(),
};

const mockHolidayRepo = {
  isHoliday: vi.fn().mockResolvedValue({ isHoliday: false }),
};

const mockAttendanceRepo = {
  findFirst: vi.fn(),
  createWithId: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};

const mockUserRepo = {
  findWorkScheduleByIdWithTenant: vi.fn(),
};

vi.mock("@/modules/attendance/repositories/LeaveRepository", () => ({
  LeaveRepository: class {
    constructor() {
      Object.assign(this, mockLeaveRepo);
    }
  },
}));

vi.mock("@/modules/attendance/repositories/LeaveBalanceRepository", () => ({
  LeaveBalanceRepository: class {
    constructor() {
      Object.assign(this, mockBalanceRepo);
    }
  },
}));

vi.mock("@/modules/attendance/repositories/HolidayRepository", () => ({
  HolidayRepository: class {
    constructor() {
      Object.assign(this, mockHolidayRepo);
    }
  },
}));

vi.mock("@/modules/attendance/repositories/AttendanceRepository", () => ({
  AttendanceRepository: class {
    constructor() {
      Object.assign(this, mockAttendanceRepo);
    }
  },
}));

vi.mock("@/modules/users/repositories/UserRepository", () => ({
  UserRepository: class {
    constructor() {
      Object.assign(this, mockUserRepo);
    }
  },
}));

vi.mock("@/modules/notification/services/NotificationService", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
  logActivitySafe: vi.fn(),
}));

describe("LeaveService joinDate guard", () => {
  let service: LeaveService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeaveService();
    mockHolidayRepo.isHoliday.mockResolvedValue({ isHoliday: false });
    mockAttendanceRepo.findFirst.mockResolvedValue(null);
    mockAttendanceRepo.createWithId.mockResolvedValue({ id: "att-1" });
  });

  it("skips leave attendance sync before user joinDate", async () => {
    mockLeaveRepo.findApprovedInRangeWithUser.mockResolvedValue([
      {
        id: "leave-1",
        userId: "user-1",
        tenantId: "tenant-1",
        type: "CUTI",
        startDate: new Date("2026-03-03T00:00:00.000Z"),
        endDate: new Date("2026-03-03T00:00:00.000Z"),
        user: {
          id: "user-1",
          workDays: "Mon,Tue,Wed,Thu,Fri",
          joinDate: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
    ]);

    await service.syncApprovedLeaveToAttendanceRange(
      new Date("2026-03-03T00:00:00.000Z"),
      new Date("2026-03-03T00:00:00.000Z"),
      "tenant-1",
    );

    expect(mockAttendanceRepo.createWithId).not.toHaveBeenCalled();
    expect(mockAttendanceRepo.update).not.toHaveBeenCalled();
  });
});
