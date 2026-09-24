import crypto from "crypto";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Generic mobile idempotency middleware untuk endpoint mutation yang dipanggil
 * lewat SyncService offline replay. Tanpa middleware ini, replay yang gagal
 * di-network mid-stream akan create duplicate record (work-order, inventory,
 * leave). Pattern mirror dari `AttendanceIdempotencyService`, tapi key
 * di-namespace per-endpoint sehingga reusable lintas modul.
 *
 * Caller pattern:
 *   const result = await withIdempotency({
 *     scope: "inventory:barang-masuk",
 *     userId, requestId, payload: body,
 *     handler: async () => doActualWork(body),
 *   });
 *   return result.replayed
 *     ? respond(result.response, { headers: { "X-Idempotent-Replay": "true" } })
 *     : respond(result.response);
 *
 * Skenario state machine:
 *   - acquired   → first request: jalankan handler, simpan response
 *   - in-progress → request kedua sebelum first selesai (race) → 409
 *     (kunci IN_PROGRESS ber-TTL pendek: bila proses mati di tengah handler,
 *     kunci yatim kedaluwarsa sendiri dan replay berikutnya diproses ulang)
 *   - completed  → replay → return cached response
 *   - hash-mismatch → key sama tapi payload beda → 409 (likely client bug)
 *   - unavailable → Redis down → 503 (caller decide retry)
 */

type IdempotencyState<T = unknown> =
  | { status: "IN_PROGRESS"; payloadHash: string }
  | { status: "COMPLETED"; payloadHash: string; response: T };

/** TTL state COMPLETED: jendela replay 24 jam (match dengan SyncService TTL). */
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/**
 * TTL state IN_PROGRESS. Harus lebih lama dari handler terpanjang yang wajar,
 * tetapi cukup pendek agar kunci yatim (pod di-kill saat rollout/OOM, sehingga
 * `catch` pelepas kunci tak pernah jalan) tidak memblokir replay 24 jam.
 * 120 detik = 2x timeout klien terpanjang (`HTTP_TIMEOUTS.long` 60 detik,
 * mobile-netmanager `src/constants/httpTimeouts.ts`) dan 4x
 * `terminationGracePeriodSeconds: 30` (`k8s/production/app-deployment.yaml`):
 * handler yang masih berjalan lewat dari itu sudah ditinggal kliennya.
 */
export const IN_PROGRESS_TTL_SECONDS = 120;

export type IdempotencyOutcome<T> =
  | { kind: "fresh"; response: T }
  | { kind: "replay"; response: T }
  | { kind: "in-progress" }
  | { kind: "hash-mismatch" }
  | { kind: "unavailable" }
  | { kind: "no-key"; response: T };

export interface IdempotencyOptions<T> {
  /** Logical group, e.g. "work-order:create", "inventory:masuk". */
  scope: string;
  /** Acting user (mobile session userId). Wajib untuk namespace key. */
  userId: string;
  /** Idempotency key dari header `Idempotency-Key` atau body.requestId. */
  requestId: string | null;
  /** Payload mutation — di-hash untuk deteksi key dipakai untuk payload beda. */
  payload: unknown;
  /** Handler bisnis yang akan dieksekusi sekali. */
  handler: () => Promise<T>;
  /** TTL state COMPLETED di Redis. Default 24 jam (match dengan SyncService TTL). */
  ttlSeconds?: number;
}

export class GenericIdempotencyService {
  /**
   * Eksekusi handler dengan dedup. Kalau requestId null/empty, langsung
   * jalan ke handler tanpa idempotency (caller yang tentukan apakah itu
   * dianggap warning atau error berdasarkan `kind: "no-key"`).
   */
  async execute<T>(
    opts: IdempotencyOptions<T>,
  ): Promise<IdempotencyOutcome<T>> {
    const { scope, userId, requestId, payload, handler } = opts;
    const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;

    if (!requestId || requestId.trim().length === 0) {
      const response = await handler();
      return { kind: "no-key", response };
    }

    const trimmedRequestId = requestId.trim();
    const key = this.buildKey(scope, userId, trimmedRequestId);
    const payloadHash = this.hashPayload(payload);

    const acquired = await this.tryAcquire(key, payloadHash);
    if (acquired === "unavailable") {
      return { kind: "unavailable" };
    }

    if (acquired === "acquired") {
      const response = await this.runHandlerReleasingOnFailure(key, handler);
      await this.persistCompletedOrLeaveToExpire(
        key,
        payloadHash,
        response,
        ttl,
      );
      return { kind: "fresh", response };
    }

    // Locked — cek state existing (bisa IN_PROGRESS dari race, atau COMPLETED replay).
    const existing = await this.readState<T>(key);
    if (!existing) {
      return { kind: "unavailable" };
    }

    if (existing.payloadHash !== payloadHash) {
      return { kind: "hash-mismatch" };
    }

    if (existing.status === "COMPLETED") {
      return { kind: "replay", response: existing.response };
    }

    return { kind: "in-progress" };
  }

