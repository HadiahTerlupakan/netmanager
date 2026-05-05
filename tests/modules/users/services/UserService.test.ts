import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserService } from "@/modules/users/services/UserService";
import type { IUserRepository } from "@/modules/users/domain/ports/IUserRepository";
import type { UserEntity } from "@/modules/users/domain/entities/UserEntity";
import type {
  CreateUserInput,
  UpdateUserInput,
} from "@/modules/users/services/UserService.types";

// Mock dependencies
vi.mock("bcryptjs", () => ({
  hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
}));

vi.mock("@/lib/auth", () => ({
  invalidatePermissionCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    del: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/lib/validations/global-identifier", () => ({
  checkGlobalIdentifier: vi.fn(() => Promise.resolve({ exists: false })),
}));

vi.mock("@/modules/users/mappers/UserMapper", () => ({
  UserMapper: {
    toListDTOs: vi.fn((data) => data),
    toDetailDTO: vi.fn((data) => data),
  },
}));

vi.mock("@/modules/users/services/UserService.helpers", () => ({
  buildCreateUserInput: vi.fn((data, passwordHash) => ({
    ...data,
    password: passwordHash,
  })),
  buildUpdateUserData: vi.fn((data) => data),
  validateWorkingHoursPayload: vi.fn(),
}));

