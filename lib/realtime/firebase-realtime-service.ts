import { randomUUID } from "crypto";

import { db, realtimeDb, messaging } from "@/lib/firebase/admin";

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

  async publish<TPayload>(input: PublishInput<TPayload>) {
    const envelope = {
      id: randomUUID(),
      type: input.type,
      scope: input.scope,
      payload: input.payload,
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
        // Skip this publish to avoid quota exhaustion
        return envelope;
      }

      this.publishCache.set(cacheKey, now);

      assertValidCollectionPath(channel);
      await db.collection(channel).add(envelope);
    }

    return envelope;
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
}

export const firebaseRealtimeService = new FirebaseRealtimeService();
