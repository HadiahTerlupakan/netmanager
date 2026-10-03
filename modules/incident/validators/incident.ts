import { z } from "zod";

import {
  ANALYTICS_WINDOW_DAYS,
  ANALYTICS_WINDOW_MAX_DAYS,
  ANALYTICS_WINDOW_MIN_DAYS,
} from "../services/IncidentService";

const JUDUL_MAKS = 200;
const PESAN_MAKS = 5000;
const AREA_MAKS = 100;
const JUMLAH_AREA_MAKS = 50;

const SEVERITY_VALUES = ["CRITICAL", "MAJOR", "MINOR"] as const;
const STATUS_VALUES = ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;

/** Body `POST /api/admin/incidents`. */
export const createIncidentSchema = z.object({
  title: z.string().trim().min(1).max(JUDUL_MAKS),
  description: z.string().trim().min(1).max(PESAN_MAKS),
  severity: z.enum(SEVERITY_VALUES),
  affectedAreas: z.array(z.string().trim().min(1).max(AREA_MAKS)).max(JUMLAH_AREA_MAKS).default([]),
  isPublic: z.boolean().optional(),
});

/** Body `POST /api/admin/incidents/[id]` (tambah update status). */
export const addIncidentUpdateSchema = z.object({
  status: z.enum(STATUS_VALUES),
  message: z.string().trim().min(1).max(PESAN_MAKS),
});

/** Query `GET /api/admin/incidents?status=`; nilai tak dikenal = tanpa saringan (perilaku lama). */
export const listIncidentQuerySchema = z.object({
  status: z.enum(["ACTIVE", ...STATUS_VALUES]).optional().catch(undefined),
});

/** Query `GET /api/admin/incidents/analytics?days=` (1–365, bawaan 30). */
export const incidentAnalyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(ANALYTICS_WINDOW_MIN_DAYS)
    .max(ANALYTICS_WINDOW_MAX_DAYS)
    .default(ANALYTICS_WINDOW_DAYS),
});
