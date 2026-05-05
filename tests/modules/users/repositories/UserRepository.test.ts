import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRepository } from "@/modules/users/repositories/UserRepository";
import { prismaMock } from "@/tests/setup";

vi.mock("@/modules/users/mappers/UserMapper", () => ({
  UserMapper: {
    toDomain: vi.fn((user) => user),
    toRepositoryCreateInput: vi.fn((data) => data),
    toRepositoryUpdateInput: vi.fn((data) => data),
    toWorkingHoursUpdate: vi.fn((data) => data),
  },
}));

describe("UserRepository", () => {
  let repository: UserRepository;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    phone: null as string | null,
    image: null as string | null,
    password: "hashed_password",
    departmentId: null as string | null,
    siteId: null as string | null,
    roleId: "role-1",
    tenantId: null as string | null,
    isActive: true,
    isSales: false,
    isAttendanceRequired: true,
    workingHourMode: "FIXED" as const,
    attendanceGeofencePolicy: null as string | null,
    startWorkTime: "09:00",
    endWorkTime: "17:00",
    workDays: "1,2,3,4,5",
    flexibleTargetHour: null as number | null,
    shiftId: null as string | null,
    canvasingTarget: null as number | null,
    targetSchema: null as Record<string, unknown> | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = new UserRepository();
  });

  describe("findAll", () => {
    it("harus return list users dengan pagination", async () => {
      vi.mocked(prismaMock.$transaction).mockResolvedValue([
        [mockUser],
        1,
        1,
        0,
      ]);

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.active).toBe(1);
      expect(result.inactive).toBe(0);
      expect(result.data).toHaveLength(1);
    });

    it("harus filter by isActive", async () => {
      vi.mocked(prismaMock.$transaction).mockResolvedValue([
        [mockUser],
        1,
        1,
        0,
      ]);

      await repository.findAll({ isActive: true });

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("harus filter by search query", async () => {
      vi.mocked(prismaMock.$transaction).mockResolvedValue([
        [mockUser],
        1,
        1,
        0,
      ]);

      await repository.findAll({ search: "test" });

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it("harus filter by siteId", async () => {
      vi.mocked(prismaMock.$transaction).mockResolvedValue([[], 0, 0, 0]);

      await repository.findAll({ siteId: "site-1" });

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("harus return user by ID", async () => {
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser);

      const result = await repository.findById("user-1");

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: expect.any(Object),
      });
    });

    it("harus return null jika user tidak ditemukan", async () => {
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByIdWithRelations", () => {
    it("harus return user dengan relations", async () => {
      const userWithRelations = {
        ...mockUser,
        role: { id: "role-1", name: "Admin" } as { id: string; name: string },
        department: null as { id: string; name: string } | null,
        site: null as { id: string; name: string } | null,
      };

      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(
        userWithRelations,
      );

      const result = await repository.findByIdWithRelations("user-1");

      expect(result).toEqual(userWithRelations);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: expect.any(Object),
      });
    });

    it("harus return null jika user tidak ditemukan", async () => {
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

      const result = await repository.findByIdWithRelations("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("harus return user by email", async () => {
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(mockUser);

      const result = await repository.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("harus return null jika email tidak ditemukan", async () => {
      vi.mocked(prismaMock.user.findUnique).mockResolvedValue(null);

      const result = await repository.findByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("harus create user baru", async () => {
      const createInput = {
        email: "new@example.com",
        password: "hashed_password",
        name: "New User",
        roleId: "role-1",
      };

      vi.mocked(prismaMock.user.create).mockResolvedValue(mockUser);

      const result = await repository.create(createInput as never);

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("update", () => {
    it("harus update user yang ada", async () => {
      const updateInput = {
        name: "Updated Name",
        isActive: false,
      };

      vi.mocked(prismaMock.user.update).mockResolvedValue({
        ...mockUser,
        name: "Updated Name",
        isActive: false,
      });

      const result = await repository.update("user-1", updateInput as never);

      expect(result.name).toBe("Updated Name");
      expect(result.isActive).toBe(false);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("delete", () => {
    it("harus delete user", async () => {
      vi.mocked(prismaMock.user.delete).mockResolvedValue(mockUser);

      const result = await repository.delete("user-1");

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
    });
  });

  describe("updateWorkingHours", () => {
    it("harus update working hours user", async () => {
      const workingHours = {
        workingHourMode: "FIXED" as const,
        startWorkTime: "08:00",
        endWorkTime: "16:00",
        workDays: "1,2,3,4,5",
      };

      vi.mocked(prismaMock.user.update).mockResolvedValue({
        ...mockUser,
        ...workingHours,
      });

      const result = await repository.updateWorkingHours(
        "user-1",
        workingHours as never,
      );

      expect(result.startWorkTime).toBe("08:00");
      expect(result.endWorkTime).toBe("16:00");
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: workingHours,
      });
    });
  });
});
