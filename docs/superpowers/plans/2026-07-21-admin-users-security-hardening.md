# Admin Users Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Critical gaps on admin user management: force-logout must enforce site/tenant scope like delete, and self-delete must be blocked.

**Architecture:** Keep policy in `AdminUserRouteService` (not only thin routes). Force-logout becomes a scoped Result-style method parallel to `deleteAdminUser`. Routes stay thin: permission check + call service + map Result to `ApiErrors`. Reuse existing `checkSiteRestriction` / `canAccessSite` from `@/modules/roles`.

**Tech Stack:** TypeScript, Vitest, Next.js App Router `createHandler`, Prisma via `UserRepository`, existing `AdminUserRouteService` Result helpers (`fail`).

**Source of requirements:** Code review of `admin/users` (session) — Critical #1 force-logout scope, Critical #2 self-delete.

## Global Constraints

- Bahasa Indonesia for user-facing error messages (match existing: "Tidak dapat…", "Anda hanya dapat…").
- No Prisma schema / migration changes.
- No soft-delete redesign (out of scope; hard delete remains).
- Do not weaken existing self force-logout block on the route.
- Conventional commits: `fix(users): …` / `test(users): …` / `docs(changelog): …`.
- TDD: failing test first per task.
- Update `docs/CHANGELOG.md` under `[Unreleased]` when done.
- Work on current branch only if user already authorized main; prefer not force-push.

---

## File map

| File | Responsibility |
|------|----------------|
| `modules/users/services/AdminUserRouteService.ts` | Policy: scoped forceLogout + self-delete guard |
| `app/api/admin/users/[id]/force-logout/route.ts` | Thin handler: pass session, map Result → HTTP |
| `tests/modules/users/services/AdminUserRouteService.test.ts` | Unit tests forceLogout + self-delete |
| `tests/api/admin-users-force-logout-route.test.ts` | Create if missing — route maps 403/400/404 |
| `docs/CHANGELOG.md` | SOT entry |

---

### Task 1: Block self-delete in `deleteAdminUser`

**Files:**
- Modify: `modules/users/services/AdminUserRouteService.ts` (`deleteAdminUser`, ~L163–176)
- Test: `tests/modules/users/services/AdminUserRouteService.test.ts` (extend `describe("deleteAdminUser")`)

**Interfaces:**
- Consumes: existing `deleteAdminUser(session: AdminSession, userId: string): Promise<UserRouteResult<…>>`
- Produces: same signature; new branch returns `fail(400, "Tidak dapat menghapus akun sendiri")` when `session.user.id === userId`

- [ ] **Step 1: Write the failing test**

Append inside `describe("deleteAdminUser")` in `tests/modules/users/services/AdminUserRouteService.test.ts`:

```typescript
it("menolak self-delete", async () => {
  const result = await service.deleteAdminUser(
    createSession({ id: "admin-1" }),
    "admin-1",
  );

  expect(result.ok).toBe(false);
  expect(result).toMatchObject({
    error: { code: 400, message: "Tidak dapat menghapus akun sendiri" },
  });
  expect(repository.findById).not.toHaveBeenCalled();
  expect(repository.delete).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run tests/modules/users/services/AdminUserRouteService.test.ts -t "menolak self-delete"
```

Expected: FAIL (delete proceeds or wrong code; currently no self-check).

- [ ] **Step 3: Minimal implementation**

In `AdminUserRouteService.deleteAdminUser`, **before** `findById`:

```typescript
async deleteAdminUser(session: AdminSession, userId: string) {
  if (session.user.id === userId) {
    return fail(400, "Tidak dapat menghapus akun sendiri");
  }
  const targetUser = await this.userRepository.findById(userId);
  // ... existing body unchanged
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/modules/users/services/AdminUserRouteService.test.ts
```

Expected: all existing delete tests still pass + new self-delete test PASS.

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  modules/users/services/AdminUserRouteService.ts \
  tests/modules/users/services/AdminUserRouteService.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(users): block admin self-delete

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 2: Scoped force-logout in service layer

**Files:**
- Modify: `modules/users/services/AdminUserRouteService.ts` — replace `forceLogoutUser(targetUserId: string)` with session-aware method
- Test: `tests/modules/users/services/AdminUserRouteService.test.ts`

**Interfaces:**
- **Before:** `forceLogoutUser(targetUserId: string): Promise<{id,name,tokenVersion}|null>`
- **After:**

