import type { RealtimeEnvelope } from "@/lib/realtime/contracts";

/**
 * Selisih yang ditoleransi antara createdAt sebuah event dan event terbaru
 * yang sudah ada saat listener tersinkron. Publish yang di-throttle ditulis
 * lewat batch hingga 2 detik setelah createdAt-nya, dan jam antar-pod server
 * tidak pernah persis sama.
 */
const HISTORY_CLOCK_SKEW_MS = 60_000;

type ChannelEnvelope = Partial<RealtimeEnvelope<unknown>>;

interface ChannelDocument {
  id: string;
  data(): ChannelEnvelope;
}

/** Bagian `QuerySnapshot` yang dibaca listener channel. */
export interface ChannelSnapshot {
  metadata: { fromCache: boolean };
  docs: ChannelDocument[];
  docChanges(): Array<{ type: string; doc: ChannelDocument }>;
}

/** createdAt berupa string ISO, epoch ms, atau Timestamp Firestore. */
function toEpochMillis(createdAt: unknown): number | null {
  if (typeof createdAt === "number") {
    return Number.isFinite(createdAt) ? createdAt : null;
  }

  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const timestamp = createdAt as { toMillis?: () => number } | null;
  return typeof timestamp?.toMillis === "function"
    ? timestamp.toMillis()
    : null;
}

function getNewestCreatedAt(documents: ChannelDocument[]): number | null {
  return documents.reduce<number | null>((newest, document) => {
    const createdAt = toEpochMillis(document.data().createdAt);
    if (createdAt === null) return newest;
    return newest === null ? createdAt : Math.max(newest, createdAt);
  }, null);
}

/**
 * Callback `onSnapshot` untuk satu channel scope, dipasang dengan
 * `includeMetadataChanges` supaya potret cache bisa dibedakan dari potret
 * yang sudah dikonfirmasi server.
 *
 * Semua yang sudah ada di channel saat listener tersinkron dengan server
 * adalah riwayat — antarmuka memuatnya lewat REST, bukan lewat event. Potret
 * cache (kosong saat SDK menganggap dirinya offline, atau tertinggal) tidak
 * pernah menyelesaikan sinkronisasi itu; dulu potret pertama apa pun dianggap
 * riwayat, sehingga riwayat yang tiba sesudahnya diputar ulang sebagai
 * puluhan event "baru".
 *
 * Batas waktunya diambil dari createdAt tulisan server, bukan jam perangkat:
 * jam PC yang maju beberapa menit akan membuang event yang sungguh baru.
 *
 * Sejak SDK melayani dari cache sampai server menyusul, yang datang adalah
 * susulan (mis. setelah laptop tidur). Ia tetap diteruskan supaya badge
 * benar, tetapi `onCatchUp` dipanggil lebih dulu supaya diperlakukan seperti
 * halaman yang baru dibuka.
 */
export function createChannelSnapshotListener({
  onNewEvent,
  onCatchUp,
}: {
  onNewEvent: (envelope: ChannelEnvelope) => void;
  onCatchUp: () => void;
}) {
  const seenDocumentIds = new Set<string>();
  let isHydrated = false;
  let historyCutoff: number | null = null;
  let wasServedFromCache = false;

  const isOlderThanHistory = (envelope: ChannelEnvelope) => {
    const createdAt = toEpochMillis(envelope.createdAt);
    return (
      historyCutoff !== null && createdAt !== null && createdAt < historyCutoff
    );
  };

  return (snapshot: ChannelSnapshot): void => {
    if (!isHydrated) {
      snapshot.docs.forEach((document) => seenDocumentIds.add(document.id));
      if (snapshot.metadata.fromCache) return;

      isHydrated = true;
      const newestCreatedAt = getNewestCreatedAt(snapshot.docs);
      historyCutoff =
        newestCreatedAt === null
          ? null
          : newestCreatedAt - HISTORY_CLOCK_SKEW_MS;
      return;
    }

    const { fromCache } = snapshot.metadata;
    if (fromCache || wasServedFromCache) onCatchUp();
    wasServedFromCache = fromCache;

    snapshot.docChanges().forEach((change) => {
      if (change.type !== "added" || seenDocumentIds.has(change.doc.id)) {
        return;
      }

      seenDocumentIds.add(change.doc.id);
      const envelope = change.doc.data();
      if (isOlderThanHistory(envelope)) return;

      onNewEvent(envelope);
    });
  };
}
