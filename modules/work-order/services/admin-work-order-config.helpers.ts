import { ErrorCodes } from "@/lib/api";

type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

type PaginationPayload<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type { PaginationPayload, ServiceResult };

export async function getPaginatedResult<
  TQuery extends { page?: number; limit?: number },
  TItem,
>(
  query: TQuery,
  handler: (query: TQuery) => Promise<{ data: TItem[]; total: number }>,
): Promise<ServiceResult<PaginationPayload<TItem>>> {
  try {
    const result = await handler(query);
    return {
      success: true,
      data: buildPaginationPayload(result, query),
    };
  } catch {
    return createInternalErrorResult("Gagal mengambil data konfigurasi");
  }
}

export async function getSingleResult<T>(
  handler: () => Promise<T | null>,
  resource: string,
): Promise<ServiceResult<T>> {
  try {
    const data = await handler();
    if (!data) {
      return createNotFoundResult(resource);
    }
    return { success: true, data };
  } catch {
    return createInternalErrorResult(
      `Gagal mengambil ${resource.toLowerCase()}`,
    );
  }
}

export async function updateSingleResult<T>(input: {
  finder: () => Promise<T | null>;
  updater: () => Promise<T>;
  resource: string;
  errorMessage: string;
}): Promise<ServiceResult<T>> {
  try {
    const current = await input.finder();
    if (!current) {
      return createNotFoundResult(input.resource);
    }
    return { success: true, data: await input.updater() };
  } catch {
    return createInternalErrorResult(input.errorMessage);
  }
}

export async function runConfigAction<T>(
  handler: () => Promise<T>,
  errorMessage: string,
): Promise<ServiceResult<T>> {
  try {
    return { success: true, data: await handler() };
  } catch {
    return createInternalErrorResult(errorMessage);
  }
}

export function mapSlaResponse<T extends Record<string, unknown>>(sla: T) {
  const { workOrderEscalations, ...rest } = sla;
  return { ...rest, escalations: workOrderEscalations };
}

export function createNotFoundResult(resource: string): ServiceResult<never> {
  return {
    success: false,
    error: `${resource} tidak ditemukan`,
    code: ErrorCodes.NOT_FOUND,
  };
}

export function createValidationResult(message: string): ServiceResult<never> {
  return {
    success: false,
    error: message,
    code: ErrorCodes.VALIDATION_ERROR,
  };
}

function buildPaginationPayload<T>(
  result: { data: T[]; total: number },
  query: { page?: number; limit?: number },
): PaginationPayload<T> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  return {
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
}

function createInternalErrorResult<T>(message: string): ServiceResult<T> {
  return {
    success: false,
    error: message,
    code: ErrorCodes.INTERNAL_ERROR,
  };
}
