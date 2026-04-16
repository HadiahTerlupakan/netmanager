import { compare } from "bcryptjs";
import { generatePelangganTokenPair } from "@/lib/jwt";
import {
  checkStrictLoginRateLimit,
  isLoginRateLimitEnabled,
  LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
} from "@/lib/security/login-rate-limit";
import { PelangganRepository } from "../repositories/PelangganRepository";

interface LoginResult {
  success: boolean;
  customer?: {
    id: string;
    idPelanggan: string;
    nama: string;
    email: string | null;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
  message?: string;
}

/**
 * Service for customer authentication
 */
export class CustomerAuthService {
  private pelangganRepository: PelangganRepository;

  constructor() {
    this.pelangganRepository = new PelangganRepository();
  }

  /**
   * Authenticate customer with identifier and password
   */
  async login(identifier: string, password: string): Promise<LoginResult> {
    // Input validation
    if (!identifier || !password) {
      return {
        success: false,
        error: "ID Pelanggan/Email dan password harus diisi",
      };
    }

    if (isLoginRateLimitEnabled()) {
      const identifierKey = identifier.toLowerCase().trim();
      const rateLimitResult = await checkStrictLoginRateLimit(
        `customer_login:${identifierKey}`,
        10,
        60,
      );

      if (rateLimitResult === "unavailable") {
        return {
          success: false,
          error: LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE,
        };
      }

      if (rateLimitResult === "rate_limited") {
        return {
          success: false,
          error: "Terlalu banyak percobaan login",
          message: "Silakan tunggu 1 menit sebelum mencoba lagi.",
        };
      }
    }

    // Find customer
    const pelanggan = await this.findCustomerByIdentifier(identifier);

    if (!pelanggan) {
      return {
        success: false,
        error: "ID Pelanggan atau password salah",
      };
    }

    // Check if password is set
    if (!pelanggan.passwordHash) {
      return {
        success: false,
        error: "Akun belum diaktifkan",
        message:
          "Silakan hubungi customer service untuk mengaktifkan akun portal Anda",
      };
    }

    // Verify password
    const isPasswordValid = await compare(password, pelanggan.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: "ID Pelanggan atau password salah",
      };
    }

    // Check status
    if (pelanggan.status !== "AKTIF") {
      return {
        success: false,
        error: "Akun tidak aktif",
        message:
          "Status layanan Anda sedang tidak aktif. Hubungi customer service untuk informasi lebih lanjut.",
      };
    }

    // Generate tokens
    const tokens = await generatePelangganTokenPair({
      id: pelanggan.id,
      idPelanggan: pelanggan.idPelanggan,
      nama: pelanggan.nama,
      username: pelanggan.username,
      status: pelanggan.status,
      tenantId: pelanggan.tenantId,
    });

    return {
      success: true,
      customer: {
        id: pelanggan.id,
        idPelanggan: pelanggan.idPelanggan,
        nama: pelanggan.nama,
        email: pelanggan.email,
      },
      tokens,
    };
  }

  /**
   * Find customer by ID or email
   */
  private async findCustomerByIdentifier(identifier: string) {
    return this.pelangganRepository.findByIdentifierForAuth(identifier);
  }
}
