import { compare } from "bcryptjs";

import {
  INVESTOR_MOBILE_ROLE,
  signInvestorMobileTokens,
  verifyInvestorMobileToken,
  type VersiAplikasiInvestor,
} from "@/lib/mobile-investor-auth";
import { prismaAuth } from "@/modules/database";
import { InvestorRepository } from "../repositories/InvestorRepository";

const STATUS_TIDAK_AKTIF = 403;
const PESAN_PASSWORD_SALAH = "Password salah";
const PESAN_TIDAK_AKTIF = "Akun investor dinonaktifkan. Silakan hubungi Admin.";

/** Masukan login mobile; field `email` berisi username atau email investor. */
export interface MobileInvestorLoginInput {
  email: string;
  password: string;
  versionCode: number;
  versionName?: string | null;
}

/** Profil investor yang dikirim ke aplikasi mobile (login & `/me`). */
export interface MobileInvestorProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  role: typeof INVESTOR_MOBILE_ROLE;
  tenantId: string | null;
  perusahaan: string | null;
  noTelp: string | null;
  features: string[];
}

/** Bentuk sama dengan `MobileLoginResult` modul users agar bisa masuk rantai login. */
export type MobileInvestorLoginResult =
  | { found: false }
  | { found: true; success: false; error: string; status: number }
  | {
      found: true;
      success: true;
      data: { token: string; refreshToken: string; user: MobileInvestorProfile };
    };

type InvestorRecord = NonNullable<
  Awaited<ReturnType<InvestorRepository["findById"]>>
>;

function bangunProfil(investor: InvestorRecord): MobileInvestorProfile {
  return {
    id: investor.id,
    name: investor.namaLengkap,
    email: investor.email ?? investor.username,
    username: investor.username,
    role: INVESTOR_MOBILE_ROLE,
    tenantId: investor.tenantId,
    perusahaan: investor.perusahaan,
    noTelp: investor.noTelp,
    features: [],
  };
}

function gagal(error: string, status = 401): MobileInvestorLoginResult {
  return { found: true, success: false, error, status };
}

/** Autentikasi akun investor dari aplikasi mobile: login, refresh, logout, profil. */
export class MobileInvestorAuthService {
  constructor(
    private readonly investorRepository = new InvestorRepository(prismaAuth),
  ) {}

  /**
   * Login investor. `found: false` bila identitas bukan milik investor, supaya
   * rantai login mobile lanjut/berhenti seperti tipe akun lain.
   */
  async tryLogin(input: MobileInvestorLoginInput): Promise<MobileInvestorLoginResult> {
    const investor = await this.investorRepository.findByLoginIdentifier(
      input.email.trim(),
    );
    if (!investor?.passwordHash) return { found: false };
    if (!investor.isActive) return gagal(PESAN_TIDAK_AKTIF, STATUS_TIDAK_AKTIF);
    if (!(await compare(input.password, investor.passwordHash))) {
      return gagal(PESAN_PASSWORD_SALAH);
    }

    const tokens = await signInvestorMobileTokens(investor, {
      versionCode: input.versionCode,
      versionName: input.versionName,
    });
    return {
      found: true,
      success: true,
      data: { ...tokens, user: bangunProfil(investor) },
    };
  }

  /** Menukar refresh token investor dengan pasangan token baru; null bila bukan token investor sah. */
  async refresh(refreshToken: string, versi: VersiAplikasiInvestor = {}) {
    const session = await verifyInvestorMobileToken(refreshToken, "refresh");
    if (!session) return null;
    const investor = await this.investorRepository.findById(session.id);
    if (!investor?.isActive) return null;
    return signInvestorMobileTokens(investor, versi);
  }

  /** Logout: semua token mobile investor ini tidak berlaku lagi. */
  async logout(investorId: string): Promise<void> {
    await this.investorRepository.incrementTokenVersion(investorId);
  }

  /** Profil investor aktif untuk `/api/mobile/auth/me`. */
  async getProfile(investorId: string): Promise<MobileInvestorProfile | null> {
    const investor = await this.investorRepository.findById(investorId);
    return investor?.isActive ? bangunProfil(investor) : null;
  }
}

let mobileInvestorAuthService: MobileInvestorAuthService | null = null;

/** Singleton service autentikasi investor mobile. */
export function getMobileInvestorAuthService() {
  mobileInvestorAuthService ??= new MobileInvestorAuthService();
  return mobileInvestorAuthService;
}

/** Fungsi rantai login mobile (dipanggil `modules/users` lewat public API). */
export function tryMobileInvestorLogin(input: MobileInvestorLoginInput) {
  return getMobileInvestorAuthService().tryLogin(input);
}
