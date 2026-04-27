export class RouteServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "RouteServiceError";
  }
}

/** Check whether an error matches route service error shape. */
export function isRouteServiceError(
  error: unknown,
): error is RouteServiceError {
  return error instanceof RouteServiceError;
}

/** Create a typed route service error. */
export function createRouteServiceError(message: string, status: number) {
  return new RouteServiceError(message, status);
}
