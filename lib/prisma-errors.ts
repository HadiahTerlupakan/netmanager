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
