import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../../setup";
import { OdpRepository } from "@/modules/network/repositories/OdpRepository";
import type { Odp, PrismaClient } from "@prisma/client";

describe("OdpRepository", () => {
  let repository: OdpRepository;

  beforeEach(() => {
    repository = new OdpRepository(prismaMock as unknown as PrismaClient);
  });

  describe("create", () => {
    it("should create ODP without outputs", async () => {
      const input = {
        name: "ODP-001",
        location: "Jl. Contoh No. 1",
        odcOutputId: "odc-output-1",
        status: "AKTIF" as const,
      };

      prismaMock.$transaction.mockImplementationOnce(
        async (callback: (tx: PrismaClient) => Promise<Odp>) => {
          prismaMock.odp.create.mockResolvedValueOnce({
            id: "odp-1",
          } as unknown as Odp);
          return callback(prismaMock);
        },
      );

      const result = await repository.create(input);

      expect(result).toBeDefined();
      expect(result.id).toBe("odp-1");
    });

    it("should create ODP with outputs", async () => {
      const input = {
        name: "ODP-002",
        location: "Jl. Contoh No. 2",
        odcOutputId: "odc-output-1",
        outputs: [
          { idx: 1, slotName: "Slot 1", tubeColor: "BLUE", coreColor: "BLUE" },
          {
            idx: 2,
            slotName: "Slot 2",
            tubeColor: "ORANGE",
            coreColor: "ORANGE",
          },
        ],
      };

      prismaMock.$transaction.mockImplementationOnce(
        async (callback: (tx: PrismaClient) => Promise<Odp>) => {
          prismaMock.odp.create.mockResolvedValueOnce({
            id: "odp-2",
          } as unknown as Odp);
          prismaMock.odpOutput.createMany.mockResolvedValueOnce({ count: 2 });
          return callback(prismaMock);
        },
      );

      const result = await repository.create(input);

      expect(result.id).toBe("odp-2");
    });

    it("should set default status to AKTIF", async () => {
      const input = {
        name: "ODP-003",
        odcOutputId: "odc-output-1",
        // No status provided
      };

      prismaMock.$transaction.mockImplementationOnce(
        async (callback: (tx: PrismaClient) => Promise<Odp>) => {
          prismaMock.odp.create.mockResolvedValueOnce({
            id: "odp-3",
          } as unknown as Odp);
          return callback(prismaMock);
        },
      );

      await repository.create(input);

      expect(prismaMock.odp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "AKTIF",
          }),
        }),
      );
    });
  });

  describe("update", () => {
    it("should update ODP without changing outputs", async () => {
      const updateData = {
        name: "ODP-001 Updated",
        location: "New Location",
      };

      prismaMock.$transaction.mockImplementationOnce(
        async (callback: (tx: PrismaClient) => Promise<Odp>) => {
          prismaMock.odp.update.mockResolvedValueOnce({} as unknown as Odp);
          return callback(prismaMock);
        },
      );

      await repository.update("odp-1", updateData);

      expect(prismaMock.odp.update).toHaveBeenCalledWith({
        where: { id: "odp-1" },
        data: expect.objectContaining({
          name: "ODP-001 Updated",
          location: "New Location",
        }),
      });
    });

    it("should replace outputs when provided", async () => {
      const updateData = {
        outputs: [
          {
            idx: 1,
            slotName: "New Slot 1",
            tubeColor: "RED",
            coreColor: "RED",
          },
        ],
      };

      prismaMock.$transaction.mockImplementationOnce(
        async (callback: (tx: PrismaClient) => Promise<Odp>) => {
          prismaMock.odp.update.mockResolvedValueOnce({} as unknown as Odp);
          prismaMock.odpOutput.deleteMany.mockResolvedValueOnce({ count: 2 });
          prismaMock.odpOutput.createMany.mockResolvedValueOnce({ count: 1 });
          return callback(prismaMock);
        },
      );

      await repository.update("odp-1", updateData);

      // Should delete existing outputs first
      expect(prismaMock.odpOutput.deleteMany).toHaveBeenCalledWith({
        where: { odpId: "odp-1" },
      });

      // Then create new outputs
      expect(prismaMock.odpOutput.createMany).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete ODP", async () => {
      prismaMock.odp.delete.mockResolvedValueOnce({} as unknown as Odp);

      await repository.delete("odp-1");

      expect(prismaMock.odp.delete).toHaveBeenCalledWith({
        where: { id: "odp-1" },
      });
    });
  });

  describe("findAll", () => {
    it("should return all ODPs ordered by createdAt desc", async () => {
      const mockOdps = [
        { id: "odp-2", name: "ODP-002", createdAt: new Date("2024-01-02") },
        { id: "odp-1", name: "ODP-001", createdAt: new Date("2024-01-01") },
      ];

      prismaMock.odp.findMany.mockResolvedValueOnce(
        mockOdps as unknown as Odp[],
      );

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(prismaMock.odp.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { odpOutput: true },
          },
          site: {
            select: { name: true },
          },
        },
      });
    });

    it("should filter by siteId when provided", async () => {
      prismaMock.odp.findMany.mockResolvedValueOnce([] as unknown as Odp[]);

      await repository.findAll("site-1");

      expect(prismaMock.odp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { siteId: "site-1" },
        }),
      );
    });
  });

  describe("findById", () => {
    it("should find ODP by ID", async () => {
      const mockOdp = {
        id: "odp-1",
        name: "ODP-001",
      };

      prismaMock.odp.findUnique.mockResolvedValueOnce(
        mockOdp as unknown as Odp,
      );

      const result = await repository.findById("odp-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("odp-1");
    });

    it("should return null if ODP not found", async () => {
      prismaMock.odp.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("count", () => {
    it("should return total ODP count", async () => {
      prismaMock.odp.count.mockResolvedValueOnce(25);

      const result = await repository.count();

      expect(result).toBe(25);
    });
  });
});
