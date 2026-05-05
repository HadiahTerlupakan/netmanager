import { compare } from "bcryptjs";

import {
  getMitraMobileFeatures,
  signMobileRefreshToken,
  signMobileToken,
} from "@/lib/mobile-auth";
import { prismaMitra, prismaMitraAuth } from "@/modules/database";

type MitraLoginRecord = {
  id: string;
  email: string;
  name: string;
  mitraType: string;
  tenantId: string | null;
  passwordHash: string | null;
  isActive: boolean;
};

export interface MobileLoginPayload {
  email: string;
  password: string;
  versionCode: number;
  versionName?: string | null;
}

/** Mengambil profil auth mobile khusus mitra. */
export async function getMobileMitraMe(id: string) {
  const mitra = await prismaMitra.mitra.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      mitraType: true,
      phone: true,
      siteId: true,
    },
  });

  if (!mitra || !mitra.isActive) {
    return null;
  }

  return buildMitraProfile(mitra);
}

function buildMitraProfile(mitra: {
  id: string;
  name: string;
  email: string;
  mitraType: string;
}) {
  return {
    id: mitra.id,
    name: mitra.name,
    email: mitra.email,
    role: "MITRA",
    features: getMitraMobileFeatures(mitra.mitraType),
    employeeType: mitra.mitraType,
    isSales: mitra.mitraType === "MITRA_SALES",
    image: null as string | null,
    workDays: [] as string[],
    workingHourMode: "FLEXIBLE",
    isOnLeave: false,
  };
}

/** Mencoba login mobile untuk akun mitra. */
export async function tryMobileMitraLogin(input: MobileLoginPayload) {
  const mitra = (await prismaMitraAuth.mitra.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" } },
  })) as MitraLoginRecord | null;

  if (!mitra || !mitra.passwordHash) {
    return { found: false as const };
  }

  const validationError = await validateMitraLogin(mitra, input.password);
  if (validationError) return validationError;

  const tokenPayload = buildMitraTokenPayload(mitra, input);
  return buildSuccessfulLogin(mitra, tokenPayload);
}

async function validateMitraLogin(mitra: MitraLoginRecord, password: string) {
  if (!mitra.isActive) {
    return buildFailedLogin("Akun mitra tidak aktif", 403);
  }

  const isValid = await compare(password, mitra.passwordHash!);
  if (!isValid) {
    return buildFailedLogin("Password salah");
  }

  return null;
}

async function buildSuccessfulLogin(
  mitra: MitraLoginRecord,
  tokenPayload: ReturnType<typeof buildMitraTokenPayload>,
) {
  return {
    found: true as const,
    success: true as const,
    data: {
      token: await signMobileToken(tokenPayload),
      refreshToken: await signMobileRefreshToken(tokenPayload),
      user: {
        id: mitra.id,
        name: mitra.name,
        email: mitra.email,
        role: "MITRA",
        employeeType: mitra.mitraType,
        isSales: mitra.mitraType === "MITRA_SALES",
        features: getMitraMobileFeatures(mitra.mitraType),
      },
    },
  };
}

function buildMitraTokenPayload(
  mitra: MitraLoginRecord,
  input: MobileLoginPayload,
) {
  return {
    id: mitra.id,
    email: mitra.email,
    name: mitra.name,
    role: "MITRA",
    mitraType: mitra.mitraType,
    appVersionCode: input.versionCode,
    appVersionName: input.versionName || null,
    tenantId: mitra.tenantId,
  };
}

function buildFailedLogin(error: string, status = 401) {
  return { found: true as const, success: false as const, error, status };
}
