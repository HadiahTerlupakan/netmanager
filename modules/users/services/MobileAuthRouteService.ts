import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { tryMobileMitraLogin } from "@/modules/mitra";

import { apiError, ErrorCodes } from "@/lib/api-response";
import {
  getMobileTokenDetails,
  signMobileRefreshToken,
  signMobileToken,
  verifyMobileRefreshToken,
} from "@/lib/mobile-auth";
import {
  generatePelangganAccessToken,
  generatePelangganRefreshToken,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";
import { prismaAuth } from "@/modules/database";
import { getAppVersionService } from "@/modules/app-version";
import { getUserFeaturesWithCanvasing } from "@/modules/marketing";

const CUSTOMER_ROLE = "CUSTOMER";
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
const DEFAULT_EMPLOYEE_TYPE = "KARYAWAN";
const DEFAULT_WORKING_HOUR_MODE = "FLEXIBLE";

type CustomerPackageRecord = { name: string } | null | undefined;

type CustomerRecord = {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  status: string;
  tenantId: string | null;
  password: string | null;
  passwordHash: string | null;
  alamat: string | null;
  hargaPaket?: CustomerPackageRecord;
};

type EmployeeRoleRecord = {
  name: string;
  isSuperAdmin: boolean;
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

type CustomerRefreshPayload = Awaited<
  ReturnType<typeof verifyPelangganRefreshToken>
>;

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
  const customer = await findCustomerForLogin(input.email);
  if (!customer) return { found: false };
  if (!(await isCustomerPasswordValid(customer, input.password))) {
    return buildFailedLogin("Password salah");
  }

  const unsupportedResponse = await buildUnsupportedVersionResponse(
    input.versionCode,
  );
  if (unsupportedResponse) return buildFailedResponse(unsupportedResponse);
  await persistCustomerVersion(customer.id, input);
  return buildSuccessfulCustomerLogin(customer, input);
}

/** Mencoba login mobile untuk karyawan. */
export async function tryMobileEmployeeLogin(
  input: MobileLoginPayload,
): Promise<MobileLoginResult> {
  const user = await findEmployeeForLogin(input.email);
  if (!user?.passwordHash) return { found: false };
  if (!(await compare(input.password, user.passwordHash))) {
    return buildFailedLogin("Password salah");
  }

  if (!hasEmployeeMobileAccess(user)) {
    return buildFailedLogin("Akun tidak memiliki akses mobile app", 403);
  }

  const unsupportedResponse = await buildUnsupportedVersionResponse(
    input.versionCode,
  );
  if (unsupportedResponse) return buildFailedResponse(unsupportedResponse);
  await persistEmployeeVersion(user.id, input);
  return buildSuccessfulEmployeeLogin(user, input);
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

  const unsupportedResponse = await buildUnsupportedVersionResponse(
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
  const verified = await verifyPelangganRefreshToken(refreshToken);
  if (!verified.valid) return null;

  const customer = await findCustomerForRefresh(verified.id);
  if (!customer || customer.status !== "AKTIF") return null;
  return buildCustomerRefreshResult(verified, customer);
}

/** Memperbarui access token mobile non-customer dari refresh token. */
export async function tryRefreshMobileToken(
  refreshToken: string,
  versionCodeOverride?: number,
) {
  const details = await resolveRefreshDetails(
    refreshToken,
    versionCodeOverride,
  );
  if (!details) return { kind: "invalid" as const };
  if (!details.versionAccess.isSupported)
    return { kind: "unsupported" as const, details };

  const payload = await resolveMobileRefreshPayload(
    refreshToken,
    versionCodeOverride,
  );
  if (!payload) return { kind: "invalid" as const };
  return buildMobileRefreshResult(payload, details);
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

async function findCustomerForLogin(email: string) {
  return prismaAuth.pelanggan.findFirst({
    where: {
      OR: [
        { username: { equals: email, mode: "insensitive" } },
        { idPelanggan: { equals: email, mode: "insensitive" } },
        { email: { equals: email, mode: "insensitive" } },
      ],
    },
    include: { hargaPaket: true },
  });
}

async function isCustomerPasswordValid(
  customer: CustomerRecord,
  password: string,
) {
  if (customer.passwordHash) {
    return compare(password, customer.passwordHash);
  }

  logger.warn(
    `[MobileAuth] WARNING: Customer ${customer.id} is using legacy plaintext password. Please migrate to bcrypt hash.`,
  );
  return customer.password === password;
}

async function buildSuccessfulCustomerLogin(
  customer: CustomerRecord,
  input: MobileLoginPayload,
): Promise<MobileLoginResult> {
  const versionMetadata = buildVersionMetadata(input);
  return {
    found: true,
    success: true,
    data: {
      token: generatePelangganAccessToken(
        buildCustomerTokenPayload(customer, input),
        "7d",
      ),
      refreshToken: await generatePelangganRefreshToken(
        customer.id,
        versionMetadata,
      ),
      user: buildCustomerUserPayload(customer),
    },
  };
}

function buildCustomerTokenPayload(
  customer: CustomerRecord,
  input: MobileLoginPayload,
) {
  return {
    id: customer.id,
    idPelanggan: customer.idPelanggan,
    nama: customer.nama,
    username: customer.username,
    status: customer.status,
    tenantId: customer.tenantId,
    ...buildVersionMetadata(input),
  };
}

function buildCustomerUserPayload(customer: CustomerRecord) {
  return {
    id: customer.id,
    name: customer.nama,
    email: customer.username,
    role: CUSTOMER_ROLE,
    isSales: false,
    features: { canvasing: false, attendance: false, workOrder: true },
    memberId: customer.idPelanggan,
    planName: customer.hargaPaket?.name || "Paket Internet",
    address: customer.alamat,
  };
}

async function persistCustomerVersion(
  customerId: string,
  input: MobileLoginPayload,
) {
  if (input.versionCode <= 0) return;
  await prismaAuth.pelanggan.update({
    where: { id: customerId },
    data: buildVersionUpdate(input),
  });
}

async function findEmployeeForLogin(email: string) {
  return prismaAuth.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { role: { include: { permission: true } } },
  });
}

function hasEmployeeMobileAccess(user: EmployeeRecord) {
  return user.role?.accessEmployeePanel || user.role?.name === SUPER_ADMIN_ROLE;
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

function buildVersionUpdate(input: MobileLoginPayload) {
  return {
    lastVersionCode: input.versionCode,
    lastVersionName: input.versionName || null,
    lastVersionUpdate: new Date(),
  };
}

function buildVersionMetadata(input: MobileLoginPayload) {
  return {
    appVersionCode: input.versionCode || undefined,
    appVersionName: input.versionName || null,
  };
}

async function buildUnsupportedVersionResponse(versionCode: number) {
  const versionAccess =
    await getAppVersionService().evaluateVersionAccess(versionCode);
  if (versionAccess.isSupported) return null;
  return apiError(
    "Aplikasi harus diperbarui untuk melanjutkan.",
    ErrorCodes.APP_VERSION_UNSUPPORTED,
    {
      status: 426,
      details: {
        currentVersionCode: versionCode,
        minimumVersion: versionAccess.minimumVersion,
        latestVersion: versionAccess.latestVersion,
        isForceUpdate: versionAccess.isForceUpdate,
        updateAvailable: versionAccess.updateAvailable,
      },
    },
  );
}

function buildFailedLogin(error: string, status = 401): MobileLoginResult {
  return { found: true, success: false, error, status };
}

function buildFailedResponse(response: NextResponse): MobileLoginResult {
  return { found: true, success: false, response };
}

async function findCustomerForRefresh(id: string) {
  return prismaAuth.pelanggan.findUnique({
    where: { id },
    select: {
      id: true,
      idPelanggan: true,
      nama: true,
      username: true,
      status: true,
      tenantId: true,
      lastVersionCode: true,
      lastVersionName: true,
    },
  });
}

async function buildCustomerRefreshResult(
  verified: CustomerRefreshPayload,
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerForRefresh>>>,
) {
  const trustedVersion = resolveTrustedCustomerVersion(verified, customer);
  const unsupportedResponse = await buildUnsupportedVersionResponse(
    trustedVersion.trustedVersionCode,
  );
  if (unsupportedResponse)
    return { kind: "unsupported" as const, response: unsupportedResponse };

  return {
    kind: "success" as const,
    token: generatePelangganAccessToken(
      {
        id: customer.id,
        idPelanggan: customer.idPelanggan,
        nama: customer.nama,
        username: customer.username,
        status: customer.status,
        tenantId: customer.tenantId,
        appVersionCode: trustedVersion.trustedVersionCode || undefined,
        appVersionName: trustedVersion.trustedVersionName,
      },
      "7d",
    ),
    refreshToken: await generatePelangganRefreshToken(customer.id, {
      appVersionCode: trustedVersion.trustedVersionCode || undefined,
      appVersionName: trustedVersion.trustedVersionName,
    }),
  };
}

function resolveTrustedCustomerVersion(
  verified: CustomerRefreshPayload,
  customer: { lastVersionCode: number | null; lastVersionName: string | null },
) {
  const tokenVersionCode = verified.appVersionCode ?? 0;
  const persistedVersionCode = customer.lastVersionCode ?? 0;
  if (persistedVersionCode > tokenVersionCode) {
    return {
      trustedVersionCode: persistedVersionCode,
      trustedVersionName:
        customer.lastVersionName ?? verified.appVersionName ?? null,
    };
  }

  return {
    trustedVersionCode:
      verified.appVersionCode ?? customer.lastVersionCode ?? 0,
    trustedVersionName:
      verified.appVersionName ?? customer.lastVersionName ?? null,
  };
}

async function resolveRefreshDetails(
  refreshToken: string,
  versionCodeOverride?: number,
) {
  if (versionCodeOverride === undefined) {
    return getMobileTokenDetails(refreshToken);
  }

  return getMobileTokenDetails(refreshToken, versionCodeOverride);
}

async function resolveMobileRefreshPayload(
  refreshToken: string,
  versionCodeOverride?: number,
) {
  if (versionCodeOverride === undefined) {
    return verifyMobileRefreshToken(refreshToken);
  }

  return verifyMobileRefreshToken(refreshToken, versionCodeOverride);
}

async function buildMobileRefreshResult(
  payload: NonNullable<Awaited<ReturnType<typeof verifyMobileRefreshToken>>>,
  details: NonNullable<Awaited<ReturnType<typeof getMobileTokenDetails>>>,
) {
  const trustedVersionCode = resolveTrustedMobileRefreshVersion(
    payload.appVersionCode,
    details.versionCode,
  );
  const unsupportedResponse =
    await buildUnsupportedVersionResponse(trustedVersionCode);
  if (unsupportedResponse) {
    return {
      kind: "unsupported" as const,
      details: { ...details, versionCode: trustedVersionCode },
    };
  }

  const tokenPayload = {
    ...payload,
    appVersionCode: trustedVersionCode || payload.appVersionCode || 0,
    appVersionName: payload.appVersionName ?? null,
  };

  return {
    kind: "success" as const,
    token: await signMobileToken(tokenPayload),
    refreshToken: await signMobileRefreshToken(tokenPayload),
  };
}

function resolveTrustedMobileRefreshVersion(
  payloadVersionCode: number | null | undefined,
  detailsVersionCode: number,
) {
  const candidateVersionCode = Number(payloadVersionCode ?? 0);
  if (Number.isInteger(candidateVersionCode) && candidateVersionCode > 0) {
    return candidateVersionCode;
  }

  return detailsVersionCode;
}
