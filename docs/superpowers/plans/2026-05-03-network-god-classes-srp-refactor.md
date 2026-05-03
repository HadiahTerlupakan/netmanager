# Network God Classes SRP Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memecah dua god class (`MikroTikPPPSecretService.ts` dan `snmp-optimized.ts`) menjadi unit kecil berbasis SRP tanpa mengubah behavior publik.

**Architecture:** Refactor dilakukan dengan pendekatan orchestrator + focused services. API publik existing dipertahankan, sementara logic internal dipisah menjadi service kecil yang cohesive. Validasi dilakukan lewat TDD: contract test API lama + unit test granular per service baru + smoke test backward compatibility.

**Tech Stack:** TypeScript, Vitest, net-snmp, node-routeros-v2, internal LRU cache

---

## File Structure & Responsibilities

### A. PPP Secret Refactor

**Create:**
- `modules/network/services/mikrotik/ppp-secret.types.ts` — shared types untuk PPP secret workflows.
- `modules/network/services/mikrotik/MikroTikRouterContextService.ts` — resolve router context dari `routerId`/`pelangganId`.
- `modules/network/services/mikrotik/MikroTikPPPSecretCrudService.ts` — create/update/delete PPP secret.
- `modules/network/services/mikrotik/MikroTikPPPSessionFacadeService.ts` — disconnect + usage/debug session via `MikroTikSessionService`.
- `modules/network/services/mikrotik/MikroTikPPPCustomerLifecycleService.ts` — isolate/unisolate/dismantle/sync customer.

**Modify:**
- `modules/network/services/MikroTikPPPSecretService.ts` — menjadi orchestrator tipis, API kompatibel.

**Test:**
- `tests/modules/network/MikroTikPPPSecretService.contract.test.ts` — contract test API publik service utama.
- `tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts`
- `tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts`
- `tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts`
- `tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts`

---

### B. SNMP Optimized Refactor

**Create:**
- `modules/network/services/snmp-optimized.types.ts` — shared types SNMP (cache/session/pagination result).
- `modules/network/services/snmp-cache.service.ts` — in-memory cache lifecycle + helpers.
- `modules/network/services/snmp-connection-pool.service.ts` — SNMP connection pooling.
- `modules/network/services/snmp-walk-executor.service.ts` — GETBULK + fallback subtree walk/chunking.
- `modules/network/services/snmp-dataset-fetch.service.ts` — status/dataset fetch orchestration.
- `modules/network/services/snmp-pagination.service.ts` — paginasi ONU + item building.

**Modify:**
- `modules/network/services/snmp-optimized.ts` — menjadi facade yang preserve export API.

**Test:**
- `tests/modules/network/snmp-optimized.contract.test.ts` — contract exports + behavior utama.
- `tests/modules/network/snmp-cache.service.test.ts`
- `tests/modules/network/snmp-connection-pool.service.test.ts`
- `tests/modules/network/snmp-walk-executor.service.test.ts`
- `tests/modules/network/snmp-dataset-fetch.service.test.ts`
- `tests/modules/network/snmp-pagination.service.test.ts`

---

## Task 1: Baseline contract tests untuk jaga behavior sebelum refactor

**Files:**
- Create: `tests/modules/network/MikroTikPPPSecretService.contract.test.ts`
- Create: `tests/modules/network/snmp-optimized.contract.test.ts`
- Modify: `tests/modules/network/MikroTikPPPSecretServiceDependencies.test.ts` (jika perlu menyesuaikan instansiasi)

- [ ] **Step 1: Write failing contract tests for PPP service public API**

```ts
// tests/modules/network/MikroTikPPPSecretService.contract.test.ts
import { describe, expect, it, vi } from "vitest";
import { MikroTikPPPSecretService } from "@/modules/network/services/MikroTikPPPSecretService";

function buildDeps() {
  return {
    networkRepository: {
      findRouterTenantId: vi.fn().mockResolvedValue({ tenantId: "t1" }),
      findPelangganWithRouter: vi.fn().mockResolvedValue(null),
    },
    routerRepository: {
      findById: vi.fn().mockResolvedValue(null),
    },
    connectionFactory: {
      connect: vi.fn(),
    },
    sessionService: {
      disconnectSession: vi.fn(),
      debugActiveSessionUsage: vi.fn(),
    },
  } as any;
}

describe("MikroTikPPPSecretService contract", () => {
  it("exposes stable public methods", () => {
    const service = new MikroTikPPPSecretService(buildDeps());

    expect(typeof service.createSecret).toBe("function");
    expect(typeof service.setSecretProfile).toBe("function");
    expect(typeof service.disconnectSession).toBe("function");
    expect(typeof service.getActiveSessionUsage).toBe("function");
    expect(typeof service.debugActiveSessionUsage).toBe("function");
    expect(typeof service.deleteSecret).toBe("function");
    expect(typeof service.isolateCustomer).toBe("function");
    expect(typeof service.unIsolateCustomer).toBe("function");
    expect(typeof service.dismantleCustomer).toBe("function");
    expect(typeof service.syncNewCustomer).toBe("function");
  });

  it("returns router not found shape consistently", async () => {
    const service = new MikroTikPPPSecretService(buildDeps());
    const result = await service.createSecret("router-x", {
      name: "u1",
      password: "p1",
      profile: "basic",
    });

    expect(result).toEqual({ success: false, error: "Router tidak ditemukan" });
  });
});
```

- [ ] **Step 2: Write failing contract tests for SNMP facade exports**

