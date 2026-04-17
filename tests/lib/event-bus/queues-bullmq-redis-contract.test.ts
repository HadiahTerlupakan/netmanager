import { Queue } from "bullmq";
import Redis from "ioredis";
import { describe, expect, it } from "vitest";

describe("BullMQ Redis contract", () => {
  it("creates a BullMQ queue with the global ioredis test mock", async () => {
    const queue = new Queue("test-events", {
      connection: new Redis("redis://localhost:6379", {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      }),
    });

    await expect(queue.client).resolves.toBeDefined();
    await queue.close();
  });
});
