interface OpnameFailure {
  message: string;
  details?: Record<string, string[]>;
}

interface OpnameItemLabel {
  barangKode: string;
  barangNama: string;
}

const BATCH_ITEM_DETAIL_KEY = /^items\.(\d+)$/;

/**
 * Susun pesan gagal simpan opname untuk layar: masalah per barang ditulis
 * dengan nama barangnya ("ONT ZTE (O-02): ..."), satu baris per masalah.
 * `items` harus berurutan sama dengan payload yang dikirim, karena server
 * menunjuk barang lewat urutannya (`details["items.<index>"]`).
 */
export function describeOpnameFailure(
  failure: OpnameFailure,
  items: readonly OpnameItemLabel[],
): string {
  const lines: string[] = [];

  for (const [key, messages] of Object.entries(failure.details ?? {})) {
    const match = BATCH_ITEM_DETAIL_KEY.exec(key);
    const item = match ? items[Number(match[1])] : undefined;
    const prefix = item ? `${item.barangNama} (${item.barangKode}): ` : "";
    for (const message of messages) lines.push(`${prefix}${message}`);
  }

  return lines.length > 0 ? lines.join("\n") : failure.message;
}