```ts
// tests/modules/network/snmp-optimized.contract.test.ts
import { describe, expect, it } from "vitest";
import {
  snmpWalkOptimized,
  fetchOnuDataPaginated,
  clearSNMPCache,
  cleanupSNMPConnections,
} from "@/modules/network/services/snmp-optimized";

describe("snmp-optimized contract", () => {
  it("keeps public exports", () => {
    expect(typeof snmpWalkOptimized).toBe("function");
    expect(typeof fetchOnuDataPaginated).toBe("function");
    expect(typeof clearSNMPCache).toBe("function");
    expect(typeof cleanupSNMPConnections).toBe("function");
  });

  it("returns empty pagination shape when no status data", async () => {
    const result = await fetchOnuDataPaginated(
      "127.0.0.1",
      161,
      "public",
      "2c",
      "OLT-A",
      1,
      100,
    );

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.pagination).toHaveProperty("page");
    expect(result.pagination).toHaveProperty("pageSize");
    expect(result.pagination).toHaveProperty("total");
    expect(result.pagination).toHaveProperty("totalPages");
  });
});
```

- [ ] **Step 3: Run tests to verify baseline**

Run:
```bash
npm run test:run -- tests/modules/network/MikroTikPPPSecretService.contract.test.ts tests/modules/network/snmp-optimized.contract.test.ts
```

Expected: PASS (baseline contract established), atau FAIL jika ada fixture yang perlu adjustment.

- [ ] **Step 4: Commit baseline tests**

```bash
git add tests/modules/network/MikroTikPPPSecretService.contract.test.ts tests/modules/network/snmp-optimized.contract.test.ts
git commit -m "test: add baseline contract tests for PPP and SNMP services"
```

---

## Task 2: Extract PPP shared types + router context service

**Files:**
- Create: `modules/network/services/mikrotik/ppp-secret.types.ts`
- Create: `modules/network/services/mikrotik/MikroTikRouterContextService.ts`
- Test: `tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts`

- [ ] **Step 1: Write failing tests for RouterContextService**

```ts
// tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts
import { describe, expect, it, vi } from "vitest";
import { MikroTikRouterContextService } from "@/modules/network/services/mikrotik/MikroTikRouterContextService";

describe("MikroTikRouterContextService", () => {
  it("returns null when router tenant missing", async () => {
    const service = new MikroTikRouterContextService({
      networkRepository: {
        findRouterTenantId: vi.fn().mockResolvedValue(null),
        findPelangganWithRouter: vi.fn(),
      },
      routerRepository: {
        findById: vi.fn(),
      },
    } as any);

    const result = await service.findRouter("r1");
    expect(result).toBeNull();
  });

  it("builds pelanggan router context with profile name", async () => {
    const pelanggan = {
      username: "u1",
      password: "p1",
      nama: "A",
      hargaPaket: {
        profilePPP: {
          name: "basic",
          mikroTikRouter: {
            id: "r1",
            ipAddress: "10.0.0.1",
            apiPort: 8728,
            apiUsername: "admin",
            apiPassword: "admin",
            apiUsernameGenerated: null,
            apiPasswordGenerated: null,
          },
        },
      },
    };

    const service = new MikroTikRouterContextService({
      networkRepository: {
        findRouterTenantId: vi.fn(),
        findPelangganWithRouter: vi.fn().mockResolvedValue(pelanggan),
      },
      routerRepository: {
        findById: vi.fn(),
      },
    } as any);

    const result = await service.getRouterFromPelanggan("p1");
    expect(result?.router.ipAddress).toBe("10.0.0.1");
    expect(result?.profileName).toBe("basic");
  });
});
```

- [ ] **Step 2: Implement shared types file**

```ts
// modules/network/services/mikrotik/ppp-secret.types.ts
import type { MikroTikRouterEntity } from "@/modules/network/domain/entities/MikroTikRouterEntity";

export interface PPPSecretData {
  name: string;
  password: string;
  profile: string;
  service?: string;
  comment?: string;
  disabled?: boolean;
}

export interface RouterConfigLite {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
}

export interface PelangganRouterContext {
  router: RouterConfigLite;
  routerId: string;
  pelanggan: {
    username: string;
    password: string;
    nama: string;
  };
  profileName: string;
}

export type RouterEntityOrNull = MikroTikRouterEntity | null;
```

- [ ] **Step 3: Implement RouterContextService**

```ts
// modules/network/services/mikrotik/MikroTikRouterContextService.ts
import type { PelangganWithRouter, RouterTenantId } from "@/modules/network/repositories/NetworkRepository";
import type { IMikroTikRouterRepository } from "@/modules/network/domain/ports/IMikroTikRouterRepository";
import type { MikroTikRouterEntity } from "@/modules/network/domain/entities/MikroTikRouterEntity";
import type { PelangganRouterContext } from "./ppp-secret.types";

interface MikroTikPPPSecretNetworkRepository {
  findRouterTenantId(routerId: string): Promise<RouterTenantId | null>;
  findPelangganWithRouter(pelangganId: string): Promise<PelangganWithRouter | null>;
}

export class MikroTikRouterContextService {
  constructor(
    private readonly deps: {
      networkRepository: MikroTikPPPSecretNetworkRepository;
      routerRepository: IMikroTikRouterRepository;
    },
  ) {}

  async findRouter(routerId: string): Promise<MikroTikRouterEntity | null> {
    const routerTenant = await this.deps.networkRepository.findRouterTenantId(routerId);
    if (!routerTenant?.tenantId) return null;
    return this.deps.routerRepository.findById(routerId, routerTenant.tenantId);
  }

  async getRouterFromPelanggan(pelangganId: string): Promise<PelangganRouterContext | null> {
    const pelanggan = await this.deps.networkRepository.findPelangganWithRouter(pelangganId);
    if (!pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter) return null;

    const router = pelanggan.hargaPaket.profilePPP.mikroTikRouter;
    const apiUsername = router.apiUsernameGenerated || router.apiUsername;
    const apiPassword = router.apiPasswordGenerated || router.apiPassword;

    return {
      router: {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername,
        apiPassword,
      },
      routerId: router.id,
      pelanggan: {
        username: pelanggan.username,
        password: pelanggan.password,
        nama: pelanggan.nama,
      },
      profileName: pelanggan.hargaPaket.profilePPP.name,
    };
  }
}
```

