export class AppVersionValidationError extends Error {
  override readonly name = "AppVersionValidationError" as const;
}

export class AppVersionConflictError extends Error {
  override readonly name = "AppVersionConflictError" as const;
}

export class AppVersionNotFoundError extends Error {
  override readonly name = "AppVersionNotFoundError" as const;
  constructor(message = "Versi tidak ditemukan") {
    super(message);
  }
}
