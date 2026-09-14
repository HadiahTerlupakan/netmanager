import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const mockFns = vi.hoisted(() => ({
  redisConstructor: vi.fn(),
  queueConstructor: vi.fn(),
  queueAdd: vi.fn().mockResolvedValue(undefined),
}));

class RedisMock {
  constructor(url?: string, options: Record<string, unknown> = {}) {
    mockFns.redisConstructor(url, options);
  }

  on = vi.fn();
}

class QueueMock {
  constructor(name: string, options: Record<string, unknown> = {}) {
    mockFns.queueConstructor(name, options);
  }

  add = mockFns.queueAdd;
}

vi.mock("ioredis", () => ({
  default: RedisMock,
  Redis: RedisMock,
}));

vi.mock("bullmq", () => ({
  Queue: QueueMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@/lib/redis");
  process.env = { ...originalEnv };
  process.env = { ...process.env, NODE_ENV: "test" };
  delete process.env.REDIS_URL;
  (globalThis as { redis?: unknown }).redis = undefined;
});

describe("Redis configuration contract", () => {
  it("requires REDIS_URL in production runtime env parsing", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };

    const { getEnv } = await import("@/lib/env");

    expect(() => getEnv()).toThrow(
      "REDIS_URL is required in production environment",
    );
  });

  it("uses localhost:6379 as the only local fallback for Redis runtime", async () => {
    process.env = { ...process.env, NODE_ENV: "development" };

    await import("@/lib/redis");

    expect(mockFns.redisConstructor).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({ enableOfflineQueue: false }),
    );
  });

  it("uses localhost:6379 as the only local fallback for BullMQ connections", async () => {
    process.env = { ...process.env, NODE_ENV: "development" };

    const { addEventJob } = await import("@/lib/event-bus/queues");

    await addEventJob("test.event" as never, { ok: true });

    expect(mockFns.redisConstructor).toHaveBeenCalledWith(
      "redis://localhost:6379",
      expect.objectContaining({ enableOfflineQueue: false }),
    );
  });

  it("keeps build and deploy config aligned to port 6379", () => {
    const root = process.cwd();
    const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
    const compose = readFileSync(resolve(root, "docker-compose.yml"), "utf8");
    const composeProd = readFileSync(
      resolve(root, "docker-compose.production.yml"),
      "utf8",
    );
    const workflow = readFileSync(
      resolve(root, ".gitea/workflows/deploy-production.yml"),
      "utf8",
    );
    const deployScript = readFileSync(resolve(root, "deploy.sh"), "utf8");

    expect(dockerfile).toContain('ARG REDIS_URL="redis://localhost:6379"');
    expect(compose).toContain('- "6379:6379"');
    expect(composeProd).toContain(
      "REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379",
    );
    expect(workflow).toContain("REDIS_URL: redis://localhost:6379");
    expect(deployScript).toContain("redis://:<REDIS_PASSWORD>@redis:6379");
  });

  it("documents redis as explicit local and production configuration using port 6379", () => {
    const root = process.cwd();
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const envExample = readFileSync(
      resolve(root, ".env.production.example"),
      "utf8",
    );

    expect(readme).toContain('REDIS_URL="redis://localhost:6379"');
    expect(readme).toContain("- **Port:** `6379`");
    expect(readme).not.toContain('REDIS_URL="redis://localhost:6380"');
    expect(readme).not.toContain("# Redis (opsional)");
    expect(envExample).toContain("REDIS_PASSWORD=GANTI_DENGAN_REDIS_PASSWORD");
    expect(envExample).toContain("# redis://:<REDIS_PASSWORD>@redis:6379");
  });
});
