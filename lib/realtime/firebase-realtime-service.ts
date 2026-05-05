import { randomUUID } from "crypto";

import { db, realtimeDb, messaging } from "@/lib/firebase/admin";
import { logger } from "@/lib/logger";

import {
  buildPresencePath,
  buildScopeChannel,
  buildScopeConsumerPath,
} from "./channel-map";
import type {
  PresenceSnapshot,
  RealtimeEnvelope,
  RealtimeEventType,
  RealtimeScope,
  SetPresenceInput,
} from "./contracts";

interface PublishInput<TPayload = unknown> {
  type: RealtimeEventType;
  scope: RealtimeScope;
  payload: TPayload;
  triggeredBy?: string;
}

function assertValidCollectionPath(path: string): void {
  const segments = path.split("/");

  if (!path || segments.some((segment) => segment.length === 0)) {
    throw new Error(`Invalid Firestore collection path: ${path}`);
  }

  if (segments.length % 2 === 0) {
    throw new Error(`Invalid Firestore collection path: ${path}`);
  }
}

class FirebaseRealtimeService {
  private publishCache = new Map<string, number>();
  private readonly PUBLISH_THROTTLE_MS = 10000; // 10 seconds minimum between same-scope publishes
  private batchQueue = new Map<string, RealtimeEnvelope<unknown>[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private readonly BATCH_DELAY_MS = 2000; // 2 seconds batch window
  private readonly MAX_BATCH_SIZE = 10; // Max events per batch

  async publish<TPayload>(input: PublishInput<TPayload>) {
    // Remove undefined values from payload to prevent Firestore errors
    const cleanPayload = this.removeUndefinedFields(input.payload);

    const envelope = {
      id: randomUUID(),
      type: input.type,
      scope: input.scope,
      payload: cleanPayload,
      createdAt: new Date().toISOString(),
      version: 1,
      ...(input.triggeredBy ? { triggeredBy: input.triggeredBy } : {}),
    } satisfies RealtimeEnvelope<TPayload>;

    const channel = buildScopeChannel(input.scope);

    if (db) {
      // Throttle writes to prevent quota exhaustion
      const cacheKey = `${channel}:${input.type}`;
      const lastPublish = this.publishCache.get(cacheKey) || 0;
      const now = Date.now();

      if (now - lastPublish < this.PUBLISH_THROTTLE_MS) {
        // Add to batch queue instead of skipping
        this.addToBatch(channel, envelope);
        return envelope;
      }

      this.publishCache.set(cacheKey, now);

      assertValidCollectionPath(channel);
      await db.collection(channel).add(envelope);
    }

    return envelope;
  }

  /**
   * Add event to batch queue for delayed write.
   */
  private addToBatch(
    channel: string,
    envelope: RealtimeEnvelope<unknown>,
  ): void {
    if (!this.batchQueue.has(channel)) {
      this.batchQueue.set(channel, []);
    }

    const queue = this.batchQueue.get(channel)!;
    queue.push(envelope);

    // Flush immediately if batch is full
    if (queue.length >= this.MAX_BATCH_SIZE) {
      this.flushBatch(channel);
      return;
    }

    // Schedule delayed flush
    if (!this.batchTimers.has(channel)) {
      const timer = setTimeout(() => {
        this.flushBatch(channel);
      }, this.BATCH_DELAY_MS);
      this.batchTimers.set(channel, timer);
    }
  }

  /**
   * Flush batched events to Firestore.
   */
  private async flushBatch(channel: string): Promise<void> {
    const timer = this.batchTimers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(channel);
    }

    const queue = this.batchQueue.get(channel);
    if (!queue || queue.length === 0) {
      return;
    }

    // Clear queue immediately to prevent duplicate writes
    this.batchQueue.set(channel, []);

    if (!db) return;

    try {
      assertValidCollectionPath(channel);

      // Write all batched events
      const batch = db.batch();
      for (const envelope of queue) {
        const docRef = db.collection(channel).doc();
        batch.set(docRef, envelope);
      }

      await batch.commit();
      logger.info(
        `[Firestore] Flushed ${queue.length} batched events to ${channel}`,
      );
    } catch (error) {
      logger.error(`[Firestore] Batch write error for ${channel}:`, error);
    }
  }

  /**
   * Recursively remove undefined fields from an object.
   * Firestore does not accept undefined values.
   */
  private removeUndefinedFields<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefinedFields(item)) as T;
    }

    if (typeof obj === "object") {
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedFields(value);
        }
      }
      return cleaned as T;
    }

    return obj;
  }

  async setPresence(input: SetPresenceInput): Promise<PresenceSnapshot> {
    const now = new Date().toISOString();
    const snapshot: PresenceSnapshot = {
      userId: input.userId,
      isOnline: input.isOnline,
      source: input.source,
      updatedAt: now,
      lastSeenAt: input.lastSeenAt ?? now,
    };

    if (realtimeDb) {
      await realtimeDb.ref(buildPresencePath(input.userId)).set(snapshot);
    }

    return snapshot;
  }

  async hasActiveScopeConsumers(scope: RealtimeScope): Promise<boolean> {
    if (!realtimeDb) {
      return false;
    }

    const snapshot = await realtimeDb
      .ref(buildScopeConsumerPath(scope))
      .once("value");

    return snapshot.exists();
  }

  async sendPush(input: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
  }) {
    if (!input.tokens.length || !messaging) {
      return null;
    }

    return messaging.sendEachForMulticast({
      tokens: input.tokens,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: input.data,
    });
  }

  /**
   * Flush all pending batches and cleanup timers.
   * Call this during graceful shutdown.
   */
  async cleanup(): Promise<void> {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // Flush all pending batches
    const channels = Array.from(this.batchQueue.keys());
    await Promise.all(channels.map((channel) => this.flushBatch(channel)));

    logger.info("[Firestore] Cleanup complete - all batches flushed");
  }
}

export const firebaseRealtimeService = new FirebaseRealtimeService();
