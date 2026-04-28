type ClientLogContext = Record<string, unknown>;

const formatClientMessage = (level: string, message: string) =>
  `[${new Date().toISOString()}] [${level}] ${message}`;

const normalizeContext = (args: unknown[]): ClientLogContext | undefined =>
  args.length > 0 ? { args } : undefined;

export const clientLogger = {
  info(message: string, ...args: unknown[]) {
    if (process.env.NODE_ENV === "development") {
      globalThis.console.info(
        formatClientMessage("INFO", message),
        normalizeContext(args),
      );
    }
  },

  warn(message: string, ...args: unknown[]) {
    globalThis.console.warn(
      formatClientMessage("WARN", message),
      normalizeContext(args),
    );
  },

  error(message: string, ...args: unknown[]) {
    globalThis.console.error(
      formatClientMessage("ERROR", message),
      normalizeContext(args),
    );
  },
};
