import { vi } from "vitest";

/**
 * Complete logger mock untuk testing
 * Gunakan ini di semua test untuk menghindari error "logger.X is not a function"
 */
export const createLoggerMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  logActivity: vi.fn(),
  logActivitySafe: vi.fn(),
  logAuth: vi.fn(),
  apiRequest: vi.fn(),
  dbOperation: vi.fn(),
});

/**
 * Setup logger mock untuk vitest
 * Gunakan di vi.mock("@/lib/logger")
 */
export const setupLoggerMock = () => {
  const mock = createLoggerMock();
  return {
    logger: mock,
    ...mock,
  };
};
