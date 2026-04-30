import { NextResponse } from "next/server";
import { tryMobileMitraLogin } from "@/modules/mitra";

import { apiError, ErrorCodes } from "@/lib/api-response";
import { prismaAuth } from "@/modules/database";
import { MobileCustomerAuthService } from "./MobileCustomerAuthService";
import { MobileEmployeeAuthService } from "./MobileEmployeeAuthService";
import { MobileAuthVersionService } from "./MobileAuthVersionService";

const DEFAULT_EMPLOYEE_TYPE = "KARYAWAN";
const DEFAULT_WORKING_HOUR_MODE = "FLEXIBLE";
const mobileAuthVersionService = new MobileAuthVersionService();
const mobileCustomerAuthService = new MobileCustomerAuthService(
  mobileAuthVersionService,
);
const mobileEmployeeAuthService = new MobileEmployeeAuthService(
  mobileAuthVersionService,
);

export interface MobileLoginPayload {
  email: string;
  password: string;
  versionCode: number;
  versionName?: string | null;
}

export interface MobileLoginRouteInput extends MobileLoginPayload {
  loginType: string;
}

export type MobileLoginResult =
  | { found: false }
  | {
      found: true;
      success: false;
      error?: string;
      status?: number;
      response?: NextResponse;
    }
  | { found: true; success: true; data: Record<string, unknown> };

/** Mengambil profil auth mobile untuk user karyawan. */
export async function getMobileEmployeeMe(id: string, role?: string) {
  const user = await prismaAuth.user.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      employeeType: true,
      image: true,
    },
  });
  if (!user?.isActive) return null;
  return buildEmployeeMePayload(user, role);
}

/** Mencoba login mobile untuk customer. */
export async function tryMobileCustomerLogin(
  input: MobileLoginPayload,
): Promise<MobileLoginResult> {
  return mobileCustomerAuthService.tryLogin(input);
}

/** Mencoba login mobile untuk karyawan. */
export async function tryMobileEmployeeLogin(
  input: MobileLoginPayload,
): Promise<MobileLoginResult> {
  return mobileEmployeeAuthService.tryLogin(input);
}

/** Menangani orkestrasi login mobile lintas tipe akun. */
export async function loginMobileRoute(input: MobileLoginRouteInput) {
  if (!input.email || !input.password) {
    return apiError(
      "Email/Username dan password harus diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const unsupportedResponse =
    await mobileAuthVersionService.buildUnsupportedVersionResponse(
      input.versionCode,
    );
  if (unsupportedResponse) {
    return unsupportedResponse;
  }

  const result = await resolveRouteLoginResult(input);
  if (!result.found) {
    return apiError("Email/ID tidak ditemukan", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  if (result.success === false) {
    if (result.response) {
      return result.response;
    }

    return apiError(result.error ?? "Login gagal", ErrorCodes.UNAUTHORIZED, {
      status: result.status || 401,
    });
  }

  return NextResponse.json({ success: true, ...result.data });
}

/** Memperbarui access token customer dari refresh token. */
export async function tryRefreshCustomerToken(refreshToken: string) {
  return mobileCustomerAuthService.tryRefreshToken(refreshToken);
}

/** Memperbarui access token mobile non-customer dari refresh token. */
export async function tryRefreshMobileToken(
  refreshToken: string,
  versionCodeOverride?: number,
) {
  const details = await mobileAuthVersionService.resolveRefreshDetails(
    refreshToken,
    versionCodeOverride,
  );
  if (!details) return { kind: "invalid" as const };
  if (!details.versionAccess.isSupported)
    return { kind: "unsupported" as const, details };

  const payload = await mobileAuthVersionService.resolveMobileRefreshPayload(
    refreshToken,
    versionCodeOverride,
  );
  if (!payload) return { kind: "invalid" as const };
  return mobileAuthVersionService.buildMobileRefreshResult(payload, details);
}

/** Menentukan urutan fallback login berdasarkan tipe login yang diminta. */
async function resolveRouteLoginResult(input: MobileLoginRouteInput) {
  if (input.loginType === "MITRA") {
    return tryPriorityLogins(
      [tryMobileMitraLogin, tryMobileEmployeeLogin, tryMobileCustomerLogin],
      input,
    );
  }

  if (input.loginType === "CUSTOMER") {
    return tryPriorityLogins(
      [tryMobileCustomerLogin, tryMobileEmployeeLogin, tryMobileMitraLogin],
      input,
    );
  }

  return tryPriorityLogins(
    [tryMobileEmployeeLogin, tryMobileMitraLogin, tryMobileCustomerLogin],
    input,
  );
}

/** Menjalankan login berurutan sampai ada handler yang mengenali akun. */
async function tryPriorityLogins(
  loginHandlers: Array<
    (input: MobileLoginPayload) => Promise<MobileLoginResult>
  >,
  input: MobileLoginPayload,
) {
  for (const loginHandler of loginHandlers) {
    const result = await loginHandler(input);
    if (result.found) {
      return result;
    }
  }

  return { found: false as const };
}

function buildEmployeeMePayload(
  user: {
    id: string;
    name: string;
    email: string;
    employeeType: string | null;
    image: string | null;
  },
  role?: string,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    features: [] as string[],
    employeeType: user.employeeType || DEFAULT_EMPLOYEE_TYPE,
    isSales: role?.toUpperCase().includes("SALES") ?? false,
    image: user.image,
    workDays: [] as string[],
    workingHourMode: DEFAULT_WORKING_HOUR_MODE,
    isOnLeave: false,
  };
}
