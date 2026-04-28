import { logger } from "@/lib/logger";
import type { IRegistrationRepository } from "../domain/ports/IRegistrationRepository";
import type {
  RegistrationStatus,
  UpdateRegistrationStatusData,
} from "../domain/entities/Registration";
import type {
  CreateRegistrationDTO,
  RegistrationDetailDTO,
  RegistrationListItemDTO,
  UpdateRegistrationStatusDTO,
} from "../dto/RegistrationDTO";
import { RegistrationMapper } from "../mappers/RegistrationMapper";
import { RegistrationRepository } from "../repositories/RegistrationRepository";

const CAPTCHA_ENABLED_KEY = "captcha_enabled";
const CAPTCHA_SECRET_KEY = "captcha_secret_key";
const CAPTCHA_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_STATUS: RegistrationStatus = "PENDING";
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const REGISTRATION_ERROR_MESSAGE = "Terjadi kesalahan saat menyimpan data.";
const CAPTCHA_REQUIRED_MESSAGE = "Verifikasi keamanan (Captcha) wajib diisi.";
const CAPTCHA_FAILED_MESSAGE = "Verifikasi Captcha gagal. Silakan coba lagi.";
const CAPTCHA_ERROR_MESSAGE = "Gagal memverifikasi captcha.";
const DUPLICATE_MESSAGE =
  "Email atau Nomor HP ini sudah terdaftar dan sedang menunggu verifikasi.";
const MISSING_NAME_MESSAGE = "Nama wajib diisi.";
const MISSING_EMAIL_MESSAGE = "Email wajib diisi.";
const MISSING_PHONE_MESSAGE = "Nomor HP wajib diisi.";
const MISSING_ADDRESS_MESSAGE = "Alamat wajib diisi.";
const INVALID_EMAIL_MESSAGE = "Format email tidak valid.";
const REJECTION_REASON_REQUIRED_MESSAGE = "Alasan penolakan wajib diisi";

const VALID_STATUS_TRANSITIONS: Record<
  RegistrationStatus,
  RegistrationStatus[]
> = {
  PENDING: ["VERIFIED", "REJECTED", "CANCELLED"],
  VERIFIED: ["SURVEYED", "CANCELLED"],
  SURVEYED: ["INSTALLED", "CANCELLED"],
  REJECTED: [],
  INSTALLED: [],
  CANCELLED: [],
};

export interface RegistrationResult<TData> {
  success: boolean;
  data?: TData;
  error?: string;
  statusCode?: number;
  allowedStatuses?: RegistrationStatus[];
}

export class RegistrationService {
  private readonly repository: IRegistrationRepository;

  constructor(
    repository: IRegistrationRepository = new RegistrationRepository(),
  ) {
    this.repository = repository;
  }

  /** Register a new customer request. */
  async register(
    input: CreateRegistrationDTO,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    const validationError = this.validateCreateInput(input);
    if (validationError) return this.failure(validationError, HTTP_BAD_REQUEST);

    const duplicate = await this.findPendingDuplicate(input);
    if (duplicate) return this.failure(DUPLICATE_MESSAGE, HTTP_CONFLICT);

    const captchaResult = await this.verifyCaptcha(
      input.turnstileToken,
      input.ipAddress,
    );
    if (!captchaResult.success) return captchaResult;

    return this.createRegistration(input);
  }

  /** List all registrations as DTOs. */
  async getAll(): Promise<RegistrationListItemDTO[]> {
    const registrations = await this.repository.findAll();
    return RegistrationMapper.toListDTOs(registrations);
  }

  /** Get registration detail by id. */
  async getById(id: string): Promise<RegistrationDetailDTO | null> {
    const registration = await this.repository.findById(id);
    if (!registration) return null;
    return RegistrationMapper.toDTO(registration);
  }

  /** Update registration status using validated transition rules. */
  async updateStatus(
    id: string,
    input: UpdateRegistrationStatusDTO,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    const current = await this.repository.findById(id);
    if (!current) return this.failure("Registrasi tidak ditemukan", 404);

    if (!this.canTransition(current.status, input.status)) {
      return this.buildTransitionFailure(current.status);
    }

    if (input.status === "REJECTED" && !input.rejectionReason?.trim()) {
      return this.failure(REJECTION_REASON_REQUIRED_MESSAGE, HTTP_BAD_REQUEST);
    }

    const updateData = this.buildUpdateStatusData(current.notes, input);
    const updated = await this.repository.updateWithDetails(id, updateData);
    return { success: true, data: RegistrationMapper.toDTO(updated) };
  }

  /** Delete a registration by id. */
  async delete(id: string): Promise<boolean> {
    const registration = await this.repository.findById(id);
    if (!registration) return false;
    await this.repository.delete(id);
    return true;
  }

