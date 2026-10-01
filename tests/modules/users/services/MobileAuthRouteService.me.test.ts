import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prismaAuth: { user: { findFirst } },
}));
vi.mock("@/modules/mitra", () => ({ tryMobileMitraLogin: vi.fn() }));
vi.mock("@/modules/users/services/MobileCustomerAuthService", () => ({
  MobileCustomerAuthService: vi.fn(),
}));
vi.mock("@/modules/users/services/MobileEmployeeAuthService", () => ({
  MobileEmployeeAuthService: vi.fn(),
}));
vi.mock("@/modules/users/services/MobileAuthVersionService", () => ({
  MobileAuthVersionService: vi.fn(),
}));

import { getMobileEmployeeMe } from "@/modules/users/services/MobileAuthRouteService";

function karyawan(isSales: boolean) {
  return {
    id: "user-1",
    name: "Budi",
    email: "budi@example.com",
    isActive: true,
    employeeType: "KARYAWAN",
    isSales,
    image: null as string | null,
  };
}

describe("getMobileEmployeeMe — isSales", () => {
  beforeEach(() => findFirst.mockReset());

  it("mengikuti flag isSales di database, bukan nama role", async () => {
    findFirst.mockResolvedValue(karyawan(false));

    const me = await getMobileEmployeeMe("user-1", "SALES");

    expect(me?.isSales).toBe(false);
    expect(findFirst.mock.calls[0][0].select.isSales).toBe(true);
  });

  it("teknisi yang ditandai sales tetap terbaca sales", async () => {
    findFirst.mockResolvedValue(karyawan(true));

    const me = await getMobileEmployeeMe("user-1", "TEKNISI");

    expect(me?.isSales).toBe(true);
  });

});