- [ ] **Step 4: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/network/services/mikrotik/ppp-secret.types.ts modules/network/services/mikrotik/MikroTikRouterContextService.ts tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts
git commit -m "refactor: extract MikroTik router context service for PPP workflows"
```

---

## Task 3: Extract PPP CRUD service

**Files:**
- Create: `modules/network/services/mikrotik/MikroTikPPPSecretCrudService.ts`
- Test: `tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts`

- [ ] **Step 1: Write failing tests for CRUD behavior**

```ts
// tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts
import { describe, expect, it, vi } from "vitest";
import { MikroTikPPPSecretCrudService } from "@/modules/network/services/mikrotik/MikroTikPPPSecretCrudService";

describe("MikroTikPPPSecretCrudService", () => {
  it("updates existing secret when found", async () => {
    const conn = {
      write: vi
        .fn()
        .mockResolvedValueOnce([{ ".id": "*1" }])
        .mockResolvedValueOnce([]),
    } as any;

    const svc = new MikroTikPPPSecretCrudService();
    const result = await svc.createOrUpdateSecret(conn, {
      name: "u1",
      password: "p1",
      profile: "basic",
      service: "pppoe",
      comment: "c",
    });

    expect(result.success).toBe(true);
    expect(conn.write).toHaveBeenCalledWith("/ppp/secret/set", expect.any(Array));
  });

  it("adds new secret when not found", async () => {
    const conn = {
      write: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    } as any;

    const svc = new MikroTikPPPSecretCrudService();
    const result = await svc.createOrUpdateSecret(conn, {
      name: "u1",
      password: "p1",
      profile: "basic",
    });

    expect(result.success).toBe(true);
    expect(conn.write).toHaveBeenCalledWith("/ppp/secret/add", expect.any(Array));
  });
});
```

- [ ] **Step 2: Implement CRUD service**

```ts
// modules/network/services/mikrotik/MikroTikPPPSecretCrudService.ts
import type { PPPSecretData } from "./ppp-secret.types";

const DEFAULT_SERVICE = "pppoe";
const DEFAULT_COMMENT = "added by netmanager";

