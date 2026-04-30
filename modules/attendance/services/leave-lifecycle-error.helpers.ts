import { logger } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import type { Prisma } from "@prisma/client";
import type { ServiceResult } from "./LeaveService";

type LeaveResult = ServiceResult<Prisma.LeaveRequestGetPayload<object>>;

const NOT_FOUND_RESULT = {
  success: false,
  error: "Cuti tidak ditemukan",
  code: "NOT_FOUND",
} as const;

export function createLeaveFailureResult(
  error: string,
  code: string,
): LeaveResult {
  return { success: false, error, code };
}

export function handleLeaveError(
  message: string,
  error: unknown,
  fallbackError: string,
  code: string,
): LeaveResult {
  logger.error(message, error instanceof Error ? error : undefined);
  return createLeaveFailureResult(fallbackError, code);
}

export function handleDeleteLeaveError(error: unknown): ServiceResult<void> {
  logger.error(
    "LeaveService.deleteLeave failed",
    error instanceof Error ? error : undefined,
  );
  if (isPrismaRecordNotFoundError(error)) return NOT_FOUND_RESULT;
  return {
    success: false,
    error: "Gagal menghapus cuti",
    code: "DELETE_ERROR",
  };
}
