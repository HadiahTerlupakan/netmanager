import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ProfilePPPService } from "@/modules/network";

const repository = {
  findProfilePpps: vi.fn(),
  findProfilePppDetail: vi.fn(),
};

describe("ProfilePPPService read flow", () => {
  it("membangun filter list berdasarkan status dan site restriction", async () => {
    repository.findProfilePpps.mockResolvedValue([{ id: "profile-1" }]);
    const service = new ProfilePPPService(repository as never);

    const result = await service.listProfilePPPs({
      status: "MAINTENANCE",
      siteId: "site-query",
      restriction: { isRestricted: true, siteIds: ["site-1", "site-2"] },
    });

    expect(result).toEqual([{ id: "profile-1" }]);
    expect(repository.findProfilePpps).toHaveBeenCalledWith({
      status: "MAINTENANCE",
      siteIds: ["site-1", "site-2"],
    });
  });

  it("memetakan error Prisma profile PPP menjadi response route", () => {
    const service = new ProfilePPPService(repository as never);
    const notFoundError = new Prisma.PrismaClientKnownRequestError("missing", {
      code: "P2025",
      clientVersion: "test",
    });
    const duplicateError = new Prisma.PrismaClientKnownRequestError(
      "duplicate",
      {
        code: "P2002",
        clientVersion: "test",
      },
    );
    const relationError = new Prisma.PrismaClientKnownRequestError("relation", {
      code: "P2003",
      clientVersion: "test",
    });

    expect(service.toProfilePPPRouteError(notFoundError)).toEqual({
      status: 404,
      body: { error: "Profile PPP tidak ditemukan" },
    });
    expect(service.toProfilePPPRouteError(duplicateError)).toEqual({
      status: 400,
      body: { error: "Nama profile PPP sudah digunakan" },
    });
    expect(service.toProfilePPPRouteError(relationError)).toEqual({
      status: 400,
      body: {
        error:
          "Profile PPP tidak dapat dihapus karena masih digunakan oleh paket",
      },
    });
  });
});
