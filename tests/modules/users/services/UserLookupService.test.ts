import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserLookupService } from "@/modules/users/services/UserLookupService";

// Mock repositories
const mockUserRepository = {
  findById: vi.fn(),
};

const mockUserLookupRepository = {
  findUserWithSites: vi.fn(),
  getGeofencePolicy: vi.fn(),
  findActiveForAttendance: vi.fn(),
  findActiveWithPushTokenAndSchedule: vi.fn(),
  findFixedHourUsersForAutoAlpha: vi.fn(),
  findWorkScheduleByIdWithTenant: vi.fn(),
  findWorkScheduleById: vi.fn(),
  findAttendanceSettingsById: vi.fn(),
  findManyWithWorkConfig: vi.fn(),
  findManyWithBasicInfo: vi.fn(),
  findManyWithFullDetails: vi.fn(),
  findWithSitesById: vi.fn(),
  findByIdWithSite: vi.fn(),
  findAdminsForNotification: vi.fn(),
  findByIdWithDepartment: vi.fn(),
  findByIdWithPushToken: vi.fn(),
  findManyWithCustomWhere: vi.fn(),
  findManyWithDetailedRelations: vi.fn(),
  findManyWithPushToken: vi.fn(),
  clearPushTokens: vi.fn(),
  findManyWithPushTokenAndFilter: vi.fn(),
  findManyByDepartmentWithPushToken: vi.fn(),
  findManyActiveWithPushTokenAndSite: vi.fn(),
};

vi.mock("@/modules/users/repositories/UserRepository", () => ({
  UserRepository: class {
    findById = mockUserRepository.findById;
  },
}));

vi.mock("@/modules/users/repositories/UserLookupRepository", () => ({
  UserLookupRepository: class {
    findUserWithSites = mockUserLookupRepository.findUserWithSites;
    getGeofencePolicy = mockUserLookupRepository.getGeofencePolicy;
    findActiveForAttendance = mockUserLookupRepository.findActiveForAttendance;
    findActiveWithPushTokenAndSchedule =
      mockUserLookupRepository.findActiveWithPushTokenAndSchedule;
    findFixedHourUsersForAutoAlpha =
      mockUserLookupRepository.findFixedHourUsersForAutoAlpha;
    findWorkScheduleByIdWithTenant =
      mockUserLookupRepository.findWorkScheduleByIdWithTenant;
    findWorkScheduleById = mockUserLookupRepository.findWorkScheduleById;
    findAttendanceSettingsById =
      mockUserLookupRepository.findAttendanceSettingsById;
    findManyWithWorkConfig = mockUserLookupRepository.findManyWithWorkConfig;
    findManyWithBasicInfo = mockUserLookupRepository.findManyWithBasicInfo;
    findManyWithFullDetails = mockUserLookupRepository.findManyWithFullDetails;
    findWithSitesById = mockUserLookupRepository.findWithSitesById;
    findByIdWithSite = mockUserLookupRepository.findByIdWithSite;
    findAdminsForNotification =
      mockUserLookupRepository.findAdminsForNotification;
    findByIdWithDepartment = mockUserLookupRepository.findByIdWithDepartment;
    findByIdWithPushToken = mockUserLookupRepository.findByIdWithPushToken;
    findManyWithCustomWhere = mockUserLookupRepository.findManyWithCustomWhere;
    findManyWithDetailedRelations =
      mockUserLookupRepository.findManyWithDetailedRelations;
    findManyWithPushToken = mockUserLookupRepository.findManyWithPushToken;
    clearPushTokens = mockUserLookupRepository.clearPushTokens;
    findManyWithPushTokenAndFilter =
      mockUserLookupRepository.findManyWithPushTokenAndFilter;
    findManyByDepartmentWithPushToken =
      mockUserLookupRepository.findManyByDepartmentWithPushToken;
    findManyActiveWithPushTokenAndSite =
      mockUserLookupRepository.findManyActiveWithPushTokenAndSite;
  },
}));

