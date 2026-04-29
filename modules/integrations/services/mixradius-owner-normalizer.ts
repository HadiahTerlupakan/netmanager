export type NormalizedOwnerName = {
  full: string;
  prefix: string;
};

/**
 * Normalize owner name for exact and prefix-based matching.
 */
export function normalizeMixRadiusOwnerName(
  value: string,
): NormalizedOwnerName {
  const lowerCasedValue = value.toLowerCase().trim();

  return {
    full: lowerCasedValue,
    prefix: lowerCasedValue.split(/[—–-]/)[0].trim(),
  };
}

/**
 * Build owner lookup set used for filters.
 */
export function buildMixRadiusOwnerLookup(owners: string[]): Set<string> {
  const allowedOwners = new Set<string>();

  owners.forEach((owner) => {
    if (!owner) {
      return;
    }

    const normalizedOwnerName = normalizeMixRadiusOwnerName(owner);
    allowedOwners.add(normalizedOwnerName.full);
    allowedOwners.add(normalizedOwnerName.prefix);
  });

  return allowedOwners;
}

/**
 * Check whether owner name matches allowed lookup values.
 */
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
