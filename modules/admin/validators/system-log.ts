import { z } from "zod";

import { LogType } from "../types/admin.enums";

const SEARCH_MAX_LENGTH = 200;
const LIMIT_MAX = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Zod schema untuk query params endpoint `GET /api/admin/system-logs`.
 * Cap upper bound limit untuk mencegah DoS, fallback default saat NaN.
 */
export const systemLogQuerySchema = z.object({
  page: z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
    const parsed = typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
  }),
  limit: z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
    const parsed = typeof v === "string" ? parseInt(v, 10) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(parsed, LIMIT_MAX);
  }),
  type: z
    .union([z.enum(LogType), z.null(), z.undefined()])
    .transform((v) => v ?? null),
  action: z
    .union([z.string().min(1).max(64), z.null(), z.undefined()])
    .transform((v) => v ?? null),
  siteId: z
    .union([z.uuid(), z.string().length(0), z.null(), z.undefined()])
    .transform((v) => (v && v.length > 0 ? v : null)),
  search: z
    .union([z.string().max(SEARCH_MAX_LENGTH), z.null(), z.undefined()])
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type SystemLogQuery = z.infer<typeof systemLogQuerySchema>;
