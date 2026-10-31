import { vi } from "vitest";

/**
 * Firestore palsu sebatas yang dibaca `useRealtimeSubscription`, dengan
 * aturan SDK yang menentukan kapan sebuah potret sampai ke listener:
 *
 * - tiap listener punya view sendiri; dokumen yang belum ada di view-nya
 *   datang sebagai "added", termasuk saat listener baru menerima sinkronisasi
 *   pertama dari server;
 * - potret pertama selalu dinaikkan, juga potret cache yang kosong saat SDK
 *   menganggap dirinya offline;
 * - potret yang hanya mengubah metadata (`fromCache`) hanya sampai ke
 *   listener yang meminta `includeMetadataChanges`.
 */

interface FakeDocument {
  id: string;
  data: () => Record<string, unknown>;
}

interface FakeFirebaseUser {
  uid: string;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
}

interface FakeListener {
  path: string;
  includeMetadataChanges: boolean;
  next: (snapshot: unknown) => void;
  isActive: boolean;
  view: Map<string, FakeDocument>;
  hasRaisedFirstSnapshot: boolean;
}

// Pabrik vi.mock di bawah baru dipanggil saat modul yang dipalsukan pertama
// kali diimpor oleh berkas tes, setelah objek ini terisi.
export const fakeRealtime = {
  listeners: [] as FakeListener[],
  session: {
    status: "unauthenticated" as "authenticated" | "unauthenticated",
    data: null as { user: Record<string, unknown> } | null,
  },
  services: {
    firebaseApp: {},
    auth: { currentUser: null as FakeFirebaseUser | null },
    firestore: { kind: "firestore" },
    realtimeDatabase: null as unknown,
  },
};

vi.mock("firebase/firestore", () => ({
  collection: (_firestore: unknown, path: string) => ({ path }),
  query: (target: { path: string }) => target,
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: (target: { path: string }, ...args: unknown[]) => {
    const [options, next] =
      typeof args[0] === "function" ? [{}, args[0]] : [args[0], args[1]];
    const listener: FakeListener = {
      path: target.path,
      includeMetadataChanges: Boolean(
        (options as { includeMetadataChanges?: boolean })
          .includeMetadataChanges,
      ),
      next: next as (snapshot: unknown) => void,
      isActive: true,
      view: new Map(),
      hasRaisedFirstSnapshot: false,
    };
    fakeRealtime.listeners.push(listener);
    return () => {
      listener.isActive = false;
    };
  },
}));

/** Pengguna Firebase Auth membawa klaim token custom yang dipakai saat masuk. */
function firebaseUser(
  uid: string,
  claims: Record<string, unknown>,
): FakeFirebaseUser {
  return { uid, getIdTokenResult: async () => ({ claims }) };
}

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: vi.fn(
    async (auth: { currentUser: FakeFirebaseUser | null }, token: string) => {
      const minted = JSON.parse(token) as {
        uid: string;
        claims: Record<string, unknown>;
      };
      auth.currentUser = firebaseUser(minted.uid, minted.claims);
    },
  ),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/database", () => ({
  onDisconnect: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => fakeRealtime.session,
}));

vi.mock("@/lib/realtime/client", () => ({
  getRealtimeClientServices: () => fakeRealtime.services,
}));

/**
 * Klaim yang dicetak `app/api/auth/firebase-token` untuk pengguna sesi,
 * ditulis ulang di sini supaya tes tidak bersandar pada kode yang diujinya.
 */
export function mintedClaimsFor(user: Record<string, unknown>) {
  const isSuperAdmin =
    user.isSuperAdmin === true ||
    user.role === "SUPER_ADMIN" ||
    user.role === "Super Admin";
  const primarySiteId = user.primarySiteId ?? user.siteId ?? null;
  return {
    role: isSuperAdmin ? "SUPER_ADMIN" : (user.role ?? "USER"),
    tenantId: user.tenantId ?? null,
    departmentId: user.departmentId ?? null,
    siteId: primarySiteId,
    primarySiteId,
    accessAdminPanel: user.accessAdminPanel ?? false,
    accessEmployeePanel: user.accessEmployeePanel ?? false,
    isSuperAdmin,
  };
}

/** Jawaban route token palsu: token custom untuk sesi NextAuth saat ini. */
export function mintTokenForCurrentSession(): string {
  const user = fakeRealtime.session.data?.user ?? {};
  return JSON.stringify({ uid: user.id, claims: mintedClaimsFor(user) });
}

/**
 * Masuk sebagai `user`: sesi NextAuth dan pengguna Firebase Auth yang
 * diingat browser sama, dengan klaim yang dicetak untuk sesi itu.
 */
export function signInAs(user: { id: string } & Record<string, unknown>) {
  fakeRealtime.listeners.length = 0;
  fakeRealtime.session.status = "authenticated";
  fakeRealtime.session.data = { user };
  fakeRealtime.services.auth.currentUser = firebaseUser(
    user.id,
    mintedClaimsFor(user),
  );
}

/** Dokumen event seperti yang ditulis `firebaseRealtimeService.publish`. */
export function channelEvent(
  id: string,
  options: { type?: string; createdAt?: unknown; payload?: unknown } = {},
): FakeDocument {
  const envelope = {
    id,
    type: options.type ?? "notification.new",
    payload: options.payload ?? { id, title: `Notifikasi ${id}` },
    createdAt: options.createdAt ?? new Date().toISOString(),
    version: 1,
  };
  return { id, data: () => envelope };
}

export function activeListeners(path: string): FakeListener[] {
  return fakeRealtime.listeners.filter(
    (listener) => listener.isActive && listener.path === path,
  );
}

function deliver(
  listener: FakeListener,
  fromCache: boolean,
  added: FakeDocument[],
) {
  const isMetadataOnly = added.length === 0;
  if (
    listener.hasRaisedFirstSnapshot &&
    isMetadataOnly &&
    !listener.includeMetadataChanges
  ) {
    return;
  }

  listener.hasRaisedFirstSnapshot = true;
  listener.next({
    metadata: { fromCache },
    docs: Array.from(listener.view.values()),
    docChanges: () => added.map((doc) => ({ type: "added", doc })),
  });
}

/**
 * Server mengirim isi channel terkini ke setiap listener aktif; yang belum
 * ada di view sebuah listener sampai kepadanya sebagai "added".
 */
export function syncChannel(path: string, documents: FakeDocument[]) {
  activeListeners(path).forEach((listener) => {
    const added = documents.filter((doc) => !listener.view.has(doc.id));
    added.forEach((doc) => listener.view.set(doc.id, doc));
    deliver(listener, false, added);
  });
}

/**
 * SDK menganggap dirinya offline: tiap listener menerima view-nya sendiri
 * dari cache. Listener yang baru dipasang mendapat potret kosong, karena
 * cache memori tidak menyimpan apa pun untuk query yang baru dilepas.
 */
export function disconnectChannel(path: string) {
  activeListeners(path).forEach((listener) => deliver(listener, true, []));
}
