# Redis Package 1 Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menormalkan konfigurasi Redis agar `netmanager` memakai satu sumber kebenaran `REDIS_URL`, menghapus drift `6379` vs `6380`, dan memperjelas bahwa Redis adalah dependency production yang eksplisit.

**Architecture:** Perubahan dibagi menjadi tiga lapisan: validasi runtime (`lib/env.ts`, `lib/redis.ts`, `lib/event-bus/queues.ts`), konsistensi build/deploy (`Dockerfile`, `docker-compose*.yml`, `Jenkinsfile`, `deploy.sh`), dan sinkronisasi dokumentasi (`README.md`, `.env.production.example`). Implementasi dimulai dari test kecil untuk kontrak env/runtime, lalu kode, lalu dokumentasi agar perilaku aplikasi dan instruksi operasional tetap selaras.

**Tech Stack:** TypeScript, Next.js 16, Vitest, ioredis, BullMQ, Docker Compose, Kubernetes, Jenkins.

---

## File Structure

- Modify: `lib/env.ts`
  - Menentukan kontrak env Redis yang eksplisit, termasuk kapan `REDIS_URL` wajib ada.
- Modify: `lib/redis.ts`
  - Menghapus fallback `6380` dan memakai helper/konstanta yang konsisten.
- Modify: `lib/event-bus/queues.ts`
  - Menyamakan sumber `REDIS_URL` BullMQ dengan runtime utama.
- Create: `tests/lib/redis-config.test.ts`
  - Mengunci kontrak env Redis dan fallback runtime yang diinginkan.
- Modify: `Dockerfile`
  - Menyamakan default build arg Redis ke nilai yang konsisten.
- Modify: `docker-compose.yml`
  - Menjaga service Redis lokal dan env app tetap konsisten.
- Modify: `docker-compose.production.yml`
  - Menjaga env production app memakai `REDIS_URL` yang sama.
- Modify: `Jenkinsfile`
  - Menyamakan env CI untuk Redis.
- Modify: `deploy.sh`
  - Menegaskan secret/generate flow yang relevan untuk Redis.
- Modify: `.env.production.example`
  - Menjelaskan bahwa runtime production butuh `REDIS_URL` eksplisit atau bagaimana URL dibentuk.
- Modify: `README.md`
  - Menghapus dokumentasi `6380`/"opsional" dan mengganti dengan instruksi yang sesuai runtime.

## Task 1: Kunci kontrak runtime Redis dengan test

**Files:**
- Create: `tests/lib/redis-config.test.ts`
- Modify: `lib/env.ts:1-40`
- Modify: `lib/redis.ts:1-40`
- Modify: `lib/event-bus/queues.ts:1-30`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
  delete process.env.REDIS_URL
})