  private buildKey(scope: string, userId: string, requestId: string): string {
    return `idempotency:${scope}:${userId}:${requestId}`;
  }

  private hashPayload(value: unknown): string {
    const normalized = this.normalize(value);
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex");
  }

  private normalize(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    // Payload hasil parse Zod (`z.coerce.date()`) berisi Date; tanpa ini
    // Object.entries(Date) kosong sehingga perubahan waktu tak terdeteksi.
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => this.normalize(v));
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, this.normalize(v)] as const);
    return Object.fromEntries(entries);
  }

  /**
   * Jalankan handler; bila handler melempar, lepas kunci IN_PROGRESS agar
   * retry klien langsung diproses, lalu teruskan galatnya.
   */
  private async runHandlerReleasingOnFailure<T>(
    key: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    try {
      return await handler();
    } catch (error) {
      await this.releaseInProgress(key).catch((releaseError) => {
        logger.warn(
          "[idempotency] failed to release in-progress key",
          releaseError,
        );
      });
      throw error;
    }
  }

  /**
   * Simpan state COMPLETED. Bila gagal (Redis putus setelah handler sukses),
   * data sudah tertulis: jangan melempar (klien akan retry → tulis ganda) dan
   * jangan lepas kunci. Kunci IN_PROGRESS dibiarkan kedaluwarsa lewat
   * `IN_PROGRESS_TTL_SECONDS`; selama itu replay mendapat 409 in-progress.
   */
  private async persistCompletedOrLeaveToExpire<T>(
    key: string,
    payloadHash: string,
    response: T,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.persistCompleted(key, payloadHash, response, ttlSeconds);
    } catch (error) {
      logger.warn(
        "[idempotency] failed to persist completed state, key left to expire",
        { key, error },
      );
    }
  }

  private async tryAcquire(
    key: string,
    payloadHash: string,
  ): Promise<"acquired" | "locked" | "unavailable"> {
    const state: IdempotencyState = { status: "IN_PROGRESS", payloadHash };
    try {
      const result = await redis.set(
        key,
        JSON.stringify(state),
        "EX",
        IN_PROGRESS_TTL_SECONDS,
        "NX",
      );
      return result === "OK" ? "acquired" : "locked";
    } catch (error) {
      logger.warn(
        "[idempotency] redis SET failed, treating as unavailable",
        error,
      );
      return "unavailable";
    }
  }

  private async readState<T>(key: string): Promise<IdempotencyState<T> | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as IdempotencyState<T>) : null;
    } catch {
      return null;
    }
  }

  private async persistCompleted<T>(
    key: string,
    payloadHash: string,
    response: T,
    ttlSeconds: number,
  ): Promise<void> {
    const state: IdempotencyState<T> = {
      status: "COMPLETED",
      payloadHash,
      response,
    };
    await redis.setex(key, ttlSeconds, JSON.stringify(state));
  }

  private async releaseInProgress(key: string): Promise<void> {
    const existing = await this.readState(key);
    if (existing?.status === "IN_PROGRESS") {
      await redis.del(key);
    }
  }
}

export const idempotencyService = new GenericIdempotencyService();

/**
 * Helper: ekstrak requestId dari header standar atau body.requestId.
 * Konsisten dengan `AttendanceIdempotencyService.resolveRequestId`.
 */
export function resolveIdempotencyKey(
  headerKey: string | null,
  bodyRequestId?: unknown,
): string | null {
  if (headerKey && headerKey.trim().length > 0) return headerKey.trim();
  if (typeof bodyRequestId === "string" && bodyRequestId.trim().length > 0) {
    return bodyRequestId.trim();
  }
  return null;
}
