# Dependency Hardening Stage 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce remaining dependency vulnerabilities through safe transitive mitigation and produce an evidence-based risk matrix for unresolved advisories.

**Architecture:** Use npm-native dependency controls (`dependencies`, `devDependencies`, and `overrides`) to force patched transitive versions where compatible. Validate every change using security (`npm audit`) and quality gates (`npm run check`, `npm run test:run`) so mitigations do not regress build/test behavior.

**Tech Stack:** npm, Next.js, TypeScript, Prisma, Vitest, ESLint, package-lock-based dependency resolution.

---

### Task 1: Collect exact remaining advisory graph

**Files:**
- Modify: `package-lock.json` (read-only during this task)
- Output: advisory snapshot in terminal (JSON)

**Step 1: Capture fresh advisory JSON**

Run: `npm audit --json`
Expected: JSON output with vulnerabilities and affected paths.

**Step 2: Capture vulnerable package tree**

Run: `npm ls dompurify serialize-javascript @hono/node-server workbox-build workbox-webpack-plugin --depth=6`
Expected: concrete transitive chains for each high/moderate advisory.

### Task 2: Identify safe patch targets for transitive packages

**Files:**
- Modify: `package.json` (candidate `overrides`)

**Step 1: Check latest versions for vulnerable transitive packages**

Run: `npm view <package> version` for each package flagged by audit.
Expected: patch target candidates from registry.

**Step 2: Decide feasible overrides**

Action: choose only versions that satisfy ecosystem compatibility and avoid major-breaking jumps unless necessary.
Expected: shortlist of overrides to apply.

### Task 3: Apply mitigations in manifest

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Add or adjust `overrides` entries**

Action: pin vulnerable transitives to patched versions where feasible.
Expected: deterministic override config in `package.json`.

**Step 2: Reinstall and refresh lockfile**

Run: `npm install`
Expected: lockfile resolved with overrides and no install failures.

### Task 4: Verify functional safety

**Files:**
- Verify: `package.json`, `package-lock.json`

**Step 1: Run quality gate**

Run: `npm run check`
Expected: lint + typecheck + build pass.

**Step 2: Run tests**

Run: `npm run test:run`
Expected: tests pass or clearly documented unrelated pre-existing failures.

### Task 5: Verify security outcome and document residual risk

**Files:**
- Create: `docs/security/dependency-risk-matrix-2026-03-08.md`

**Step 1: Run final audit**

Run: `npm audit --json`
Expected: reduced or unchanged count with explicit reasons.

**Step 2: Produce risk matrix**

Action: document each remaining advisory with severity, dependency path, fix status, mitigation, and follow-up owner/action.
Expected: actionable matrix for unresolved upstream/transitive issues.
