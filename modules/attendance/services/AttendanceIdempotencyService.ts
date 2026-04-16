import crypto from "crypto";
import { redis } from "@/lib/redis";

export type AttendanceAction = "check-in" | "check-out";

type IdempotencyState<T = unknown> =
  | {
      status: "IN_PROGRESS";
      payloadHash: string;
    }
  | {
      status: "COMPLETED";
      payloadHash: string;
      response: T;
    };

type BeginResult =
  | "started"
  | "in-progress"
  | "completed"
  | "hash-mismatch"
  | "unavailable";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export class AttendanceIdempotencyService {
  resolveRequestId(
    headerRequestId: string | null,
    bodyRequestId?: string,
  ): string | null {
    if (headerRequestId && headerRequestId.trim().length > 0) {
      return headerRequestId.trim();
    }

    if (bodyRequestId && bodyRequestId.trim().length > 0) {
      return bodyRequestId.trim();
    }

    return null;
  }

  buildPayloadHash(payload: unknown): string {
    const normalizedPayload = this.normalizeValue(payload);
    const payloadString = JSON.stringify(normalizedPayload);

    return crypto.createHash("sha256").update(payloadString).digest("hex");
  }

  async begin(
    userId: string,
    action: string,
    requestId: string,
    payloadHash: string,
  ): Promise<BeginResult> {
    const key = this.buildKey(userId, action as AttendanceAction, requestId);
    const started = await this.setInProgressIfAbsent(key, payloadHash);

    if (started === "acquired") {
      return "started";
    }

    if (started === "unavailable") {
      return "unavailable";
    }

    const existing = await this.getState(key);

    if (!existing) {
      return "unavailable";
    }

    if (existing.payloadHash !== payloadHash) {
      return "hash-mismatch";
    }

    if (existing.status === "COMPLETED") {
      return "completed";
    }

    return "in-progress";
  }

  async complete<T>(
    userId: string,
    action: string,
    requestId: string,
    payloadHash: string,
    response: T,
  ): Promise<void> {
    const key = this.buildKey(userId, action as AttendanceAction, requestId);

    await this.setState(key, {
      status: "COMPLETED",
      payloadHash,
      response,
    });
  }

  async getReplay<T>(
    userId: string,
    action: string,
    requestId: string,
  ): Promise<T | null> {
    const key = this.buildKey(userId, action as AttendanceAction, requestId);
    const state = await this.getState<T>(key);

    if (!state || state.status !== "COMPLETED") {
      return null;
    }

    return state.response;
  }

  async release(
    userId: string,
    action: string,
    requestId: string,
  ): Promise<void> {
    const key = this.buildKey(userId, action as AttendanceAction, requestId);
    const state = await this.getState(key);

    if (state?.status === "IN_PROGRESS") {
      await this.deleteState(key);
    }
  }

  private buildKey(
    userId: string,
    action: AttendanceAction,
    requestId: string,
  ): string {
    return `attendance:idempotency:${userId}:${action}:${requestId}`;
  }

  private normalizeValue(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item));
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => [key, this.normalizeValue(item)]);

    return Object.fromEntries(entries);
  }

  private async setInProgressIfAbsent(
    key: string,
    payloadHash: string,
  ): Promise<"acquired" | "locked" | "unavailable"> {
    const state: IdempotencyState = {
      status: "IN_PROGRESS",
      payloadHash,
    };

    const serializedState = JSON.stringify(state);

    try {
      const result = await redis.set(
        key,
        serializedState,
        "EX",
        DEFAULT_TTL_SECONDS,
        "NX",
      );
      if (result === "OK") {
        return "acquired";
      }

      return "locked";
    } catch {
      return "unavailable";
    }
  }

  private async getState<T = unknown>(
    key: string,
  ): Promise<IdempotencyState<T> | null> {
    try {
      const rawState = await redis.get(key);
      if (!rawState) {
        return null;
      }

      return JSON.parse(rawState) as IdempotencyState<T>;
    } catch {
      return null;
    }
  }

  private async setState<T = unknown>(
    key: string,
    state: IdempotencyState<T>,
  ): Promise<void> {
    const serializedState = JSON.stringify(state);
    await redis.setex(key, DEFAULT_TTL_SECONDS, serializedState);
  }

  private async deleteState(key: string): Promise<void> {
    await redis.del(key);
  }
}
