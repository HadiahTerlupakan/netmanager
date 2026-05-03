import { describe, it, expect } from "vitest";
import {
  isPrismaErrorCode,
  isPrismaRecordNotFoundError,
  isPrismaForeignKeyError,
  isPrismaUniqueConstraintError,
  mapPrismaErrorToResponse,
} from "@/lib/prisma-errors";

describe("lib/prisma-errors", () => {
  describe("isPrismaErrorCode", () => {
    it("should return true for matching error code", () => {
      const error = { code: "P2025" };
      expect(isPrismaErrorCode(error, "P2025")).toBe(true);
    });

    it("should return false for non-matching error code", () => {
      const error = { code: "P2025" };
      expect(isPrismaErrorCode(error, "P2002")).toBe(false);
    });

    it("should return false for error without code", () => {
      const error = { message: "Some error" };
      expect(isPrismaErrorCode(error, "P2025")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isPrismaErrorCode(null, "P2025")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isPrismaErrorCode(undefined, "P2025")).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isPrismaErrorCode("error", "P2025")).toBe(false);
      expect(isPrismaErrorCode(123, "P2025")).toBe(false);
    });
  });

  describe("isPrismaRecordNotFoundError", () => {
    it("should return true for P2025 error", () => {
      const error = { code: "P2025" };
      expect(isPrismaRecordNotFoundError(error)).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = { code: "P2002" };
      expect(isPrismaRecordNotFoundError(error)).toBe(false);
    });

    it("should return false for non-error objects", () => {
      expect(isPrismaRecordNotFoundError(null)).toBe(false);
      expect(isPrismaRecordNotFoundError(undefined)).toBe(false);
      expect(isPrismaRecordNotFoundError({})).toBe(false);
    });
  });

  describe("isPrismaForeignKeyError", () => {
    it("should return true for P2003 error", () => {
      const error = { code: "P2003" };
      expect(isPrismaForeignKeyError(error)).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = { code: "P2025" };
      expect(isPrismaForeignKeyError(error)).toBe(false);
    });

    it("should return false for non-error objects", () => {
      expect(isPrismaForeignKeyError(null)).toBe(false);
      expect(isPrismaForeignKeyError(undefined)).toBe(false);
      expect(isPrismaForeignKeyError({})).toBe(false);
    });
  });

  describe("isPrismaUniqueConstraintError", () => {
    it("should return true for P2002 error", () => {
      const error = { code: "P2002" };
      expect(isPrismaUniqueConstraintError(error)).toBe(true);
    });

    it("should return false for other error codes", () => {
      const error = { code: "P2025" };
      expect(isPrismaUniqueConstraintError(error)).toBe(false);
    });

    it("should return false for non-error objects", () => {
      expect(isPrismaUniqueConstraintError(null)).toBe(false);
      expect(isPrismaUniqueConstraintError(undefined)).toBe(false);
      expect(isPrismaUniqueConstraintError({})).toBe(false);
    });
  });

  describe("mapPrismaErrorToResponse", () => {
    it("should map P2025 to 404 not found", () => {
      const error = { code: "P2025" };
      const result = mapPrismaErrorToResponse(error);

      expect(result).toEqual({
        status: 404,
        body: { error: "Resource tidak ditemukan" },
      });
    });

    it("should map P2002 to 400 duplicate", () => {
      const error = { code: "P2002" };
      const result = mapPrismaErrorToResponse(error);

      expect(result).toEqual({
        status: 400,
        body: { error: "Data sudah ada (duplikat)" },
      });
    });

    it("should map P2003 to 400 foreign key constraint", () => {
      const error = { code: "P2003" };
      const result = mapPrismaErrorToResponse(error);

      expect(result).toEqual({
        status: 400,
        body: { error: "Data tidak dapat dihapus karena masih digunakan" },
      });
    });

    it("should return null for unknown error code", () => {
      const error = { code: "P9999" };
      const result = mapPrismaErrorToResponse(error);

      expect(result).toBeNull();
    });

    it("should return null for error without code", () => {
      const error = { message: "Some error" };
      const result = mapPrismaErrorToResponse(error);

      expect(result).toBeNull();
    });

    it("should return null for null", () => {
      const result = mapPrismaErrorToResponse(null);
      expect(result).toBeNull();
    });

    it("should return null for undefined", () => {
      const result = mapPrismaErrorToResponse(undefined);
      expect(result).toBeNull();
    });

    it("should return null for non-object", () => {
      expect(mapPrismaErrorToResponse("error")).toBeNull();
      expect(mapPrismaErrorToResponse(123)).toBeNull();
    });
  });

  describe("Integration scenarios", () => {
    it("should handle typical Prisma error object structure", () => {
      const prismaError = {
        code: "P2025",
        clientVersion: "5.0.0",
        meta: { cause: "Record to delete does not exist." },
      };

      expect(isPrismaRecordNotFoundError(prismaError)).toBe(true);
      expect(mapPrismaErrorToResponse(prismaError)).toEqual({
        status: 404,
        body: { error: "Resource tidak ditemukan" },
      });
    });

    it("should handle Error instances with code property", () => {
      const error: Error & { code?: string } = Object.assign(
        new Error("Unique constraint failed"),
        { code: "P2002" },
      );

      expect(isPrismaUniqueConstraintError(error)).toBe(true);
      expect(mapPrismaErrorToResponse(error)).toEqual({
        status: 400,
        body: { error: "Data sudah ada (duplikat)" },
      });
    });

    it("should differentiate between different Prisma errors", () => {
      const notFoundError = { code: "P2025" };
      const uniqueError = { code: "P2002" };
      const foreignKeyError = { code: "P2003" };

      expect(isPrismaRecordNotFoundError(notFoundError)).toBe(true);
      expect(isPrismaRecordNotFoundError(uniqueError)).toBe(false);
      expect(isPrismaRecordNotFoundError(foreignKeyError)).toBe(false);

      expect(isPrismaUniqueConstraintError(uniqueError)).toBe(true);
      expect(isPrismaUniqueConstraintError(notFoundError)).toBe(false);
      expect(isPrismaUniqueConstraintError(foreignKeyError)).toBe(false);

      expect(isPrismaForeignKeyError(foreignKeyError)).toBe(true);
      expect(isPrismaForeignKeyError(notFoundError)).toBe(false);
      expect(isPrismaForeignKeyError(uniqueError)).toBe(false);
    });
  });
});
