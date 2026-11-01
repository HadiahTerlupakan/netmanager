import { apiError, ErrorCodes } from "@/lib/api-response";

interface MasterDataFailureLike {
  status: number;
  error: string;
  details?: Record<string, string[]>;
}

const ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCodes.VALIDATION_ERROR,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
};

/**
 * Ubah hasil gagal service master data inventory menjadi respons API,
 * apa adanya: pesan untuk staf, status, dan rincian per kolom bila ada.
 */
export function masterDataFailureResponse(failure: MasterDataFailureLike) {
  return apiError(
    failure.error,
    ERROR_CODE_BY_STATUS[failure.status] ?? "INTERNAL_ERROR",
    {
      status: failure.status,
      ...(failure.details ? { details: failure.details } : {}),
    },
  );
}
