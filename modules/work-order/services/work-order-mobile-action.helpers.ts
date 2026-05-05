import type {
  MobileActionContext,
  MobileActionPayload,
} from "./work-order-mobile-action.types";

const MAX_COORDINATE_LENGTH = 8;

export {
  storeCompletionAttachments,
  storeSingleAttachment,
} from "./work-order-mobile-action.attachments";

/** Bangun konteks aksi mobile yang dipakai lintas flow. */
export function buildActionContext(input: {
  actorName: string;
  payload: MobileActionPayload;
  ticketNumber: string;
  workOrderId: string;
}): MobileActionContext {
  return {
    actorName: input.actorName,
    timestamp: input.payload.timestamp
      ? new Date(input.payload.timestamp)
      : undefined,
    locationLabel: buildLocationLabel(input.payload),
    ticketNumber: input.ticketNumber,
    workOrderId: input.workOrderId,
  };
}

/** Pastikan payload catatan minimal punya note atau foto. */
export function ensureNotePayload(payload: MobileActionPayload) {
  if (payload.notes || payload.photo || payload.photoUrl) {
    return;
  }

  throw new Error("Catatan atau foto wajib diisi");
}

/** Ambil pesan default bila note kosong namun ada foto. */
export function getDefaultNoteMessage(payload: MobileActionPayload) {
  return payload.photo || payload.photoUrl ? "Mengunggah foto" : "";
}

/** Validasi status work order berdasarkan daftar status yang diizinkan. */
export function ensureWorkOrderStatus(
  status: string | undefined,
  allowed: string[],
  message: string,
) {
  if (status && allowed.includes(status)) {
    return;
  }

  if (message === "Hanya WO berstatus IN_PROGRESS yang dapat diselesaikan") {
    throw new Error(message);
  }

  throw new Error(`${message}: ${status}`);
}

function buildLocationLabel(payload: MobileActionPayload) {
  const coords = buildCoordinateLabel(payload.latitude, payload.longitude);
  if (payload.locationName && coords) {
    return `${payload.locationName} ${coords}`;
  }

  if (payload.locationName) {
    return payload.locationName;
  }

  return coords ? `Loc: ${coords}` : "Loc: Unknown";
}

function buildCoordinateLabel(
  latitude?: string | number,
  longitude?: string | number,
) {
  if (!latitude || !longitude) {
    return "";
  }

  const lat = String(latitude).slice(0, MAX_COORDINATE_LENGTH);
  const lng = String(longitude).slice(0, MAX_COORDINATE_LENGTH);
  return `(${lat}, ${lng})`;
}
