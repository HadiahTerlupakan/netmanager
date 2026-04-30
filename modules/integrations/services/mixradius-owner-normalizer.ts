const OWNER_SEGMENT_SEPARATOR = /[—–-]/;

export type NormalizedOwnerName = {
  full: string;
  prefix: string;
};

/** Normalize owner name for exact and prefix-based matching. */
export function normalizeMixRadiusOwnerName(
  value: string,
): NormalizedOwnerName {
  const full = value.toLowerCase().trim();
  const prefix = full.split(OWNER_SEGMENT_SEPARATOR)[0]?.trim() ?? "";
  return { full, prefix };
}

/** Build owner lookup set used for filters. */
export function buildMixRadiusOwnerLookup(owners: string[]): Set<string> {
  const allowedOwners = new Set<string>();

  for (const owner of owners) {
    if (!owner) {
      continue;
    }

    const normalizedOwnerName = normalizeMixRadiusOwnerName(owner);
    allowedOwners.add(normalizedOwnerName.full);
    allowedOwners.add(normalizedOwnerName.prefix);
  }

  return allowedOwners;
}

/** Check whether owner name matches allowed lookup values. */
export function isMixRadiusOwnerAllowed(
  ownerName: string | null | undefined,
  allowedOwners: Set<string>,
): boolean {
  if (!ownerName) {
    return false;
  }

  const normalizedOwnerName = normalizeMixRadiusOwnerName(ownerName);
  return (
    allowedOwners.has(normalizedOwnerName.full) ||
    allowedOwners.has(normalizedOwnerName.prefix)
  );
}
