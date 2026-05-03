export function isPrismaErrorCode(
  error: unknown,
  code: string,
): error is Error & { code?: string } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === code,
  );
}

export function isPrismaRecordNotFoundError(error: unknown) {
  return isPrismaErrorCode(error, "P2025");
}

export function isPrismaForeignKeyError(error: unknown): boolean {
  return isPrismaErrorCode(error, "P2003");
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, "P2002");
}

export function mapPrismaErrorToResponse(error: unknown): {
  status: number;
  body: { error: string };
} | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: string }).code;

  switch (code) {
    case "P2025":
      return { status: 404, body: { error: "Resource tidak ditemukan" } };
    case "P2002":
      return { status: 400, body: { error: "Data sudah ada (duplikat)" } };
    case "P2003":
      return {
        status: 400,
        body: { error: "Data tidak dapat dihapus karena masih digunakan" },
      };
    default:
      return null;
  }
}
