const DEFAULT_CREATE_LIMIT = 10;

/** Buat kandidat ID pelanggan. */
export function createCandidatePelangganId() {
  const timestampPart = String(Date.now()).slice(-5);
  const random = Math.floor(Math.random() * 1000);
  return timestampPart + String(random).padStart(3, "0");
}

/** Buat fallback ID pelanggan. */
export function createFallbackPelangganId() {
  const timestampPart = String(Date.now()).slice(-6);
  const random = Math.floor(Math.random() * 10000);
  return timestampPart + String(random).padStart(2, "0");
}

/** Bangun daftar kandidat ID pelanggan berurutan. */
export function buildPelangganIdCandidates() {
  const candidates = Array.from({ length: DEFAULT_CREATE_LIMIT }, () =>
    createCandidatePelangganId(),
  );

  return [...new Set(candidates)];
}

/** Bangun response fallback bila semua kandidat terpakai. */
export function buildFallbackPelangganIdResponse() {
  return { idPelanggan: createFallbackPelangganId() };
}
