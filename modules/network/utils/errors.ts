export class RadiusConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadiusConnectionError';
    Object.setPrototypeOf(this, RadiusConnectionError.prototype);
  }
}