```typescript
async forceLogoutUser(
  session: AdminSession,
  targetUserId: string,
): Promise<
  UserRouteResult<{ id: string; name: string | null; tokenVersion: number }>
>
```

- Returns `fail(400, …)` self, `fail(404, …)` missing, `fail(403, …)` site/tenant, `ok` + data on success.

**Policy (must match delete + extra tenant check):**

1. If `session.user.id === targetUserId` → 400 `"Tidak dapat force logout diri sendiri"`
2. `findById(targetUserId)`; if null → 404 `"User tidak ditemukan"`
3. If both `session.user.tenantId` and `targetUser.tenantId` set and unequal → 403 `"Anda tidak memiliki akses ke user tenant lain"`
4. `checkSiteRestriction(session, "users")`; if restricted and `!canAccessSite(session, "users", targetUser.siteId)` → 403 `"Anda hanya dapat force logout user di site Anda"`
5. Else `incrementTokenVersion(targetUserId)`; if null → 404; else `{ ok: true, data: updated }`

- [ ] **Step 1: Write failing tests**

Add `describe("forceLogoutUser", () => { … })` in the same test file:

```typescript
describe("forceLogoutUser", () => {
  it("menolak force logout diri sendiri", async () => {
    const result = await service.forceLogoutUser(
      createSession({ id: "admin-1" }),
      "admin-1",
    );
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { code: 400 } });
    expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it("menolak force logout user di luar site saat restricted", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: "user-remote",
      siteId: "site-other",
      tenantId: "tenant-admin",
    } as never);
    mockFns.checkSiteRestriction.mockReturnValueOnce({
      isRestricted: true,
      primarySiteId: "site-mine",
      siteIds: ["site-mine"],
    });
    mockFns.canAccessSite.mockReturnValueOnce(false);

    const result = await service.forceLogoutUser(
      createSession({ tenantId: "tenant-admin" }),
      "user-remote",
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { code: 403 } });
    expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it("menolak force logout user tenant berbeda", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: "user-x",
      siteId: "site-mine",
      tenantId: "tenant-other",
    } as never);

    const result = await service.forceLogoutUser(
      createSession({ tenantId: "tenant-admin" }),
      "user-x",
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { code: 403 } });
    expect(repository.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it("force logout sukses saat site accessible", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      id: "user-local",
      siteId: "site-mine",
      tenantId: "tenant-admin",
    } as never);
    vi.mocked(repository.incrementTokenVersion).mockResolvedValueOnce({
      id: "user-local",
      name: "Local",
      tokenVersion: 3,
    });
    mockFns.checkSiteRestriction.mockReturnValueOnce({
      isRestricted: true,
      primarySiteId: "site-mine",
      siteIds: ["site-mine"],
    });
    mockFns.canAccessSite.mockReturnValueOnce(true);

    const result = await service.forceLogoutUser(
      createSession({ tenantId: "tenant-admin" }),
      "user-local",
    );

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      data: { id: "user-local", tokenVersion: 3 },
    });
    expect(repository.incrementTokenVersion).toHaveBeenCalledWith("user-local");
  });
});
```