describe('Redis configuration contract', () => {
  it('requires REDIS_URL in production runtime env parsing', async () => {
    process.env.NODE_ENV = 'production'

    const { getEnv } = await import('@/lib/env')

    expect(() => getEnv()).toThrow()
  })

  it('uses localhost:6379 as the only local fallback for Redis runtime', async () => {
    process.env.NODE_ENV = 'development'

    const RedisMock = vi.fn().mockImplementation(() => ({ on: vi.fn() }))
    vi.doMock('ioredis', () => ({ default: RedisMock }))

    await import('@/lib/redis')

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ enableOfflineQueue: false })
    )
  })

  it('uses localhost:6379 as the only local fallback for BullMQ connections', async () => {
    process.env.NODE_ENV = 'development'

    const queueCtor = vi.fn()
    const RedisMock = vi.fn().mockImplementation(() => ({ on: vi.fn() }))

    vi.doMock('bullmq', () => ({ Queue: queueCtor }))
    vi.doMock('ioredis', () => ({ default: RedisMock }))

    const { addEventJob } = await import('@/lib/event-bus/queues')
    queueCtor.mockImplementation(() => ({ add: vi.fn().mockResolvedValue(undefined) }))

    await addEventJob('test.event' as never, { ok: true })

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({ enableOfflineQueue: false })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- FAIL karena `lib/env.ts` masih mengizinkan `REDIS_URL` kosong di production
- FAIL karena `lib/redis.ts` dan `lib/event-bus/queues.ts` masih memakai fallback `redis://localhost:6380`

- [ ] **Step 3: Write minimal implementation**

Update `lib/env.ts` agar `REDIS_URL` wajib di production, namun tetap longgar untuk development/test. Bentuk implementasi minimal yang diharapkan:

```ts
import * as z from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.url().optional(),
  REDIS_URL: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof baseEnvSchema>;

let parsedEnv: Env | null = null;

export function getEnv(): Env {
  if (!parsedEnv) {
    const env = baseEnvSchema.parse(process.env);

    if (env.NODE_ENV === "production" && !env.REDIS_URL) {
      throw new Error("REDIS_URL is required in production environment");
    }

    parsedEnv = env;
  }

  return parsedEnv;
}
```

Update `lib/redis.ts` agar fallback lokal hanya `6379`:

```ts
import Redis from 'ioredis'

const DEFAULT_LOCAL_REDIS_URL = 'redis://localhost:6379'
const redisUrl = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 3) return null
      return Math.min(times * 500, 3000)
    },
  })
```

Update `lib/event-bus/queues.ts` agar fallback lokal sama persis:

```ts
const DEFAULT_LOCAL_REDIS_URL = 'redis://localhost:6379'
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- PASS
- Kontrak env Redis production dan fallback lokal `6379` terkunci

- [ ] **Step 5: Commit**

```bash
git add tests/lib/redis-config.test.ts lib/env.ts lib/redis.ts lib/event-bus/queues.ts
git commit -m "refactor: normalize redis runtime configuration"
```

## Task 2: Selaraskan build, compose, dan CI terhadap kontrak REDIS_URL

**Files:**
- Modify: `Dockerfile:35-52`
- Modify: `docker-compose.yml:139-145`
- Modify: `docker-compose.production.yml:277-377`
- Modify: `Jenkinsfile:70-104`
- Modify: `deploy.sh:70-99`

- [ ] **Step 1: Write the failing test**

Tambahkan assertion kedua pada `tests/lib/redis-config.test.ts` untuk mengunci dokumentasi build/runtime lokal yang konsisten lewat snapshot string sederhana:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

it('keeps build and deploy config aligned to port 6379', () => {
  const root = process.cwd()
  const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8')
  const compose = readFileSync(resolve(root, 'docker-compose.yml'), 'utf8')
  const composeProd = readFileSync(resolve(root, 'docker-compose.production.yml'), 'utf8')
  const jenkins = readFileSync(resolve(root, 'Jenkinsfile'), 'utf8')

  expect(dockerfile).toContain('ARG REDIS_URL="redis://localhost:6379"')
  expect(compose).toContain('- "6379:6379"')
  expect(composeProd).toContain('REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379')
  expect(jenkins).toContain('REDIS_URL=redis://localhost:6379')
})
```

- [ ] **Step 2: Run test to verify it fails (if config still drifted locally)**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- FAIL bila ada string `6380` yang masih dipakai di file build/deploy yang diuji
- Bila ternyata sudah PASS untuk bagian ini, lanjutkan ke implementasi tanpa mengubah assertion

- [ ] **Step 3: Write minimal implementation**

Pastikan file-file berikut konsisten:

`Dockerfile`
```Dockerfile
ARG REDIS_URL="redis://localhost:6379"
ENV REDIS_URL=$REDIS_URL
```

`docker-compose.yml`
```yml
  redis:
    image: redis:7-alpine
    container_name: netmanager-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
```

Jika service app di compose lokal belum mengirim `REDIS_URL`, tambahkan env eksplisit seperti ini pada service app yang relevan:
```yml
      REDIS_URL: redis://:${REDIS_PASSWORD:-}@redis:6379
```

`docker-compose.production.yml`
```yml
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
```

`Jenkinsfile`
```groovy
'REDIS_URL=redis://localhost:6379'
```

`deploy.sh`
- Pertahankan generate `REDIS_PASSWORD`
- Tambahkan komentar/output yang menegaskan runtime memakai `REDIS_URL` berbasis service `redis:6379`

Contoh minimal comment block:
```bash
# Runtime Redis URL dibentuk dari REDIS_PASSWORD dan host redis:6379 via compose/secrets.
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- PASS
- Kontrak build/deploy yang diuji konsisten ke `6379`

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml docker-compose.production.yml Jenkinsfile deploy.sh tests/lib/redis-config.test.ts
git commit -m "chore: align redis build and deployment config"
```

## Task 3: Sinkronkan dokumentasi dan contoh env dengan runtime nyata

**Files:**
- Modify: `.env.production.example:27-32`
- Modify: `README.md:41-58`
- Modify: `README.md:197-200`

- [ ] **Step 1: Write the failing test**

Tambahkan assertion dokumentasi ke `tests/lib/redis-config.test.ts`:

```ts
it('documents redis as explicit local and production configuration using port 6379', () => {
  const root = process.cwd()
  const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  const envExample = readFileSync(resolve(root, '.env.production.example'), 'utf8')

  expect(readme).toContain('REDIS_URL="redis://localhost:6379"')
  expect(readme).toContain('- **Port:** `6379`')
  expect(readme).not.toContain('REDIS_URL="redis://localhost:6380"')
  expect(readme).not.toContain('# Redis (opsional)')
  expect(envExample).toContain('REDIS_PASSWORD=GANTI_DENGAN_REDIS_PASSWORD')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- FAIL karena README masih menyebut `6380`
- FAIL karena README masih menyebut Redis opsional

- [ ] **Step 3: Write minimal implementation**

Ubah blok `.env` contoh di `README.md` menjadi:

```md
# Redis
REDIS_URL="redis://localhost:6379"
```

Ganti heading/penjelasan dari:
```md
# Redis (opsional)
```
menjadi:
```md
# Redis
```

Ganti bagian Redis service info menjadi:

```md
### Redis

- **Port:** `6379`
- **URL:** `redis://localhost:6379`
- **Catatan:** Redis dipakai untuk cache, rate limiting, cron locking, idempotency, dan queue processing. Untuk production, set `REDIS_URL` secara eksplisit melalui secret/env deployment.
```

Tambahkan penjelasan singkat pada `.env.production.example` di bawah `REDIS_PASSWORD`:

```env
# REDIS_URL biasanya dibentuk oleh Compose/Kubernetes secret menjadi:
# redis://:<REDIS_PASSWORD>@redis:6379
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- PASS
- README dan env example sinkron dengan runtime `6379`

- [ ] **Step 5: Run focused verification**

Run:
```bash
npm run typecheck && npm run lint && npm run test:run -- tests/lib/redis-config.test.ts
```

Expected:
- typecheck PASS
- lint PASS
- test Redis config PASS

- [ ] **Step 6: Commit**

```bash
git add README.md .env.production.example tests/lib/redis-config.test.ts
git commit -m "docs: sync redis configuration guidance"
```

## Self-Review
- Spec coverage: plan ini menutup seluruh Paket 1 — runtime env, helper Redis, BullMQ config, build/deploy config, dan dokumentasi.
- Placeholder scan: tidak ada TBD/TODO/instruction kosong; setiap task punya file, code snippet, command, dan expected result.
- Type consistency: `REDIS_URL`, `DEFAULT_LOCAL_REDIS_URL`, dan `tests/lib/redis-config.test.ts` dipakai konsisten di semua task.

## Execution Handoff
Plan complete and saved to `docs/superpowers/plans/2026-04-16-redis-package-1-config.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
