/**
 * Extract error message from unknown error object.
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage: string,
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return defaultMessage;
}
