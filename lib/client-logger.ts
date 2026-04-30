type ClientLogContext = Record<string, unknown>;

const formatClientMessage = (level: string, message: string) =>
  `[${new Date().toISOString()}] [${level}] ${message}`;

const serializeLogArg = (arg: unknown) => {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      ...(arg.stack ? { stack: arg.stack } : {}),
    };
  }

  return arg;
};

const normalizeContext = (args: unknown[]): ClientLogContext | undefined =>
  args.length > 0 ? { args: args.map(serializeLogArg) } : undefined;

const formatArgSummary = (arg: unknown) => {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  if (typeof arg === "string") {
    return arg;
  }

  try {
    return JSON.stringify(serializeLogArg(arg));
  } catch {
    return String(arg);
  }
};

const appendArgSummary = (message: string, args: unknown[]) => {
  if (args.length === 0) {
    return message;
  }

  return `${message} ${args.map(formatArgSummary).join(" ")}`;
};

export const clientLogger = {
  info(message: string, ...args: unknown[]) {
    if (process.env.NODE_ENV === "development") {
      globalThis.console.info(
        formatClientMessage("INFO", appendArgSummary(message, args)),
        normalizeContext(args),
      );
    }
  },

  warn(message: string, ...args: unknown[]) {
    globalThis.console.warn(
      formatClientMessage("WARN", appendArgSummary(message, args)),
      normalizeContext(args),
    );
  },

  error(message: string, ...args: unknown[]) {
    globalThis.console.error(
      formatClientMessage("ERROR", appendArgSummary(message, args)),
      normalizeContext(args),
    );
  },
};
