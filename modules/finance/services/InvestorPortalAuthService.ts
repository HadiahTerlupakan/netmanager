import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { prismaAuth } from "@/modules/database";
import { InvestorRepository } from "../repositories/InvestorRepository";

const INVESTOR_ROLE = "INVESTOR";
const TOKEN_EXPIRATION = "7d";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type InvestorLoginInput = {
  username: string;
  password: string;
};

export type InvestorLoginResult =
  | { success: true; token: string; user: InvestorTokenPayload }
  | { success: false; message: string; status: number };

export type InvestorTokenPayload = {
  id: string;
  username: string;
  namaLengkap: string;
  role: string;
  tenantId: string | null;
};

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

function buildTokenPayload(investor: {
  id: string;
  username: string;
  namaLengkap: string;
  tenantId: string | null;
}) {
  return {
    id: investor.id,
    username: investor.username,
    namaLengkap: investor.namaLengkap,
    role: INVESTOR_ROLE,
    tenantId: investor.tenantId,
  } satisfies InvestorTokenPayload;
}

export class InvestorPortalAuthService {
  constructor(
    private readonly investorRepository = new InvestorRepository(prismaAuth),
  ) {}

  /** Memverifikasi login investor dan membuat JWT session. */
  async login(input: InvestorLoginInput): Promise<InvestorLoginResult> {
    const investor = await this.investorRepository.findByUsernameInsensitive(
      input.username,
    );
    if (!investor) return this.createFailedResult();
    if (!investor.isActive) return this.createInactiveResult();
    if (!(await this.isPasswordValid(input.password, investor.passwordHash))) {
      return this.createFailedResult();
    }

    const user = buildTokenPayload(investor);
    const token = await this.signToken(user);
    return { success: true, token, user };
  }

  /** Menghasilkan umur cookie session investor. */
  getCookieMaxAge() {
    return COOKIE_MAX_AGE;
  }

  private async signToken(payload: InvestorTokenPayload) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRATION)
      .sign(getSecret());
  }

  private async isPasswordValid(
    password: string,
    passwordHash?: string | null,
  ) {
    if (!passwordHash) {
      return false;
    }

    return compare(password, passwordHash);
  }

  private createFailedResult(): InvestorLoginResult {
    return {
      success: false,
      message: "Username atau Password salah",
      status: 401,
    };
  }

  private createInactiveResult(): InvestorLoginResult {
    return {
      success: false,
      message: "Akun dinonaktifkan. Silakan hubungi Admin.",
      status: 403,
    };
  }
}

let investorPortalAuthService: InvestorPortalAuthService | null = null;

export function getInvestorPortalAuthService() {
  if (!investorPortalAuthService) {
    investorPortalAuthService = new InvestorPortalAuthService();
  }

  return investorPortalAuthService;
}
