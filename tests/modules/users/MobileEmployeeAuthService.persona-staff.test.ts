import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

/**
 * Kontrak login untuk persona STAFF.
 *
 * Persona menentukan tata letak aplikasi, tetapi yang memutuskan seseorang bisa
 * membuka aplikasi sama sekali adalah `accessEmployeePanel`. Kedua hal itu
 * sempat tidak sejalan: seluruh role bawaan berpersona STAFF (ADMIN, FINANCE)
 * justru `accessEmployeePanel: false`, sehingga persona STAFF tidak punya pintu
 * masuk dan karyawan kantor terpaksa diberi role TEKNISI. Dua pengujian di
 * bawah mengunci kedua sisinya sekaligus supaya pasangan itu tidak terlepas
 * lagi tanpa ketahuan.
 */

vi.mock("@/modules/database", () => ({
  prismaAuth: prismaMock,
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/mobile-auth", () => ({
  signMobileToken: vi.fn(() => Promise.resolve("mock-token")),
  signMobileRefreshToken: vi.fn(() => Promise.resolve("mock-refresh")),
}));

const FITUR_STAFF = [
  "m_dashboard",
  "m_absensi",
  "m_lembur",
  "m_izin",
  "m_holidays",
  "m_chat",
];

vi.mock("@/modules/marketing", () => ({
  getUserFeaturesWithCanvasing: vi.fn(() => Promise.resolve(FITUR_STAFF)),
}));

type RoleUji = {
  name: string;
  persona: string;
  isSuperAdmin: boolean;
  accessEmployeePanel: boolean;
  permission: unknown[];
};

function penggunaDenganRole(role: RoleUji) {
  return {
    id: "user-staff",
    name: "Siti Nurhaliza",
    email: "staff@example.com",
    tenantId: "tenant-1",
    passwordHash: "$2a$10$hash",
    employeeType: "KARYAWAN",
    workDays: "Mon,Tue,Wed,Thu,Fri",
    workingHourMode: "FIXED",
    isSales: false,
    role,
  };
}

const ROLE_STAFF: RoleUji = {
  name: "STAFF",
  persona: "STAFF",
  isSuperAdmin: false,
  accessEmployeePanel: true,
  permission: [],
};

describe("login mobile persona STAFF", () => {
  let MobileEmployeeAuthService: typeof import("@/modules/users/services/MobileEmployeeAuthService").MobileEmployeeAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ MobileEmployeeAuthService } =
      await import("@/modules/users/services/MobileEmployeeAuthService"));
    prismaMock.user.update.mockResolvedValue({} as never);
  });

  async function login() {
    const service = new MobileEmployeeAuthService();
    return service.tryLogin({
      email: "staff@example.com",
      password: "password",
      versionCode: 1,
      versionName: "1.0.0",
    });
  }

  it("mengirim persona STAFF beserta fitur kepegawaian, dan bukan sales", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      penggunaDenganRole(ROLE_STAFF) as never,
    );

    const result = await login();

    if (!result.found || !result.success) {
      throw new Error("login staff seharusnya berhasil");
    }

    expect(result.data.user).toMatchObject({
      role: "STAFF",
      persona: "STAFF",
      isSales: false,
    });
    expect((result.data.user as { features: string[] }).features).toEqual(
      FITUR_STAFF,
    );
  });

  it("menolak role berpersona STAFF yang tidak diberi portal karyawan", async () => {
    // Keadaan ADMIN & FINANCE: persona-nya STAFF, tetapi tanpa portal karyawan
    // mereka tidak pernah sampai ke tampilan staff.
    prismaMock.user.findFirst.mockResolvedValue(
      penggunaDenganRole({
        ...ROLE_STAFF,
        name: "ADMIN",
        accessEmployeePanel: false,
      }) as never,
    );

    const result = await login();

    expect(result).toMatchObject({
      found: true,
      success: false,
      status: 403,
      error: expect.stringContaining("tidak memiliki akses mobile app"),
    });
  });
});
