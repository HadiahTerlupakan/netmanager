import { logger } from "@/lib/logger";

/** Tampil di kolom Portal pada Log Login. */
const MOBILE_PORTAL = "Aplikasi Mobile";

/** Aksi Log Login saat versi aplikasi ditolak karena sudah tidak didukung. */
export const OUTDATED_APP_REJECTED_ACTION = "LOGIN_REJECTED_OUTDATED_APP";

type AccountType = "EMPLOYEE" | "MITRA" | "CUSTOMER" | "INVESTOR";

const NON_EMPLOYEE_ACTOR: Record<Exclude<AccountType, "EMPLOYEE">, string> = {
  MITRA: "mitra",
  CUSTOMER: "customer",
  INVESTOR: "investor",
};

export interface RequestOrigin {
  ipAddress?: string;
  userAgent?: string;
}

interface AppVersion {
  versionCode: number;
  versionName: string | null | undefined;
}

const versionLabel = (version: AppVersion) =>
  `${version.versionName || "?"} (build ${version.versionCode})`;

function accountTypeOf(role: unknown): AccountType {
  return role === "MITRA" || role === "CUSTOMER" || role === "INVESTOR"
    ? role
    : "EMPLOYEE";
}

/** Pemilik catatan: karyawan lewat userId, akun lain lewat actor. */
function ownerOf(accountType: AccountType, id: string) {
  return accountType === "EMPLOYEE"
    ? { userId: id }
    : { actor: { type: NON_EMPLOYEE_ACTOR[accountType], id } };
}

function record(entry: Parameters<typeof logger.logAuth>[0]) {
  // Log login tidak boleh menggagalkan atau memperlambat login itu sendiri.
  void logger.logAuth(entry).catch((): undefined => undefined);
}

/** Login aplikasi mobile yang berhasil, untuk semua jenis akun. */
export function recordMobileLogin(input: {
  user: { id?: unknown; name?: unknown; email?: unknown; role?: unknown };
  version: AppVersion;
  origin: RequestOrigin;
}) {
  if (typeof input.user.id !== "string") return;
  const accountType = accountTypeOf(input.user.role);
  record({
    action: "LOGIN",
    ...ownerOf(accountType, input.user.id),
    ipAddress: input.origin.ipAddress,
    userAgent: input.origin.userAgent,
    details: {
      email: input.user.email,
      name: input.user.name,
      role: input.user.role,
      portal: MOBILE_PORTAL,
      accountType,
      appVersion: versionLabel(input.version),
      loginTime: new Date().toISOString(),
    },
  });
}

/**
 * Login atau refresh yang ditolak karena versi aplikasi di bawah versi
 * minimum. Dicatat per login/refresh, bukan per request, agar log tidak
 * banjir oleh aplikasi yang terus mencoba.
 */
export function recordOutdatedAppRejected(input: {
  stage: "login" | "refresh";
  identifier?: string | null;
  account?: { id: string; role?: unknown } | null;
  version: AppVersion;
  minimum: { versionCode: number; versionName: string | null } | null;
  origin: RequestOrigin;
}) {
  const accountType = input.account ? accountTypeOf(input.account.role) : null;
  record({
    action: OUTDATED_APP_REJECTED_ACTION,
    ...(input.account && accountType
      ? ownerOf(accountType, input.account.id)
      : {}),
    ipAddress: input.origin.ipAddress,
    userAgent: input.origin.userAgent,
    details: {
      email: input.identifier ?? undefined,
      portal: MOBILE_PORTAL,
      accountType: accountType ?? undefined,
      stage: input.stage,
      appVersion: versionLabel(input.version),
      requiredVersion: input.minimum ? versionLabel(input.minimum) : undefined,
      loginTime: new Date().toISOString(),
    },
  });
}
