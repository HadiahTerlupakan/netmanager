import { logger } from "@/lib/logger";
import {
  generatePelangganAccessToken,
  generatePelangganRefreshToken,
  verifyPelangganRefreshToken,
} from "@/lib/jwt";
import { prismaAuth } from "@/modules/database";
import { compare } from "bcryptjs";
import type {
  MobileLoginPayload,
  MobileLoginResult,
} from "./MobileAuthRouteService";
import {
  buildVersionMetadata,
  buildVersionUpdate,
  MobileAuthVersionService,
} from "./MobileAuthVersionService";

const CUSTOMER_ROLE = "CUSTOMER";

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

type CustomerRefreshPayload = Awaited<
  ReturnType<typeof verifyPelangganRefreshToken>
>;

/** Mengelola login dan refresh token mobile customer. */
export class MobileCustomerAuthService {
  constructor(
    private readonly versionService = new MobileAuthVersionService(),
  ) {}

  /** Mencoba login mobile untuk customer. */
  async tryLogin(input: MobileLoginPayload): Promise<MobileLoginResult> {
    const customer = await findCustomerForLogin(input.email);
    if (!customer) return { found: false };
    if (!(await isCustomerPasswordValid(customer, input.password))) {
      return {
        found: true,
        success: false,
        error: "Password salah",
        status: 401,
      };
    }

    const unsupportedResponse =
      await this.versionService.buildUnsupportedVersionResponse(
        input.versionCode,
      );
    if (unsupportedResponse) {
      return { found: true, success: false, response: unsupportedResponse };
    }

    await persistCustomerVersion(customer.id, input);
    return buildSuccessfulCustomerLogin(customer, input);
  }

  /** Memperbarui access token customer dari refresh token. */
  async tryRefreshToken(refreshToken: string) {
    const verified = await verifyPelangganRefreshToken(refreshToken);
    if (!verified.valid) return null;

    const customer = await findCustomerForRefresh(verified.id);
    if (!customer || customer.status !== "AKTIF") return null;
    return this.buildCustomerRefreshResult(verified, customer);
  }

  private async buildCustomerRefreshResult(
    verified: CustomerRefreshPayload,
    customer: NonNullable<Awaited<ReturnType<typeof findCustomerForRefresh>>>,
  ) {
    const trustedVersion = resolveTrustedCustomerVersion(verified, customer);
    const unsupportedResponse =
      await this.versionService.buildUnsupportedVersionResponse(
        trustedVersion.trustedVersionCode,
      );
    if (unsupportedResponse) {
      return { kind: "unsupported" as const, response: unsupportedResponse };
    }

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
