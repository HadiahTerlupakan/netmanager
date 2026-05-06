/**
 * Utility untuk handle error messages di RADIUS module
 */

export function getRadiusErrorMessage(
  error: unknown,
  defaultMessage: string,
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return defaultMessage;
}
