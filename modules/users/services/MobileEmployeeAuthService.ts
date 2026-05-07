import { compare } from "bcryptjs";
import { signMobileRefreshToken, signMobileToken } from "@/lib/mobile-auth";
import { isSuperAdminRole } from "@/lib/auth/helpers";
import { prismaAuth } from "@/modules/database";
import { getUserFeaturesWithCanvasing } from "@/modules/marketing";
import type {
  MobileLoginPayload,
  MobileLoginResult,
} from "./MobileAuthRouteService";
import {
  buildVersionUpdate,
  MobileAuthVersionService,
} from "./MobileAuthVersionService";

type EmployeeRoleRecord = {
  name: string;
  isSuperAdmin: boolean;
  accessAdminPanel: boolean;
  accessEmployeePanel: boolean;
};

type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  tenantId: string | null;
  passwordHash: string | null;
  employeeType: string | null;
  workDays: string | null;
  workingHourMode: string | null;
  isSales: boolean;
  role: EmployeeRoleRecord | null;
};

/** Mengelola login mobile untuk karyawan. */
export class MobileEmployeeAuthService {
  constructor(
    private readonly versionService = new MobileAuthVersionService(),
  ) {}

  /** Mencoba login mobile untuk karyawan. */
  async tryLogin(input: MobileLoginPayload): Promise<MobileLoginResult> {
    const user = await findEmployeeForLogin(input.email);
    if (!user?.passwordHash) return { found: false };
    if (!(await compare(input.password, user.passwordHash))) {
      return {
        found: true,
        success: false,
        error: "Password salah",
        status: 401,
      };
    }

    if (!hasEmployeeMobileAccess(user)) {
      return {
        found: true,
        success: false,
        error: "Akun tidak memiliki akses mobile app",
        status: 403,
      };
    }

    const unsupportedResponse =
      await this.versionService.buildUnsupportedVersionResponse(
        input.versionCode,
      );
    if (unsupportedResponse) {
      return { found: true, success: false, response: unsupportedResponse };
    }

    await persistEmployeeVersion(user.id, input);
    return buildSuccessfulEmployeeLogin(user, input);
  }
}

async function findEmployeeForLogin(email: string) {
  return prismaAuth.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { role: { include: { permission: true } } },
  });
}

function hasEmployeeMobileAccess(user: EmployeeRecord) {
  return (
    user.role?.accessEmployeePanel || isSuperAdminRole(user.role?.name || "")
  );
}

async function buildSuccessfulEmployeeLogin(
  user: EmployeeRecord,
  input: MobileLoginPayload,
): Promise<MobileLoginResult> {
  const tokenPayload = buildEmployeeTokenPayload(user, input);
  return {
    found: true,
    success: true,
    data: {
      token: await signMobileToken(tokenPayload),
      refreshToken: await signMobileRefreshToken(tokenPayload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name,
        employeeType: user.employeeType,
        workDays: user.workDays,
        workingHourMode: user.workingHourMode,
        isSales: user.isSales,
        features: await getUserFeaturesWithCanvasing(user.id),
      },
    },
  };
}

function buildEmployeeTokenPayload(
  user: EmployeeRecord,
  input: MobileLoginPayload,
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role?.name || "USER",
    appVersionCode: input.versionCode,
    appVersionName: input.versionName || null,
    tenantId: user.tenantId,
    isSuperAdmin: user.role?.isSuperAdmin ?? false,
    accessAdminPanel: user.role?.accessAdminPanel ?? false,
  };
}

async function persistEmployeeVersion(
  userId: string,
  input: MobileLoginPayload,
) {
  if (input.versionCode <= 0) return;
  await prismaAuth.user.update({
    where: { id: userId },
    data: buildVersionUpdate(input),
  });
}
