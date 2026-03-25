export {};

declare global {
  var wsLogInterval: NodeJS.Timeout | undefined;
  var wsApiLogInterval: NodeJS.Timeout | undefined;
  var socketIOServer: unknown; // Using unknown instead of any to satisfy ESLint
}
