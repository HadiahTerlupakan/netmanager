export class AppReleaseNotFoundError extends Error {
  constructor(id: string) {
    super(`App release dengan id ${id} tidak ditemukan`);
    this.name = "AppReleaseNotFoundError";
  }
}

export class AppReleaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppReleaseValidationError";
  }
}