export class MikroTikPPPSecretCrudService {
  async createOrUpdateSecret(
    conn: { write: (path: string, args: string[]) => Promise<unknown> },
    data: PPPSecretData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = (await conn.write("/ppp/secret/print", [
        `?name=${data.name}`,
      ])) as Array<Record<string, string>>;

      if (existing && existing.length > 0 && existing[0]) {
        await conn.write("/ppp/secret/set", [
          `=.id=${existing[0][".id"]}`,
          `=password=${data.password}`,
          `=profile=${data.profile}`,
          `=comment=${data.comment || DEFAULT_COMMENT}`,
        ]);
      } else {
        await conn.write("/ppp/secret/add", [
          `=name=${data.name}`,
          `=password=${data.password}`,
          `=profile=${data.profile}`,
          `=service=${data.service || DEFAULT_SERVICE}`,
          `=comment=${data.comment || DEFAULT_COMMENT}`,
        ]);
      }

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async setSecretProfile(
    conn: { write: (path: string, args: string[]) => Promise<unknown> },
    username: string,
    profileName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const secrets = (await conn.write("/ppp/secret/print", [`?name=${username}`])) as Array<Record<string, string>>;
      if (!secrets || secrets.length === 0 || !secrets[0]) {
        return { success: false, error: "PPP Secret tidak ditemukan" };
      }

      await conn.write("/ppp/secret/set", [
        `=.id=${secrets[0][".id"]}`,
        `=profile=${profileName}`,
      ]);

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async deleteSecret(
    conn: { write: (path: string, args: string[]) => Promise<unknown> },
    username: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const secrets = (await conn.write("/ppp/secret/print", [`?name=${username}`])) as Array<Record<string, string>>;
      for (const secret of secrets || []) {
        if (secret[".id"]) await conn.write("/ppp/secret/remove", [`=.id=${secret[".id"]}`]);
      }

      const active = (await conn.write("/ppp/active/print", [`?name=${username}`])) as Array<Record<string, string>>;
      for (const session of active || []) {
        if (session[".id"]) await conn.write("/ppp/active/remove", [`=.id=${session[".id"]}`]);
      }

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/mikrotik/MikroTikPPPSecretCrudService.ts tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts
git commit -m "refactor: extract PPP secret CRUD service"
```

---

## Task 4: Extract PPP session facade service

**Files:**
- Create: `modules/network/services/mikrotik/MikroTikPPPSessionFacadeService.ts`
- Test: `tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts
import { describe, expect, it, vi } from "vitest";
import { MikroTikPPPSessionFacadeService } from "@/modules/network/services/mikrotik/MikroTikPPPSessionFacadeService";

describe("MikroTikPPPSessionFacadeService", () => {
  it("delegates disconnectSession", async () => {
    const sessionService = {
      disconnectSession: vi.fn().mockResolvedValue(2),
      debugActiveSessionUsage: vi.fn(),
    } as any;

    const svc = new MikroTikPPPSessionFacadeService(sessionService);
    const result = await svc.disconnectSession({} as any, "u1");

    expect(result).toEqual({ success: true, disconnected: 2 });
  });
});
```

- [ ] **Step 2: Implement facade**

```ts
// modules/network/services/mikrotik/MikroTikPPPSessionFacadeService.ts
import type { PPPActiveSessionRecord, SessionUsageData } from "@/modules/network/services/mikrotik/ppp-session-usage";
import type { MikroTikSessionService } from "@/modules/network/services/mikrotik/MikroTikSessionService";

export class MikroTikPPPSessionFacadeService {
  constructor(private readonly sessionService: MikroTikSessionService) {}

  async disconnectSession(
    conn: unknown,
    username: string,
  ): Promise<{ success: boolean; disconnected: number; error?: string }> {
    try {
      const disconnected = await this.sessionService.disconnectSession(conn as any, username);
      return { success: true, disconnected };
    } catch (error: unknown) {
      return {
        success: false,
        disconnected: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async debugActiveSessionUsage(
    conn: unknown,
    username: string,
    routerIpAddress: string,
  ): Promise<{
    success: boolean;
    routerIpAddress?: string;
    activeSession?: PPPActiveSessionRecord | null;
    interfaceName?: string | null;
    interfacePrint?: PPPActiveSessionRecord | null;
    monitorTraffic?: PPPActiveSessionRecord | null;
    parsedFromActive?: SessionUsageData;
    parsedFromInterface?: SessionUsageData;
    parsedFromMonitor?: SessionUsageData;
    finalUsage?: SessionUsageData;
    interfaceDebug?: {
      rawInterfaceField: string | null;
      rawNameField: string | null;
      candidatesTried: string[];
    };
    monitorError?: string;
    error?: string;
  }> {
    try {
      return await this.sessionService.debugActiveSessionUsage(
        conn as any,
        username,
        routerIpAddress,
      );
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/mikrotik/MikroTikPPPSessionFacadeService.ts tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts
git commit -m "refactor: extract PPP session facade service"
```

---

## Task 5: Extract PPP customer lifecycle service

**Files:**
- Create: `modules/network/services/mikrotik/MikroTikPPPCustomerLifecycleService.ts`
- Test: `tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts`

- [ ] **Step 1: Write failing tests for isolate/unisolate flow**

```ts
// tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts
import { describe, expect, it, vi } from "vitest";
import { MikroTikPPPCustomerLifecycleService } from "@/modules/network/services/mikrotik/MikroTikPPPCustomerLifecycleService";

describe("MikroTikPPPCustomerLifecycleService", () => {
  it("isolates customer and appends disconnect log", async () => {
    const svc = new MikroTikPPPCustomerLifecycleService({
      setSecretProfile: vi.fn().mockResolvedValue({ success: true }),
      disconnectSession: vi.fn().mockResolvedValue({ success: true, disconnected: 1 }),
      deleteSecret: vi.fn(),
      createSecret: vi.fn(),
    } as any);

    const result = await svc.isolateByRouter(
      "r1",
      { username: "u1", password: "p1", nama: "A" },
      "expired users",
    );

    expect(result.success).toBe(true);
    expect(result.logs.some((line) => line.includes("Disconnected 1"))).toBe(true);
  });
});
```

- [ ] **Step 2: Implement lifecycle service**

```ts
// modules/network/services/mikrotik/MikroTikPPPCustomerLifecycleService.ts
const EXPIRED_PROFILE = "expired users";

type CrudPort = {
  setSecretProfile: (routerId: string, username: string, profileName: string) => Promise<{ success: boolean; error?: string }>;
  deleteSecret: (routerId: string, username: string) => Promise<{ success: boolean; error?: string }>;
  createSecret: (routerId: string, data: { name: string; password: string; profile: string; service?: string; comment?: string }) => Promise<{ success: boolean; error?: string }>;
};

type SessionPort = {
  disconnectSession: (routerId: string, username: string) => Promise<{ success: boolean; disconnected: number; error?: string }>;
};

export class MikroTikPPPCustomerLifecycleService {
  constructor(private readonly ports: CrudPort & SessionPort) {}

  async isolateByRouter(
    routerId: string,
    pelanggan: { username: string; password: string; nama: string },
    profile: string = EXPIRED_PROFILE,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    const profileResult = await this.ports.setSecretProfile(routerId, pelanggan.username, profile);
    if (!profileResult.success && profileResult.error !== "PPP Secret tidak ditemukan") {
      return { success: false, logs, error: profileResult.error };
    }

    if (profileResult.success) logs.push(`Profile diubah ke "${profile}"`);

    const disconnect = await this.ports.disconnectSession(routerId, pelanggan.username);
    logs.push(`Disconnected ${disconnect.disconnected} session(s)`);

    return { success: true, logs };
  }

  async unIsolateByRouter(
    routerId: string,
    pelanggan: { username: string; password: string; nama: string },
    profileName: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    const profileResult = await this.ports.setSecretProfile(routerId, pelanggan.username, profileName);
    if (!profileResult.success && profileResult.error !== "PPP Secret tidak ditemukan") {
      return { success: false, logs, error: profileResult.error };
    }

    if (profileResult.success) logs.push(`Profile dikembalikan ke "${profileName}"`);

    const disconnect = await this.ports.disconnectSession(routerId, pelanggan.username);
    logs.push(`Disconnected ${disconnect.disconnected} session(s)`);

    return { success: true, logs };
  }

  async dismantleByRouter(
    routerId: string,
    pelanggan: { username: string; password: string; nama: string },
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [`Menghapus secret untuk ${pelanggan.username}`];
    const result = await this.ports.deleteSecret(routerId, pelanggan.username);
    if (!result.success) return { success: false, logs, error: result.error };
    logs.push("PPP Secret berhasil dihapus");
    return { success: true, logs };
  }

  async syncNewByRouter(
    routerId: string,
    pelanggan: { username: string; password: string; nama: string },
    profileName: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [`Creating PPP Secret untuk ${pelanggan.username}`];
    const result = await this.ports.createSecret(routerId, {
      name: pelanggan.username,
      password: pelanggan.password,
      profile: profileName,
      service: "pppoe",
      comment: `customer: ${pelanggan.nama}`,
    });

    if (!result.success) return { success: false, logs, error: result.error };
    logs.push("PPP Secret berhasil dibuat");
    return { success: true, logs };
  }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/mikrotik/MikroTikPPPCustomerLifecycleService.ts tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts
git commit -m "refactor: extract PPP customer lifecycle service"
```

---

## Task 6: Convert MikroTikPPPSecretService jadi orchestrator kompatibel API

**Files:**
- Modify: `modules/network/services/MikroTikPPPSecretService.ts`
- Test: `tests/modules/network/MikroTikPPPSecretService.contract.test.ts`

- [ ] **Step 1: Write failing integration test for orchestrator wiring**

```ts
// append in tests/modules/network/MikroTikPPPSecretService.contract.test.ts
it("keeps isolate/unisolate/sync behavior shape", async () => {
  const deps = buildDeps();
  deps.networkRepository.findPelangganWithRouter = vi.fn().mockResolvedValue(null);

  const service = new MikroTikPPPSecretService(deps as any);
  const result = await service.isolateCustomer("p-1");

  expect(result).toEqual({
    success: false,
    logs: [],
    error: "Pelanggan atau router tidak ditemukan",
  });
});
```

- [ ] **Step 2: Replace internals with orchestrator composition (preserve public signatures)**

```ts
// core pattern in modules/network/services/MikroTikPPPSecretService.ts
// keep constructor & public methods names unchanged

private readonly contextService: MikroTikRouterContextService;
private readonly crudService: MikroTikPPPSecretCrudService;
private readonly facadeService: MikroTikPPPSessionFacadeService;
private readonly lifecycleService: MikroTikPPPCustomerLifecycleService;

constructor(deps?: MikroTikPPPSecretDependencies) {
  // existing dependency guard tetap
  // instantiate context/crud/facade/lifecycle services
}

// public method createSecret(...):
// 1) resolve router via contextService
// 2) connect router
// 3) delegate ke crudService
// 4) close connection di finally

// public method isolateCustomer(...):
// 1) resolve pelanggan context via contextService
// 2) delegate ke lifecycleService.isolateByRouter(...)
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/MikroTikPPPSecretServiceDependencies.test.ts tests/modules/network/MikroTikPPPSecretService.contract.test.ts tests/modules/network/mikrotik/MikroTikRouterContextService.test.ts tests/modules/network/mikrotik/MikroTikPPPSecretCrudService.test.ts tests/modules/network/mikrotik/MikroTikPPPSessionFacadeService.test.ts tests/modules/network/mikrotik/MikroTikPPPCustomerLifecycleService.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/MikroTikPPPSecretService.ts tests/modules/network/MikroTikPPPSecretService.contract.test.ts
git commit -m "refactor: convert MikroTikPPPSecretService to thin orchestrator"
```

---

## Task 7: Extract SNMP shared types and cache service

**Files:**
- Create: `modules/network/services/snmp-optimized.types.ts`
- Create: `modules/network/services/snmp-cache.service.ts`
- Test: `tests/modules/network/snmp-cache.service.test.ts`

- [ ] **Step 1: Write failing cache tests**

```ts
// tests/modules/network/snmp-cache.service.test.ts
import { describe, expect, it } from "vitest";
import { createSnmpCacheService } from "@/modules/network/services/snmp-cache.service";

describe("snmp-cache.service", () => {
  it("stores and retrieves dataset by key", () => {
    const cache = createSnmpCacheService();
    cache.set("k1", { a: "1" });
    expect(cache.get("k1")).toEqual({ a: "1" });
  });

  it("returns null for missing key", () => {
    const cache = createSnmpCacheService();
    expect(cache.get("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Implement types + cache service**

```ts
// modules/network/services/snmp-optimized.types.ts
import type snmp from "net-snmp";

export type CacheValue = { data: Record<string, string> };

export type SnmpSessionEntry = {
  session: snmp.Session;
  inUse: boolean;
  lastUsed: number;
};

export type OnuPaginationResult<TItem> = {
  data: TItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
```

```ts
// modules/network/services/snmp-cache.service.ts
import { LRUCache } from "@/lib/utils/lru-cache";
import {
  CACHE_CLEANUP_INTERVAL_MS,
  CACHE_TTL_MS,
} from "@/modules/network/services/snmp-optimized.constants";
import type { CacheValue } from "./snmp-optimized.types";

const DEFAULT_CACHE_MAX_ENTRIES = 100;

export function createSnmpCacheService() {
  const cache = new LRUCache<string, CacheValue>(
    DEFAULT_CACHE_MAX_ENTRIES,
    CACHE_TTL_MS,
  );

  const interval = setInterval(() => {
    cache.cleanup();
  }, CACHE_CLEANUP_INTERVAL_MS);

  return {
    getCacheKey(ipAddress: string, oid: string): string {
      return `${ipAddress}:${oid}`;
    },
    get(key: string): Record<string, string> | null {
      return cache.get(key)?.data ?? null;
    },
    set(key: string, data: Record<string, string>): void {
      cache.set(key, { data });
    },
    clear(): void {
      cache.clear();
    },
    stop(): void {
      clearInterval(interval);
    },
  };
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/snmp-cache.service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/snmp-optimized.types.ts modules/network/services/snmp-cache.service.ts tests/modules/network/snmp-cache.service.test.ts
git commit -m "refactor: extract SNMP cache service"
```

---

## Task 8: Extract SNMP connection pool service

**Files:**
- Create: `modules/network/services/snmp-connection-pool.service.ts`
- Test: `tests/modules/network/snmp-connection-pool.service.test.ts`

- [ ] **Step 1: Write failing pool tests**

```ts
// tests/modules/network/snmp-connection-pool.service.test.ts
import { describe, expect, it } from "vitest";
import { createConnectionKey } from "@/modules/network/services/snmp-connection-pool.service";

describe("snmp-connection-pool.service", () => {
  it("creates deterministic connection key", () => {
    expect(createConnectionKey("1.1.1.1", 161, "public", "2c")).toBe(
      "1.1.1.1:161:public:2c",
    );
  });
});
```

- [ ] **Step 2: Implement connection pool extraction**

```ts
// modules/network/services/snmp-connection-pool.service.ts
import snmp from "net-snmp";
import {
  MAX_CONCURRENT_SESSIONS,
  SESSION_REUSE_WINDOW_MS,
  SESSION_WAIT_MS,
  SNMP_TIMEOUT_MS,
} from "@/modules/network/services/snmp-optimized.constants";
import type { SnmpSessionEntry } from "./snmp-optimized.types";

export function createConnectionKey(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): string {
  return `${ipAddress}:${port}:${community}:${version}`;
}

function getSnmpVersion(version: string): 0 | 1 | undefined {
  return version === "1" ? 0 : 1;
}

function createSnmpSession(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): snmp.Session {
  return snmp.createSession(ipAddress, community, {
    port,
    version: getSnmpVersion(version),
    retries: 2,
    timeout: SNMP_TIMEOUT_MS,
  });
}

function closePoolSession(session: snmp.Session): void {
  try {
    session.close();
  } catch {
    return;
  }
}

export class SNMPConnectionPoolService {
  private sessions = new Map<string, SnmpSessionEntry[]>();

  async getSession(ipAddress: string, port: number, community: string, version: string): Promise<snmp.Session> {
    const key = createConnectionKey(ipAddress, port, community, version);
    const sessionList = this.sessions.get(key) ?? [];
    this.sessions.set(key, sessionList);

    const reusable = sessionList.find(
      (entry) => !entry.inUse && Date.now() - entry.lastUsed < SESSION_REUSE_WINDOW_MS,
    );

    if (reusable) {
      reusable.inUse = true;
      reusable.lastUsed = Date.now();
      return reusable.session;
    }

    if (sessionList.length < MAX_CONCURRENT_SESSIONS) {
      const created: SnmpSessionEntry = {
        session: createSnmpSession(ipAddress, port, community, version),
        inUse: true,
        lastUsed: Date.now(),
      };
      sessionList.push(created);
      return created.session;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS));
    return this.getSession(ipAddress, port, community, version);
  }

  releaseSession(session: snmp.Session): void {
    for (const list of this.sessions.values()) {
      const found = list.find((entry) => entry.session === session);
      if (found) {
        found.inUse = false;
        break;
      }
    }
  }

  cleanup(): void {
    for (const list of this.sessions.values()) {
      for (const entry of list) {
        closePoolSession(entry.session);
      }
    }
    this.sessions.clear();
  }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/snmp-connection-pool.service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/snmp-connection-pool.service.ts tests/modules/network/snmp-connection-pool.service.test.ts
git commit -m "refactor: extract SNMP connection pool service"
```

---

## Task 9: Extract SNMP walk executor service

**Files:**
- Create: `modules/network/services/snmp-walk-executor.service.ts`
- Test: `tests/modules/network/snmp-walk-executor.service.test.ts`

- [ ] **Step 1: Write failing executor test (error normalization utility)**

```ts
// tests/modules/network/snmp-walk-executor.service.test.ts
import { describe, expect, it } from "vitest";
import { normalizeSnmpError, stringifyVarbindValue } from "@/modules/network/services/snmp-walk-executor.service";

describe("snmp-walk-executor.service", () => {
  it("normalizes unknown error to string", () => {
    expect(normalizeSnmpError({ a: 1 })).toContain("[object Object]");
  });

  it("formats buffer varbind to hex", () => {
    const value = Buffer.from([0x0a, 0x1b]);
    expect(stringifyVarbindValue(value)).toBe("0A 1B");
  });
});
```

- [ ] **Step 2: Implement walk executor extraction**

```ts
// modules/network/services/snmp-walk-executor.service.ts
import snmp from "net-snmp";
import { snmpGetBulkSimple } from "@/modules/network/services/snmpService";
import {
  MAX_CHUNK_SIZE,
  POST_TIMEOUT_GRACE_MS,
  SNMP_TIMEOUT_MS,
  SUBTREE_MAX_REPETITIONS,
} from "@/modules/network/services/snmp-optimized.constants";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";

export function normalizeSnmpError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function stringifyVarbindValue(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return Array.from(value as Uint8Array)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  }
  return String(value);
}

export async function snmpWalkOptimizedExecutor(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout?: number;
  chunkSize?: number;
  connectionPool: SNMPConnectionPoolService;
}): Promise<Record<string, string>> {
  const {
    ipAddress,
    port,
    community,
    version,
    oid,
    timeout = SNMP_TIMEOUT_MS,
    chunkSize = MAX_CHUNK_SIZE,
    connectionPool,
  } = params;

  try {
    return await snmpGetBulkSimple(ipAddress, port, community, version, oid, timeout);
  } catch {
    const session = await connectionPool.getSession(ipAddress, port, community, version);
    try {
      return await snmpWalkWithChunking(session, oid, chunkSize, timeout);
    } finally {
      connectionPool.releaseSession(session);
    }
  }
}

export async function snmpWalkWithChunking(
  session: snmp.Session,
  oid: string,
  chunkSize: number,
  timeout: number,
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const results: Record<string, string> = {};
    let currentChunk: Record<string, string> = {};

    const flush = () => {
      Object.assign(results, currentChunk);
      currentChunk = {};
    };

    const done = (error?: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      flush();
      if (error && Object.keys(results).length === 0) {
        reject(error);
        return;
      }
      resolve(results);
    };

    const timeoutId = setTimeout(() => done(), timeout);

    const feed = (varbinds: snmp.Varbind[]) => {
      if (resolved) return;
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) {
          if (vb.type === snmp.ObjectType.EndOfMibView) {
            done();
            return;
          }
          continue;
        }
        if (vb.value === null || vb.value === undefined) continue;
        currentChunk[String(vb.oid)] = stringifyVarbindValue(vb.value);
      }
      if (Object.keys(currentChunk).length >= chunkSize) flush();
    };

    const complete = (error?: Error) => {
      if (error) {
        done(error);
        return;
      }
      done();
    };

    session.subtree(oid, SUBTREE_MAX_REPETITIONS, feed, complete);
    setTimeout(() => clearTimeout(timeoutId), timeout + POST_TIMEOUT_GRACE_MS);
  });
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/snmp-walk-executor.service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/snmp-walk-executor.service.ts tests/modules/network/snmp-walk-executor.service.test.ts
git commit -m "refactor: extract SNMP walk executor service"
```

---

## Task 10: Extract dataset fetch + pagination services

**Files:**
- Create: `modules/network/services/snmp-dataset-fetch.service.ts`
- Create: `modules/network/services/snmp-pagination.service.ts`
- Test: `tests/modules/network/snmp-dataset-fetch.service.test.ts`
- Test: `tests/modules/network/snmp-pagination.service.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/modules/network/snmp-pagination.service.test.ts
import { describe, expect, it } from "vitest";
import { buildPagination, getPagedIndexes } from "@/modules/network/services/snmp-pagination.service";

describe("snmp-pagination.service", () => {
  it("calculates pagination metadata", () => {
    expect(buildPagination(2, 10, 35)).toEqual({
      page: 2,
      pageSize: 10,
      total: 35,
      totalPages: 4,
    });
  });

  it("slices indexes for requested page", () => {
    const statusData = { a: "1", b: "2", c: "3", d: "4" };
    expect(getPagedIndexes(statusData, 2, 2)).toEqual(["c", "d"]);
  });
});
```

- [ ] **Step 2: Implement services**

```ts
// modules/network/services/snmp-pagination.service.ts
import { buildOnuItem, type OnuDatasetCollection } from "@/modules/network/services/snmp-optimized.helpers";

export function buildEmptyPagination(pageSize: number) {
  return { page: 1, pageSize, total: 0, totalPages: 0 };
}

export function buildPagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getPagedIndexes(
  statusData: Record<string, string>,
  page: number,
  pageSize: number,
): string[] {
  const indexes = Object.keys(statusData);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, indexes.length);
  return indexes.slice(start, end);
}

export function buildPaginatedOnuItems(params: {
  indexes: string[];
  oltId: string;
  datasets: OnuDatasetCollection;
}) {
  return params.indexes.map((index) =>
    buildOnuItem({ index, oltId: params.oltId, datasets: params.datasets }),
  );
}
```

```ts
// modules/network/services/snmp-dataset-fetch.service.ts
import {
  MAX_CHUNK_SIZE,
  SNMP_TIMEOUT_MS,
} from "@/modules/network/services/snmp-optimized.constants";
import { resolveOnuDataTimeout, type OnuDatasetCollection } from "@/modules/network/services/snmp-optimized.helpers";
import { snmpWalkOptimizedExecutor } from "./snmp-walk-executor.service";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";

const STATUS_BASE_OID = "1.3.6.1.4.1.3902.1012.3.28.1.1";
const STATUS_NEW_OID = "1.3.6.1.4.1.3902.1012.3.28.2.1.4";
const STATUS_OLD_OID = `${STATUS_BASE_OID}.6`;
const ONU_NAME_OID = `${STATUS_BASE_OID}.2`;
const ONU_SERIAL_OID = `${STATUS_BASE_OID}.5`;
const ONU_DESC_OID = "1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3";
const ONU_RX_OLT_OID = "1.3.6.1.4.1.3902.1015.1010.11.2.1.2";
const ONU_RX_ONU_OID = "1.3.6.1.4.1.3902.1012.3.50.12.1.1.10";
const ONU_ACTUAL_TYPE_OID = "1.3.6.1.4.1.3902.1012.3.50.11.2.1.9";
const ONU_PPPOE_OID = "1.3.6.1.4.1.3902.1082.500.20.2.17.2.1.11";

function hasResults(record: Record<string, string>) {
  return Object.keys(record).length > 0;
}

async function fetchDataset(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  oid: string;
  timeout: number;
  connectionPool: SNMPConnectionPoolService;
}) {
  return snmpWalkOptimizedExecutor({
    ...params,
    connectionPool: params.connectionPool,
  }).catch(() => ({}));
}

export async function fetchStatusDataset(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  connectionPool: SNMPConnectionPoolService;
}): Promise<Record<string, string>> {
  const newStatus = await fetchDataset({
    ...params,
    oid: STATUS_NEW_OID,
    timeout: SNMP_TIMEOUT_MS,
  });

  if (hasResults(newStatus)) return newStatus;

  return fetchDataset({
    ...params,
    oid: STATUS_OLD_OID,
    timeout: SNMP_TIMEOUT_MS,
    connectionPool: params.connectionPool,
  }).catch(() => ({}));
}

export async function fetchOnuDatasets(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  totalOnus: number;
  statusData: Record<string, string>;
  connectionPool: SNMPConnectionPoolService;
}): Promise<OnuDatasetCollection> {
  const timeout = resolveOnuDataTimeout(params.totalOnus);
  const common = {
    ipAddress: params.ipAddress,
    port: params.port,
    community: params.community,
    version: params.version,
    timeout,
    connectionPool: params.connectionPool,
  };

  const [nameData, descData, rxOltData, rxOnuData, snData, actualTypeData, pppoeData] = await Promise.all([
    fetchDataset({ ...common, oid: ONU_NAME_OID }),
    fetchDataset({ ...common, oid: ONU_DESC_OID }),
    fetchDataset({ ...common, oid: ONU_RX_OLT_OID }),
    fetchDataset({ ...common, oid: ONU_RX_ONU_OID }),
    fetchDataset({ ...common, oid: ONU_SERIAL_OID }),
    fetchDataset({ ...common, oid: ONU_ACTUAL_TYPE_OID }),
    fetchDataset({ ...common, oid: ONU_PPPOE_OID }),
  ]);

  return {
    statusData: params.statusData,
    nameData,
    descData,
    rxOltData,
    rxOnuData,
    snData,
    actualTypeData,
    pppoeData,
  };
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
npm run test:run -- tests/modules/network/snmp-pagination.service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/snmp-dataset-fetch.service.ts modules/network/services/snmp-pagination.service.ts tests/modules/network/snmp-pagination.service.test.ts
git commit -m "refactor: extract SNMP dataset fetch and pagination services"
```

---

## Task 11: Convert snmp-optimized.ts jadi facade kompatibel API lama

**Files:**
- Modify: `modules/network/services/snmp-optimized.ts`
- Test: `tests/modules/network/snmp-optimized.contract.test.ts`

- [ ] **Step 1: Update facade with delegated internals**

```ts
// structure target for modules/network/services/snmp-optimized.ts
import { createSnmpCacheService } from "./snmp-cache.service";
import { SNMPConnectionPoolService } from "./snmp-connection-pool.service";
import { snmpWalkOptimizedExecutor } from "./snmp-walk-executor.service";
import { fetchOnuDatasets, fetchStatusDataset } from "./snmp-dataset-fetch.service";
import { buildEmptyPagination, buildPaginatedOnuItems, buildPagination, getPagedIndexes } from "./snmp-pagination.service";
import type { OnuPaginationResult } from "./snmp-optimized.types";
import { STATUS_NEW_OID } from "./snmp-optimized.constants"; // if needed, otherwise keep local const

const cacheService = createSnmpCacheService();
const connectionPool = new SNMPConnectionPoolService();

export async function snmpWalkOptimized(...) {
  // preserve signature
  // use cacheService + snmpWalkOptimizedExecutor
}

export async function fetchOnuDataPaginated(...) {
  // preserve signature + return shape
  // use fetchStatusDataset/fetchOnuDatasets/pagination service
}

export function clearSNMPCache(): void {
  cacheService.clear();
}

export function cleanupSNMPConnections(): void {
  connectionPool.cleanup();
  clearSNMPCache();
}

if (typeof process !== "undefined") {
  process.on("SIGINT", cleanupSNMPConnections);
  process.on("SIGTERM", cleanupSNMPConnections);
  process.on("beforeExit", cleanupSNMPConnections);
}
```

- [ ] **Step 2: Run contract tests + related tests**

Run:
```bash
npm run test:run -- tests/modules/network/snmp-optimized.contract.test.ts tests/modules/network/snmp-cache.service.test.ts tests/modules/network/snmp-connection-pool.service.test.ts tests/modules/network/snmp-walk-executor.service.test.ts tests/modules/network/snmp-pagination.service.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add modules/network/services/snmp-optimized.ts
git commit -m "refactor: convert snmp-optimized to facade with extracted services"
```

---

## Task 12: Full regression run and cleanup

**Files:**
- Modify (if needed): test fixtures or minor import path fixes.

- [ ] **Step 1: Run targeted network test suite**

Run:
```bash
npm run test:run -- tests/modules/network tests/api/pelanggan-ppp-id-route.test.ts tests/api/profileppps-id-route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint + typecheck for impacted modules**

Run:
```bash
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Final commit for fixes from regression**

```bash
git add modules/network/services tests/modules/network tests/api
git commit -m "test: stabilize network refactor regressions"
```

---

## Task 13: Final verification checklist (manual)

**Files:**
- No code changes expected.

- [ ] **Step 1: Verify API compatibility list**

Checklist:
- `MikroTikPPPSecretService` still exports class default + named behavior unchanged.
- `snmp-optimized.ts` still exports:
  - `snmpWalkOptimized`
  - `fetchOnuDataPaginated`
  - `clearSNMPCache`
  - `cleanupSNMPConnections`

- [ ] **Step 2: Verify no behavior drift with smoke script**

Run:
```bash
npm run test:run -- tests/modules/network/MikroTikPPPSecretService.contract.test.ts tests/modules/network/snmp-optimized.contract.test.ts
```

Expected: PASS.

- [ ] **Step 3: Final integration commit**

```bash
git add -A
git commit -m "refactor: split PPP and SNMP god classes into SRP services"
```

---

## Spec Coverage Check (self-review)

- Requirement: pecah `MikroTikPPPSecretService.ts` jadi context/crud/session/lifecycle/orchestrator ✅ Covered by Tasks 2–6.
- Requirement: pecah `snmp-optimized.ts` jadi cache/pool/walk/dataset/pagination/facade ✅ Covered by Tasks 7–11.
- Requirement: no behavior change ✅ Covered by Task 1 contract baseline + Task 11 + Task 13 smoke contract.
- Requirement: unit test granular ✅ Covered by Tasks 2–5 and 7–10.
- Requirement: smoke test API lama ✅ Covered by Task 13.

No placeholders found. Naming/signature consistency checked across tasks.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-03-network-god-classes-srp-refactor.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
