import { logger, logActivitySafe } from "@/lib/logger";

const DEFAULT_MIN_WITHDRAW = 50000;

interface AttendanceSettingsReader {
  findByKey(key: string): Promise<{ value?: string | null } | null>;
}

/** Resolve the active minimum withdraw setting with a safe fallback. */
export async function resolveMinWithdraw(
  attendanceSettingsService: AttendanceSettingsReader,
) {
  try {
    const setting =
      await attendanceSettingsService.findByKey("mitra_min_withdraw");
    return setting?.value ? parseFloat(setting.value) : DEFAULT_MIN_WITHDRAW;
  } catch {
    return DEFAULT_MIN_WITHDRAW;
  }
}

/** Validate the requested amount against the effective minimum withdraw rule. */
export async function getMinimumWithdrawValidationError(input: {
  amount: number;
  minWithdrawal: number | null;
  attendanceSettingsService: AttendanceSettingsReader;
}) {
  const minWithdraw =
    input.minWithdrawal ??
    (await resolveMinWithdraw(input.attendanceSettingsService));

  if (input.amount >= minWithdraw) {
    return null;
  }

  return `Minimum penarikan Anda adalah Rp ${minWithdraw.toLocaleString("id-ID")}`;
}

/** Validate that a withdraw request is still pending. */
export function getPendingRequestValidationError(
  request: { status: string } | null,
) {
  if (!request) {
    return "Request tidak ditemukan";
  }

  if (request.status !== "PENDING") {
    return "Request sudah diproses";
  }

  return null;
}

/**
 * Validate that a withdraw request matches the required workflow state.
 * Note: 26 baris - sudah optimal dengan sequential validation steps.
 * Memecah lebih lanjut akan memisahkan validation logic yang harus berurutan.
 */
export function getApprovalRequestValidationError(input: {
  request: {
    status: string;
    amount: number;
    mitraWallet?: { balance: number };
  } | null;
  requiredStatus: string;
  pendingStatus: string;
}) {
  if (!input.request) {
    return "Request tidak ditemukan";
  }

  const statusError = validateRequestStatus(
    input.request.status,
    input.requiredStatus,
    input.pendingStatus,
  );
  if (statusError) return statusError;

  if ((input.request.mitraWallet?.balance || 0) < input.request.amount) {
    return "Saldo mitra tidak cukup";
  }

  return null;
}

function validateRequestStatus(
  currentStatus: string,
  requiredStatus: string,
  pendingStatus: string,
) {
  if (currentStatus !== requiredStatus) {
    if (requiredStatus === pendingStatus) {
      return "Request sudah diproses";
    }
    return "Request belum disetujui";
  }
  return null;
}

/** Write withdraw workflow activity to the shared audit logger. */
export function logWithdrawActivity(
  action: string,
  userId: string,
  details: Record<string, unknown>,
) {
  logActivitySafe({ action, subject: "WithdrawRequest", userId, details });
}

/** Log and standardize the generic request-withdraw error path. */
export function logWithdrawServiceError(message: string, error: unknown) {
  logger.error(message, error as Error);
}