  /** Validate required fields for registration creation. */
  private validateCreateInput(input: CreateRegistrationDTO): string | null {
    if (!input.name?.trim()) return MISSING_NAME_MESSAGE;
    if (!input.email?.trim()) return MISSING_EMAIL_MESSAGE;
    if (!input.phone?.trim()) return MISSING_PHONE_MESSAGE;
    if (!input.address?.trim()) return MISSING_ADDRESS_MESSAGE;
    if (!this.isValidEmail(input.email)) return INVALID_EMAIL_MESSAGE;
    return null;
  }

  /** Check for duplicate pending registration. */
  private async findPendingDuplicate(input: CreateRegistrationDTO) {
    return this.repository.findByEmailOrPhone(
      input.email,
      input.phone,
      DEFAULT_STATUS,
    );
  }

  /** Verify captcha only when enabled by settings. */
  private async verifyCaptcha(
    token?: string,
    ipAddress?: string,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    const isCaptchaEnabled = await this.isCaptchaEnabled();
    if (!isCaptchaEnabled) return { success: true };
    if (!token) return this.failure(CAPTCHA_REQUIRED_MESSAGE, HTTP_BAD_REQUEST);

    const secretKey = await this.repository.getSettingValue(CAPTCHA_SECRET_KEY);
    if (!secretKey) return { success: true };

    return this.submitCaptchaVerification(secretKey, token, ipAddress);
  }

  /** Create registration and map it to response DTO. */
  private async createRegistration(
    input: CreateRegistrationDTO,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    try {
      const registration = await this.repository.create(
        this.toCreateData(input),
      );
      return { success: true, data: RegistrationMapper.toDTO(registration) };
    } catch (error) {
      logger.error("[RegistrationService] Error creating registration:", error);
      return this.failure(
        REGISTRATION_ERROR_MESSAGE,
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Build update payload for repository. */
  private buildUpdateStatusData(
    currentNotes: string | null,
    input: UpdateRegistrationStatusDTO,
  ): UpdateRegistrationStatusData {
    return {
      status: input.status,
      notes: input.notes ?? currentNotes,
      rejectionReason:
        input.status === "REJECTED" ? (input.rejectionReason ?? null) : null,
      verifiedAt: input.status === "VERIFIED" ? new Date() : null,
      verifiedBy:
        input.status === "VERIFIED" ? (input.verifiedBy ?? "admin") : null,
    };
  }

  /** Build failure response for invalid status transition. */
  private buildTransitionFailure(
    currentStatus: RegistrationStatus,
  ): RegistrationResult<RegistrationDetailDTO> {
    const allowedStatuses = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
    return {
      success: false,
      error: `Tidak dapat mengubah status dari ${currentStatus} ke status baru`,
      statusCode: HTTP_BAD_REQUEST,
      allowedStatuses,
    };
  }

  /** Check whether a transition between statuses is allowed. */
  private canTransition(
    currentStatus: RegistrationStatus,
    nextStatus: RegistrationStatus,
  ): boolean {
    const allowedStatuses = VALID_STATUS_TRANSITIONS[currentStatus] ?? [];
    return allowedStatuses.includes(nextStatus);
  }

  /** Check whether captcha verification is enabled. */
  private async isCaptchaEnabled(): Promise<boolean> {
    const value = await this.repository.getSettingValue(CAPTCHA_ENABLED_KEY);
    return value === "true";
  }

  /** Submit captcha verification to Cloudflare. */
  private async submitCaptchaVerification(
    secretKey: string,
    token: string,
    ipAddress?: string,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    try {
      const response = await fetch(CAPTCHA_VERIFY_URL, {
        method: "POST",
        body: this.buildCaptchaFormData(secretKey, token, ipAddress),
      });
      const outcome = await response.json();
      if (outcome.success) return { success: true };
      return this.failure(CAPTCHA_FAILED_MESSAGE, HTTP_BAD_REQUEST);
    } catch (error) {
      logger.error("[RegistrationService] Captcha verification error:", error);
      return this.failure(CAPTCHA_ERROR_MESSAGE, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /** Create form data payload for captcha verification. */
  private buildCaptchaFormData(
    secretKey: string,
    token: string,
    ipAddress?: string,
  ): FormData {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ipAddress) formData.append("remoteip", ipAddress);
    return formData;
  }

  /** Map request DTO to repository create data. */
  private toCreateData(input: CreateRegistrationDTO) {
    return {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      location: input.location,
      packageName: input.packageName,
      notes: input.notes,
      ipAddress: input.ipAddress,
      status: DEFAULT_STATUS,
    };
  }

  /** Build a standardized failure result. */
  private failure<TData>(
    error: string,
    statusCode: number,
  ): RegistrationResult<TData> {
    return { success: false, error, statusCode };
  }

  /** Validate basic email format. */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
