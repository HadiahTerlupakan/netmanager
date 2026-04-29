import type { OidSequenceValidation, SnmpWalkResult } from "./types";

/** Compare two OIDs numerically. */
export function compareOids(leftOid: string, rightOid: string): number {
  const leftParts = leftOid.split(".").map((part) => parseInt(part, 10) || 0);
  const rightParts = rightOid.split(".").map((part) => parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;

    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }

  return 0;
}

/** Normalize OID by removing a leading dot. */
export function normalizeOid(oid: string): string {
  return oid.startsWith(".") ? oid.substring(1) : oid;
}

/** Convert an SNMP value into a string-safe representation. */
export function stringifySnmpValue(value: unknown): string {
  if (Buffer.isBuffer(value)) {
    return Array.from(value as Uint8Array)
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  }

  return String(value);
}

/** Check whether a varbind OID still belongs to the requested subtree. */
export function isOidInSubtree(varbindOid: string, baseOid: string): boolean {
  const baseParts = normalizeOid(baseOid).split(".").filter(Boolean);
  const oidParts = normalizeOid(varbindOid).split(".").filter(Boolean);

  if (oidParts.length < baseParts.length) {
    return false;
  }

  return baseParts.every((part, index) => oidParts[index] === part);
}

/** Validate walked OIDs for significant gaps. */
export function validateOidSequence(
  results: SnmpWalkResult[],
  baseOid: string,
): OidSequenceValidation {
  if (results.length === 0) {
    return { isValid: true, gaps: [], warnings: [] };
  }

  const sortedResults = [...results].sort((left, right) =>
    compareOids(left.oid, right.oid),
  );
  const gaps: OidSequenceValidation["gaps"] = [];
  const warnings: string[] = [];
  const baseParts = normalizeOid(baseOid).split(".").filter(Boolean);

  for (let index = 1; index < sortedResults.length; index += 1) {
    const previous = sortedResults[index - 1];
    const current = sortedResults[index];
    if (!previous || !current) continue;

    const previousParts = normalizeOid(previous.oid).split(".").filter(Boolean);
    const currentParts = normalizeOid(current.oid).split(".").filter(Boolean);
    const previousBase = previousParts.slice(0, baseParts.length).join(".");
    const currentBase = currentParts.slice(0, baseParts.length).join(".");

    if (previousBase !== currentBase || previousBase !== baseParts.join(".")) {
      continue;
    }

    const previousIndex = previousParts.slice(baseParts.length);
    const currentIndex = currentParts.slice(baseParts.length);
    const previousTail = parseInt(
      previousIndex[previousIndex.length - 1] ?? "0",
      10,
    );
    const currentTail = parseInt(
      currentIndex[currentIndex.length - 1] ?? "0",
      10,
    );

    if (previousIndex.length !== currentIndex.length) {
      continue;
    }

    if (
      !Number.isNaN(previousTail) &&
      !Number.isNaN(currentTail) &&
      currentTail - previousTail > 1
    ) {
      const gapCount = currentTail - previousTail - 1;
      gaps.push({ from: previous.oid, to: current.oid, count: gapCount });

      if (gapCount > 10) {
        warnings.push(
          `Large gap detected: ${gapCount} missing OIDs between ${previous.oid} and ${current.oid}`,
        );
      }
    }
  }

  return {
    isValid: gaps.length === 0 || gaps.every((gap) => gap.count <= 5),
    gaps,
    warnings,
  };
}
