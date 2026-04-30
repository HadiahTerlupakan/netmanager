import bcrypt from "bcryptjs";
import { prisma, prismaMitra } from "@/modules/database";
import { ErrorCodes, type ErrorCode } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const PASSWORD_HASH_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

type MobilePasswordAuth = {
  id: string;
  tenantId: string;
  role?: string;
};

type MobilePasswordInput = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export class MobilePasswordChangeError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Changes a mobile user's password after validating current credentials. */
export async function changeMobilePassword(options: {
  auth: MobilePasswordAuth;
  input: MobilePasswordInput;
}) {
  validatePasswordInput(options.input);

  const passwordHash = await findCurrentPasswordHash(options.auth);
  if (!passwordHash) {
    throw new MobilePasswordChangeError(
      "Password belum diatur, silakan hubungi admin",
      ErrorCodes.VALIDATION_ERROR,
      400,
    );
  }

  await assertCurrentPassword(options.input.currentPassword!, passwordHash);
  const newPasswordHash = await bcrypt.hash(
    options.input.newPassword!,
    PASSWORD_HASH_ROUNDS,
  );

  await updatePasswordHash(options.auth, newPasswordHash);
  await logPasswordChange(options.auth);
}

function validatePasswordInput(input: MobilePasswordInput) {
  if (!input.currentPassword || !input.newPassword || !input.confirmPassword) {
    throw new MobilePasswordChangeError(
      "Password lama, password baru, dan konfirmasi password wajib diisi",
      ErrorCodes.VALIDATION_ERROR,
      400,
    );
  }

  if (input.newPassword !== input.confirmPassword) {
    throw new MobilePasswordChangeError(
      "Password baru dan konfirmasi password tidak cocok",
      ErrorCodes.VALIDATION_ERROR,
      400,
    );
  }

  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new MobilePasswordChangeError(
      "Password harus minimal 6 karakter",
      ErrorCodes.VALIDATION_ERROR,
      400,
    );
  }
}

async function findCurrentPasswordHash(auth: MobilePasswordAuth) {
  if (auth.role === "MITRA") return findMitraPasswordHash(auth.id);
  if (auth.role === "CUSTOMER") return findCustomerPasswordHash(auth);
  return findUserPasswordHash(auth);
}

async function findMitraPasswordHash(id: string) {
  const mitra = await prismaMitra.mitra.findUnique({
    where: { id },
    select: { passwordHash: true },
  });
  if (!mitra) throwNotFound("User Mitra tidak ditemukan");
  return mitra.passwordHash;
}

async function findCustomerPasswordHash(auth: MobilePasswordAuth) {
  const customer = await prisma.pelanggan.findFirst({
    where: { id: auth.id, tenantId: auth.tenantId },
    select: { passwordHash: true },
  });
  if (!customer) throwNotFound("User Pelanggan tidak ditemukan");
  return customer.passwordHash;
}

async function findUserPasswordHash(auth: MobilePasswordAuth) {
  const user = await prisma.user.findFirst({
    where: { id: auth.id, tenantId: auth.tenantId },
    select: { passwordHash: true },
  });
  if (!user) throwNotFound("User tidak ditemukan");
  return user.passwordHash;
}

function throwNotFound(message: string): never {
  throw new MobilePasswordChangeError(message, ErrorCodes.NOT_FOUND, 404);
}

async function assertCurrentPassword(
  currentPassword: string,
  passwordHash: string,
) {
  const isValidPassword = await bcrypt.compare(currentPassword, passwordHash);

  if (!isValidPassword) {
    throw new MobilePasswordChangeError(
      "Password lama salah",
      ErrorCodes.VALIDATION_ERROR,
      400,
    );
  }
}

function updatePasswordHash(auth: MobilePasswordAuth, passwordHash: string) {
  if (auth.role === "MITRA") {
    return prismaMitra.mitra.update({
      where: { id: auth.id },
      data: { passwordHash },
    });
  }

  if (auth.role === "CUSTOMER") {
    return prisma.pelanggan.update({
      where: { id: auth.id, tenantId: auth.tenantId },
      data: { passwordHash },
    });
  }

  return prisma.user.update({
    where: { id: auth.id, tenantId: auth.tenantId },
    data: { passwordHash },
  });
}

function logPasswordChange(auth: MobilePasswordAuth) {
  return logger.logActivity({
    action: "UPDATE",
    subject: "Password Change",
    details: {
      method: "mobile_app",
      role: auth.role || "USER",
      timestamp: new Date().toISOString(),
    },
    userId: auth.id,
    tenantId: auth.tenantId,
  });
}
