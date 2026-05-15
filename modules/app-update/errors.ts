export class AppUpdateValidationError extends Error {
  override readonly name = "AppUpdateValidationError" as const;
}

export class AppUpdateNotFoundError extends Error {
  override readonly name = "AppUpdateNotFoundError" as const;
  constructor(message = "Update tidak ditemukan") {
    super(message);
  }
}
