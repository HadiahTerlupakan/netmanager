/**
 * Custom error untuk IP address conflict
 */
export class RouterIpConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterIpConflictError";
  }
}

/**
 * Custom error untuk router validation
 */
export class RouterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouterValidationError";
  }
}