**Note:** Ensure mock repository in `beforeEach` includes `incrementTokenVersion: vi.fn()` if not already present.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run tests/modules/users/services/AdminUserRouteService.test.ts -t "forceLogoutUser"
```

Expected: FAIL (old signature / no scope).

- [ ] **Step 3: Implement service method**

Replace body of `forceLogoutUser` in `AdminUserRouteService.ts`:

```typescript
async forceLogoutUser(session: AdminSession, targetUserId: string) {
  if (session.user.id === targetUserId) {
    return fail(400, "Tidak dapat force logout diri sendiri");
  }

  const targetUser = await this.userRepository.findById(targetUserId);
  if (!targetUser) return fail(404, USER_NOT_FOUND);

  if (
    session.user.tenantId &&
    targetUser.tenantId &&
    session.user.tenantId !== targetUser.tenantId
  ) {
    return fail(403, "Anda tidak memiliki akses ke user tenant lain");
  }

  const { isRestricted } = checkSiteRestriction(session, "users");
  if (isRestricted && !canAccessSite(session, "users", targetUser.siteId)) {
    return fail(403, "Anda hanya dapat force logout user di site Anda");
  }

  const updated = await this.userRepository.incrementTokenVersion(targetUserId);
  if (!updated) return fail(404, USER_NOT_FOUND);

  return {
    ok: true as const,
    data: updated,
  };
}
```

Ensure `AdminSession` already carries `permissions` when site restriction needs them (same as delete — session from route must include `user.permissions` if `checkSiteRestriction` reads them). Mirror how DELETE route builds `scopedSession`.

- [ ] **Step 4: Run unit tests — PASS**

```bash
npx vitest run tests/modules/users/services/AdminUserRouteService.test.ts
```

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  modules/users/services/AdminUserRouteService.ts \
  tests/modules/users/services/AdminUserRouteService.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(users): scope force-logout by site and tenant

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 3: Wire force-logout route to scoped service

**Files:**
- Modify: `app/api/admin/users/[id]/force-logout/route.ts`
- Create: `tests/api/admin-users-force-logout-route.test.ts` (if no existing route test)

**Interfaces:**
- Consumes: `forceLogoutUser(session, targetUserId)` Result
- Route still requires `permissions: ["users:force_logout"]`
- Pass session with `user.permissions` from `ctx.permissions` (like PATCH/DELETE on `[id]/route.ts`)

- [ ] **Step 1: Write failing route test**

Create `tests/api/admin-users-force-logout-route.test.ts` following pattern of `tests/api/admin-users-id-route.test.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  forceLogoutUser: vi.fn(),
  forceLogout: vi.fn(),
  logActivity: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createHandler: (_options: unknown, handler: unknown) => handler,
    apiSuccess: (data: unknown, meta?: unknown) =>
      NextResponse.json({ success: true, data, ...((meta as object) || {}) }),
    ApiErrors: {
      badRequest: (m: string) =>
        NextResponse.json({ error: m }, { status: 400 }),
      forbidden: (m: string) =>
        NextResponse.json({ error: m }, { status: 403 }),
      notFound: (m: string) =>
        NextResponse.json({ error: m }, { status: 404 }),
      unauthorized: () =>
        NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    },
  };
});

vi.mock("@/lib/websocket/emitter", () => ({
  socketEmitter: { forceLogout: mockFns.forceLogout },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    apiRequest: mockFns.apiRequest,
    logActivity: mockFns.logActivity,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/modules/users", () => ({
  AdminUserRouteService: class {
    forceLogoutUser = mockFns.forceLogoutUser;
  },
  forceLogoutSchema: { parse: (v: unknown) => v },
}));

describe("POST /api/admin/users/[id]/force-logout", () => {
  let POST: (typeof import("@/app/api/admin/users/[id]/force-logout/route"))["POST"];

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/admin/users/[id]/force-logout/route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps service 403 to forbidden and does not emit socket", async () => {
    mockFns.forceLogoutUser.mockResolvedValueOnce({
      ok: false,
      error: { code: 403, message: "Anda hanya dapat force logout user di site Anda" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/users/u2/force-logout", {
        method: "POST",
        body: "{}",
      }),
      {
        params: { id: "u2" },
        session: { user: { id: "admin-1", tenantId: "t1" } },
        permissions: ["users:force_logout"],
      } as never,
    );

    expect(response.status).toBe(403);
    expect(mockFns.forceLogout).not.toHaveBeenCalled();
  });

  it("on success increments via service and emits forceLogout", async () => {
    mockFns.forceLogoutUser.mockResolvedValueOnce({
      ok: true,
      data: { id: "u2", name: "Budi", tokenVersion: 4 },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/admin/users/u2/force-logout", {
        method: "POST",
        body: "{}",
      }),
      {
        params: { id: "u2" },
        session: { user: { id: "admin-1", tenantId: "t1" } },
        permissions: ["users:force_logout"],
      } as never,
    );

    expect(response.status).toBe(200);
    expect(mockFns.forceLogoutUser).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: "admin-1" }),
      }),
      "u2",
    );
    expect(mockFns.forceLogout).toHaveBeenCalledWith("u2");
  });
});
```

Adjust mock of `forceLogoutSchema` if route imports from `@/lib/validations/user` instead — match real import path in route file.

- [ ] **Step 2: Run — expect FAIL** (route still calls old `forceLogoutUser(id)` only)

- [ ] **Step 3: Update route**

Rewrite handler body (keep permission + swagger):

```typescript
export const POST = createHandler(
  {
    auth: true,
    permissions: ["users:force_logout"],
    schema: forceLogoutSchema,
  },
  async (_req, ctx) => {
    const startTime = Date.now();
    const { session, params, permissions } = ctx;
    const targetUserId =
      typeof params.id === "string" ? params.id : params.id?.[0];

    if (!targetUserId) return ApiErrors.badRequest("ID User tidak valid");
    if (!session) return ApiErrors.unauthorized();

    const scopedSession = {
      ...session,
      user: {
        ...session.user,
        permissions: Array.isArray(permissions) ? permissions : [],
      },
    };

    const adminUserRouteService = new AdminUserRouteService();
    const result = await adminUserRouteService.forceLogoutUser(
      scopedSession as never,
      targetUserId,
    );

    if (result.ok === false) {
      if (result.error.code === 400)
        return ApiErrors.badRequest(result.error.message);
      if (result.error.code === 403)
        return ApiErrors.forbidden(result.error.message);
      if (result.error.code === 404) return ApiErrors.notFound("User");
      return ApiErrors.badRequest(result.error.message);
    }

    socketEmitter.forceLogout(targetUserId);

    logger.apiRequest(
      "POST",
      `/api/admin/users/${targetUserId}/force-logout`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        targetUserId,
        newTokenVersion: result.data.tokenVersion,
      },
    );

    await logger.logActivity({
      action: "FORCE_LOGOUT",
      subject: "User",
      userId: session.user.id,
      details: { id: targetUserId, name: result.data.name },
    });

    return apiSuccess(
      { tokenVersion: result.data.tokenVersion },
      { message: `User ${result.data.name} berhasil di-logout paksa` },
    );
  },
);
```

Remove duplicate self-check on route (service owns it) **or** keep as defense-in-depth — either OK; prefer service as single source, route can keep early self-check for fewer DB hits.

- [ ] **Step 4: Run route + service tests**

```bash
npx vitest run \
  tests/modules/users/services/AdminUserRouteService.test.ts \
  tests/api/admin-users-force-logout-route.test.ts \
  tests/api/admin-users-id-route.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
