import { logger, logActivitySafe } from "@/lib/logger";

const DEFAULT_MIN_WITHDRAW = 50000;

interface AttendanceSettingsReader {
  findByKey(key: string): Promise<{ value?: string | null } | null>;
}

interface PendingWithdrawCounter {
  countPendingWithdrawals(walletId: string): Promise<number>;
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

/** Validate wallet existence, balance, and active pending requests. */
export async function getWalletValidationError(input: {
  walletId?: string;
  balance?: number;
  amount: number;
  withdrawRepository: PendingWithdrawCounter;
}) {
  if (!input.walletId || input.balance === undefined) {
    return "Wallet tidak ditemukan";
  }

  if (input.balance < input.amount) {
    return "Saldo tidak cukup";
  }

  const pendingCount = await input.withdrawRepository.countPendingWithdrawals(
    input.walletId,
  );
  if (pendingCount > 0) {
    return "Masih ada request penarikan yang belum selesai";
  }

  return null;
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

/** Validate that a withdraw request matches the required workflow state. */
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

  if (input.request.status !== input.requiredStatus) {
    if (input.requiredStatus === input.pendingStatus) {
      return "Request sudah diproses";
    }

    return "Request belum disetujui";
  }

  if ((input.request.mitraWallet?.balance || 0) < input.request.amount) {
    return "Saldo mitra tidak cukup";
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
