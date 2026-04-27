const OWNER_SEGMENT_SEPARATOR = /[—–-]/;

export type NormalizedOwnerName = {
  full: string;
  prefix: string;
};

/** Menormalisasi nama owner untuk pencocokan aman. */
export function normalizeMixRadiusOwnerName(
  value: string,
): NormalizedOwnerName {
  const full = value.toLowerCase().trim();
  const prefix = full.split(OWNER_SEGMENT_SEPARATOR)[0]?.trim() ?? "";
  return { full, prefix };
}

/** Membangun set owner yang diizinkan beserta variasi prefix-nya. */
export function buildMixRadiusAllowedOwners(owners: string[]): Set<string> {
  const allowedOwners = new Set<string>();

  for (const owner of owners) {
    if (!owner) {
      continue;
    }

    const normalizedOwner = normalizeMixRadiusOwnerName(owner);
    allowedOwners.add(normalizedOwner.full);
    allowedOwners.add(normalizedOwner.prefix);
  }

  return allowedOwners;
}

/** Mengecek apakah owner item cocok dengan daftar owner yang diizinkan. */
export function matchesMixRadiusOwner(
  itemOwnerName: string | null | undefined,
  allowedOwners: string[],
): boolean {
  if (!itemOwnerName) {
    return false;
  }

  const normalizedItemOwner = normalizeMixRadiusOwnerName(itemOwnerName);
  const normalizedAllowedOwners = buildMixRadiusAllowedOwners(allowedOwners);

  return (
    normalizedAllowedOwners.has(normalizedItemOwner.full) ||
    normalizedAllowedOwners.has(normalizedItemOwner.prefix)
  );
}