describe("UserLookupService", () => {
  let service: UserLookupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserLookupService();
  });

  describe("findById", () => {
    it("harus delegate ke userRepository.findById", async () => {
      const mockUser = { id: "user-1", name: "Test User" };
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById("user-1");

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-1");
    });
  });

  describe("findUserWithSites", () => {
    it("harus delegate ke lookupRepository.findUserWithSites", async () => {
      const mockUser = { id: "user-1", sites: [] as never[] };
      mockUserLookupRepository.findUserWithSites.mockResolvedValue(mockUser);

      const result = await service.findUserWithSites("user-1");

      expect(result).toEqual(mockUser);
      expect(mockUserLookupRepository.findUserWithSites).toHaveBeenCalledWith(
        "user-1",
      );
    });
  });

  describe("getGeofencePolicy", () => {
    it("harus delegate ke lookupRepository.getGeofencePolicy", async () => {
      const mockPolicy = { requireGeofence: true };
      mockUserLookupRepository.getGeofencePolicy.mockResolvedValue(mockPolicy);

      const result = await service.getGeofencePolicy("user-1");

      expect(result).toEqual(mockPolicy);
      expect(mockUserLookupRepository.getGeofencePolicy).toHaveBeenCalledWith(
        "user-1",
      );
    });
  });

  describe("findActiveForAttendance", () => {
    it("harus delegate ke lookupRepository.findActiveForAttendance", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockUserLookupRepository.findActiveForAttendance.mockResolvedValue(
        mockUsers,
      );

      const result = await service.findActiveForAttendance("tenant-1");

      expect(result).toEqual(mockUsers);
      expect(
        mockUserLookupRepository.findActiveForAttendance,
      ).toHaveBeenCalledWith("tenant-1", undefined, undefined);
    });

    it("harus support optional userId dan referenceDate", async () => {
      const mockUsers = [{ id: "user-1" }];
      const referenceDate = new Date("2026-05-05");
      mockUserLookupRepository.findActiveForAttendance.mockResolvedValue(
        mockUsers,
      );

      await service.findActiveForAttendance(
        "tenant-1",
        "user-1",
        referenceDate,
      );

      expect(
        mockUserLookupRepository.findActiveForAttendance,
      ).toHaveBeenCalledWith("tenant-1", "user-1", referenceDate);
    });
  });

  describe("findManyWithWorkConfig", () => {
    it("harus delegate ke lookupRepository.findManyWithWorkConfig", async () => {
      const mockUsers = [{ id: "user-1" }, { id: "user-2" }];
      mockUserLookupRepository.findManyWithWorkConfig.mockResolvedValue(
        mockUsers,
      );

      const result = await service.findManyWithWorkConfig(["user-1", "user-2"]);

      expect(result).toEqual(mockUsers);
      expect(
        mockUserLookupRepository.findManyWithWorkConfig,
      ).toHaveBeenCalledWith(["user-1", "user-2"]);
    });
  });

  describe("findManyWithBasicInfo", () => {
    it("harus delegate ke lookupRepository.findManyWithBasicInfo", async () => {
      const mockUsers = [
        { id: "user-1", name: "User 1" },
        { id: "user-2", name: "User 2" },
      ];
      mockUserLookupRepository.findManyWithBasicInfo.mockResolvedValue(
        mockUsers,
      );

      const result = await service.findManyWithBasicInfo(["user-1", "user-2"]);

      expect(result).toEqual(mockUsers);
      expect(
        mockUserLookupRepository.findManyWithBasicInfo,
      ).toHaveBeenCalledWith(["user-1", "user-2"]);
    });
  });

  describe("findAdminsForNotification", () => {
    it("harus delegate ke lookupRepository.findAdminsForNotification", async () => {
      const mockAdmins = [{ id: "admin-1" }];
      mockUserLookupRepository.findAdminsForNotification.mockResolvedValue(
        mockAdmins,
      );

      const result = await service.findAdminsForNotification(
        "tenant-1",
        "site-1",
      );

      expect(result).toEqual(mockAdmins);
      expect(
        mockUserLookupRepository.findAdminsForNotification,
      ).toHaveBeenCalledWith("tenant-1", "site-1");
    });
  });

  describe("findByIdWithPushToken", () => {
    it("harus delegate ke lookupRepository.findByIdWithPushToken", async () => {
      const mockUser = { id: "user-1", pushTokens: ["token-1"] };
      mockUserLookupRepository.findByIdWithPushToken.mockResolvedValue(
        mockUser,
      );

      const result = await service.findByIdWithPushToken("user-1");

      expect(result).toEqual(mockUser);
      expect(
        mockUserLookupRepository.findByIdWithPushToken,
      ).toHaveBeenCalledWith("user-1");
    });
  });

  describe("findManyWithPushToken", () => {
    it("harus delegate ke lookupRepository.findManyWithPushToken", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockUserLookupRepository.findManyWithPushToken.mockResolvedValue(
        mockUsers,
      );

      const result = await service.findManyWithPushToken([
        "token-1",
        "token-2",
      ]);

      expect(result).toEqual(mockUsers);
      expect(
        mockUserLookupRepository.findManyWithPushToken,
      ).toHaveBeenCalledWith(["token-1", "token-2"]);
    });
  });

  describe("clearPushTokens", () => {
    it("harus delegate ke lookupRepository.clearPushTokens", async () => {
      mockUserLookupRepository.clearPushTokens.mockResolvedValue({ count: 2 });

      const result = await service.clearPushTokens(["token-1", "token-2"]);

      expect(result).toEqual({ count: 2 });
      expect(mockUserLookupRepository.clearPushTokens).toHaveBeenCalledWith([
        "token-1",
        "token-2",
      ]);
    });
  });

  describe("findManyActiveWithPushTokenAndSite", () => {
    it("harus delegate ke lookupRepository dengan semua parameters", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockUserLookupRepository.findManyActiveWithPushTokenAndSite.mockResolvedValue(
        mockUsers,
      );

      const result = await service.findManyActiveWithPushTokenAndSite(
        "dept-1",
        "site-1",
        "user-exclude",
      );

      expect(result).toEqual(mockUsers);
      expect(
        mockUserLookupRepository.findManyActiveWithPushTokenAndSite,
      ).toHaveBeenCalledWith("dept-1", "site-1", "user-exclude");
    });

    it("harus support optional parameters", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockUserLookupRepository.findManyActiveWithPushTokenAndSite.mockResolvedValue(
        mockUsers,
      );

      await service.findManyActiveWithPushTokenAndSite();

      expect(
        mockUserLookupRepository.findManyActiveWithPushTokenAndSite,
      ).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });
});
