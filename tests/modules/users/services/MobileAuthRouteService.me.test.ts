import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());

vi.mock("@/modules/database", () => ({
  prismaAuth: { user: { findFirst } },
}));
vi.mock("@/modules/mitra", () => ({ tryMobileMitraLogin: vi.fn() }));
vi.mock("@/modules/investor", () => ({ tryMobileInvestorLogin: vi.fn() }));
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

function karyawan(
  isSales: boolean,
  permission: { resource: string; action: string }[] = [],
  persona: "STAFF" | "TEKNISI" | "SALES" | "FINANCE" | "DIREKTUR" = "STAFF",
) {
  return {
    id: "user-1",
    name: "Budi",
    email: "budi@example.com",
    isActive: true,
    employeeType: "KARYAWAN",
    isSales,
    image: null as string | null,
    role: { isSuperAdmin: false, permission, persona },
  };
}

describe("getMobileEmployeeMe — isSales", () => {
  beforeEach(() => findFirst.mockReset());

  it("mengikuti persona role, bukan nama role", async () => {
    findFirst.mockResolvedValue(karyawan(false));

    const me = await getMobileEmployeeMe("user-1", "SALES");

    expect(me?.isSales).toBe(false);
    expect(findFirst.mock.calls[0][0].select.role.select.persona).toBe(true);
  });

  it("kolom isSales lama tanpa persona SALES tidak lagi membuat sales", async () => {
    findFirst.mockResolvedValue(karyawan(true, [], "TEKNISI"));

    const me = await getMobileEmployeeMe("user-1", "TEKNISI");

    expect(me?.isSales).toBe(false);
    expect(me?.persona).toBe("TEKNISI");
  });

  it("izin kepala sales (lingkup TIM) tanpa persona SALES bukan sales", async () => {
    findFirst.mockResolvedValue(
      karyawan(false, [
        { resource: "presurvei_rencana", action: "read" },
        { resource: "presurvei_rencana", action: "create" },
      ]),
    );

    const me = await getMobileEmployeeMe("user-1", "KEPALA SALES");

    expect(me?.isSales).toBe(false);
  });

  it("admin (lingkup SEMUA) tidak berubah jadi sales", async () => {
    findFirst.mockResolvedValue(
      karyawan(false, [
        { resource: "presurvei_rencana", action: "read" },
        { resource: "presurvei_rencana", action: "view_all" },
      ]),
    );

    const me = await getMobileEmployeeMe("user-1", "ADMIN");

    expect(me?.isSales).toBe(false);
  });

  it("mengirim persona role apa adanya", async () => {
    findFirst.mockResolvedValue(karyawan(false, [], "TEKNISI"));
    expect((await getMobileEmployeeMe("user-1", "TEKNISI"))?.persona).toBe("TEKNISI");

    findFirst.mockResolvedValue(karyawan(false, [], "FINANCE"));
    expect((await getMobileEmployeeMe("user-1", "FINANCE"))?.persona).toBe("FINANCE");
  });

  it("role berpersona SALES membuat isSales true walau kolomnya tidak dicentang", async () => {
    findFirst.mockResolvedValue(karyawan(false, [], "SALES"));

    const me = await getMobileEmployeeMe("user-1", "SALES");

    expect(me?.isSales).toBe(true);
    expect(me?.persona).toBe("SALES");
  });
});
