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

  it("adds a job with the global ioredis test mock", async () => {
    const queue = new Queue("test-events", {
      connection: new Redis("redis://localhost:6379", {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      }),
    });

    await expect(
      queue.add(
        "event:attendance:checkin",
        { userId: "user-1" },
        { priority: 1 },
      ),
    ).resolves.toBeDefined();

    await queue.close();
  });
});
