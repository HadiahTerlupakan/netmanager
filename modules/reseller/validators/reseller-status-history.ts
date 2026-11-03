import * as z from "zod";

import { normalizeBlankToUndefined } from "./shared";

export const MAX_STATUS_HISTORY_LIMIT = 100;
const DEFAULT_STATUS_HISTORY_LIMIT = 20;

/** Query `GET /api/admin/resellers/[id]/status-history`. */
export const listResellerStatusHistoryQuerySchema = z.object({
  page: z.preprocess(
    normalizeBlankToUndefined,
    z.coerce.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    normalizeBlankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_STATUS_HISTORY_LIMIT)
      .default(DEFAULT_STATUS_HISTORY_LIMIT),
  ),
});

export type ListResellerStatusHistoryQuery = z.infer<
  typeof listResellerStatusHistoryQuerySchema
>;