GIT_MASTER=1 git add \
  app/api/admin/users/[id]/force-logout/route.ts \
  tests/api/admin-users-force-logout-route.test.ts
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
fix(users): wire force-logout route to scoped service policy

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

### Task 4: Grep call sites + changelog

**Files:**
- Grep: any other callers of `forceLogoutUser(`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Find callers**

```bash
rg -n "forceLogoutUser" --glob "*.ts" --glob "*.tsx"
```

Expected: only `AdminUserRouteService` + force-logout route (+ tests). Fix any leftover old arity.

- [ ] **Step 2: Changelog entry**

Under `## [Unreleased]`:

```markdown
### [2026-07-21] — Harden force-logout scope + block self-delete

- **Tipe**: [FIXED]
- **Scope**: `modules/users`, `app/api/admin/users`
- **Author**: agent
- **Deskripsi**: Force logout admin kini enforce site restriction + tenant
  match (sama pola delete). Self-delete user diblok 400. Policy di service
  layer agar tidak hanya di route.
- **Files**: `AdminUserRouteService.ts`,
  `app/api/admin/users/[id]/force-logout/route.ts`
- **Breaking**: ❌ Tidak (API contract sama; 403 baru untuk cross-site)
```

- [ ] **Step 3: Full related test pass**

```bash
npx vitest run tests/modules/users/services/AdminUserRouteService.test.ts tests/api/admin-users
```

- [ ] **Step 4: Commit**

```bash
GIT_MASTER=1 git add docs/CHANGELOG.md
GIT_MASTER=1 git commit -m "$(cat <<'EOF'
docs(changelog): catat harden force-logout dan self-delete

Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)

Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
EOF
)"
```

---

## Out of scope (do not implement in this plan)

- Soft-delete user model
- PII log redaction on create (Important #4 — separate small PR)
- `useUserList` setState-during-render (Important #5)
- Compare / performance API parity audit

---

## Spec coverage self-check

| Review requirement | Task |
|--------------------|------|
| Force-logout site scope | Task 2–3 |
| Force-logout tenant check | Task 2 |
| Force-logout policy in service | Task 2–3 |
| Self-delete block | Task 1 |
| Self force-logout still blocked | Task 2 (service) + optional route keep |
| Tests | Task 1–3 |
| Changelog | Task 4 |

## Placeholder scan

No TBD. Message strings fixed. `AdminSession` type already used by delete — reuse.

---

## Execution handoff

Plan complete and saved to [`docs/superpowers/plans/2026-07-21-admin-users-security-hardening.md`](file:///Users/rohadimraja/Documents/radpro/netmanager/docs/superpowers/plans/2026-07-21-admin-users-security-hardening.md).

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session via executing-plans with checkpoints  

Which approach?
