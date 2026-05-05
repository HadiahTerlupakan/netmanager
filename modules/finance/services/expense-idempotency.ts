import crypto from "crypto";

type ExpenseMutationAction = "create" | "batch-create";

type IdempotencyStatus = "started" | "replay" | "in-progress" | "hash-mismatch";

interface StoredEntry {
  payloadHash: string;
  status: "in-progress" | "completed";
  response?: unknown;
  expiresAt: number;
}

interface BeginInput {
  action: ExpenseMutationAction;
  key: string;
  userId: string;
  payloadHash: string;
}

interface CompleteInput extends BeginInput {
  response: unknown;
}

interface BeginResult {
  status: IdempotencyStatus;
  response?: unknown;
}

const KEY_TTL_MS = 5 * 60 * 1000;
const globalStore = globalThis as unknown as {
  expenseIdempotencyStore?: Map<string, StoredEntry>;
};

const store =
  globalStore.expenseIdempotencyStore ?? new Map<string, StoredEntry>();
if (!globalStore.expenseIdempotencyStore) {
  globalStore.expenseIdempotencyStore = store;
}

function storeKey(input: BeginInput): string {
  return `expense-idem:${input.action}:${input.userId}:${input.key}`;
}

function cleanupExpired(now: number): void {
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function buildExpensePayloadHash(payload: unknown): string {
  const encoded = JSON.stringify(normalizeForHash(payload));
  return crypto.createHash("sha256").update(encoded).digest("hex");
}

function normalizeForHash(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, val]) => [key, normalizeForHash(val)]),
    );
  }
  return value;
}

export function beginExpenseMutation(input: BeginInput): BeginResult {
  const now = Date.now();
  cleanupExpired(now);

  const key = storeKey(input);
  const existing = store.get(key);

  if (!existing) {
    startNewIdempotencyEntry(key, input, now);
    return { status: "started" };
  }

  return resolveExistingIdempotencyEntry(existing, input);
}

function startNewIdempotencyEntry(key: string, input: BeginInput, now: number) {
  store.set(key, {
    payloadHash: input.payloadHash,
    status: "in-progress",
    expiresAt: now + KEY_TTL_MS,
  });
}

function resolveExistingIdempotencyEntry(
  existing: StoredEntry,
  input: BeginInput,
): BeginResult {
  if (existing.payloadHash !== input.payloadHash) {
    return { status: "hash-mismatch" };
  }
  if (existing.status === "completed") {
    return { status: "replay", response: existing.response };
  }
  return { status: "in-progress" };
}

export function completeExpenseMutation(input: CompleteInput): void {
  const key = storeKey(input);
  store.set(key, {
    payloadHash: input.payloadHash,
    status: "completed",
    response: input.response,
    expiresAt: Date.now() + KEY_TTL_MS,
  });
}

export function __resetExpenseIdempotencyStoreForTests(): void {
  store.clear();
}
