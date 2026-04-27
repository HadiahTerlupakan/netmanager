import { describe, expect, it, vi } from "vitest";
import { GlobalIdentifierService } from "@/lib/validations/global-identifier";

const repository = {
  findPelangganIdentifier: vi.fn(),
  findEmployeeIdentifier: vi.fn(),
  findMitraIdentifier: vi.fn(),
};

describe("GlobalIdentifierService", () => {
  it("mendeteksi email pelanggan sebagai identifier global", async () => {
    repository.findPelangganIdentifier.mockResolvedValue({
      username: "cust001",
      idPelanggan: "C001",
      email: "customer@example.com",
    });
    const service = new GlobalIdentifierService(repository);

    const result = await service.check("CUSTOMER@example.com");

    expect(result).toEqual({ exists: true, role: "Pelanggan", field: "email" });
    expect(repository.findPelangganIdentifier).toHaveBeenCalledWith({
      identifier: "customer@example.com",
      excludeId: undefined,
    });
  });
});