describe("UserService", () => {
  let userService: UserService;
  let mockRepository: IUserRepository;

  const mockUser: UserEntity = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    phone: null,
    image: null,
    departmentId: null,
    siteId: null,
    roleId: "role-1",
    tenantId: null,
    isActive: true,
    isSales: false,
    isAttendanceRequired: true,
    workingHourMode: "fixed",
    attendanceGeofencePolicy: null,
    startWorkTime: null,
    endWorkTime: null,
    workDays: null,
    flexibleTargetHour: null,
    shiftId: null,
    canvasingTarget: null,
    targetSchema: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByIdWithRelations: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateWorkingHours: vi.fn(),
    } as unknown as IUserRepository;

    userService = new UserService(mockRepository);
  });

  describe("getAllUsers", () => {
    it("harus mengembalikan list users dengan DTO", async () => {
      const mockResult = {
        data: [mockUser],
        total: 1,
        active: 1,
        inactive: 0,
      };

      vi.mocked(mockRepository.findAll).mockResolvedValue(mockResult);

      const result = await userService.getAllUsers();

      expect(result).toEqual(mockResult);
      expect(mockRepository.findAll).toHaveBeenCalledWith({});
    });

    it("harus meneruskan filter params ke repository", async () => {
      const params = { search: "test", page: 1, limit: 10 };
      const mockResult = {
        data: [] as UserEntity[],
        total: 0,
        active: 0,
        inactive: 0,
      };

      vi.mocked(mockRepository.findAll).mockResolvedValue(mockResult);

      await userService.getAllUsers(params);

      expect(mockRepository.findAll).toHaveBeenCalledWith(params);
    });
  });

  describe("getUser", () => {
    it("harus mengembalikan user entity by ID", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockUser);

      const result = await userService.getUser("user-1");

      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith("user-1");
    });

    it("harus mengembalikan null jika user tidak ditemukan", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const result = await userService.getUser("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getUserWithRelations", () => {
    it("harus mengembalikan user detail DTO dengan relations", async () => {
      vi.mocked(mockRepository.findByIdWithRelations).mockResolvedValue(
        mockUser,
      );

      const result = await userService.getUserWithRelations("user-1");

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByIdWithRelations).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("harus mengembalikan null jika user tidak ditemukan", async () => {
      vi.mocked(mockRepository.findByIdWithRelations).mockResolvedValue(null);

      const result = await userService.getUserWithRelations("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("harus mengembalikan user entity by email", async () => {
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(mockUser);

      const result = await userService.getUserByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(
        "test@example.com",
      );
    });

    it("harus mengembalikan null jika email tidak ditemukan", async () => {
      vi.mocked(mockRepository.findByEmail).mockResolvedValue(null);

      const result = await userService.getUserByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });

  describe("createUser", () => {
    const createInput: CreateUserInput = {
      email: "new@example.com",
      password: "password123",
      name: "New User",
      roleId: "role-1",
    };

    it("harus membuat user baru dengan password yang di-hash", async () => {
      const { checkGlobalIdentifier } =
        await import("@/lib/validations/global-identifier");
      vi.mocked(checkGlobalIdentifier).mockResolvedValue({
        exists: false,
      });

      vi.mocked(mockRepository.create).mockResolvedValue(mockUser);

      const result = await userService.createUser(createInput);

      expect(result).toEqual(mockUser);
      expect(checkGlobalIdentifier).toHaveBeenCalledWith("new@example.com");
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it("harus throw error jika email sudah terdaftar", async () => {
      const { checkGlobalIdentifier } =
        await import("@/lib/validations/global-identifier");
      vi.mocked(checkGlobalIdentifier).mockResolvedValue({
        exists: true,
        role: "user",
        field: "email",
      });

      await expect(userService.createUser(createInput)).rejects.toThrow(
        "Email sudah terdaftar sebagai user",
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("updateUser", () => {
    const updateInput: UpdateUserInput = {
      name: "Updated Name",
      isActive: true,
    };

    it("harus update user yang ada", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.update).mockResolvedValue({
        ...mockUser,
        ...updateInput,
      });

      const result = await userService.updateUser("user-1", updateInput);

      expect(result.name).toBe("Updated Name");
      expect(mockRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockRepository.update).toHaveBeenCalledWith("user-1", updateInput);
    });

    it("harus throw error jika user tidak ditemukan", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(
        userService.updateUser("non-existent", updateInput),
      ).rejects.toThrow("User tidak ditemukan");

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it("harus validasi email baru jika email diubah", async () => {
      const { checkGlobalIdentifier } =
        await import("@/lib/validations/global-identifier");

      vi.mocked(mockRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(checkGlobalIdentifier).mockResolvedValue({
        exists: true,
        role: "admin",
        field: "email",
      });

      const updateWithEmail = { ...updateInput, email: "newemail@example.com" };

      await expect(
        userService.updateUser("user-1", updateWithEmail),
      ).rejects.toThrow("Email sudah terdaftar sebagai admin");
    });

    it("harus clear cache jika roleId atau isActive berubah", async () => {
      const { invalidatePermissionCache } = await import("@/lib/auth");

      vi.mocked(mockRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.update).mockResolvedValue(mockUser);

      await userService.updateUser("user-1", { roleId: "new-role" });

      expect(invalidatePermissionCache).toHaveBeenCalledWith("user-1");
    });
  });

  describe("deleteUser", () => {
    it("harus delete user yang ada", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockUser);
      vi.mocked(mockRepository.delete).mockResolvedValue(mockUser);

      const result = await userService.deleteUser("user-1");

      expect(result).toEqual(mockUser);
      expect(mockRepository.findById).toHaveBeenCalledWith("user-1");
      expect(mockRepository.delete).toHaveBeenCalledWith("user-1");
    });

    it("harus throw error jika user tidak ditemukan", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(userService.deleteUser("non-existent")).rejects.toThrow(
        "User tidak ditemukan",
      );

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("updateWorkingHours", () => {
    const workingHours = {
      workingHourMode: "fixed",
      startWorkTime: "09:00",
      endWorkTime: "17:00",
      workDays: "1,2,3,4,5",
    };

    it("harus update working hours user", async () => {
      const { validateWorkingHoursPayload } =
        await import("@/modules/users/services/UserService.helpers");

      vi.mocked(mockRepository.updateWorkingHours).mockResolvedValue(mockUser);

      const result = await userService.updateWorkingHours(
        "user-1",
        workingHours,
      );

      expect(result).toEqual(mockUser);
      expect(validateWorkingHoursPayload).toHaveBeenCalledWith(workingHours);
      expect(mockRepository.updateWorkingHours).toHaveBeenCalledWith(
        "user-1",
        workingHours,
      );
    });

    it("harus clear schedule cache setelah update", async () => {
      const { redis } = await import("@/lib/redis");

      vi.mocked(mockRepository.updateWorkingHours).mockResolvedValue(mockUser);

      await userService.updateWorkingHours("user-1", workingHours);

      expect(redis.del).toHaveBeenCalledWith("user:schedule:user-1");
    });
  });
});
