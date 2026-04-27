const MIN_ALLOWED_AMOUNT = 0;

/** Memastikan nominal lebih besar dari nol. */
export function validatePositiveAmount(amount: number): string | null {
  if (amount <= MIN_ALLOWED_AMOUNT) {
    return "Jumlah harus lebih dari 0";
  }

  return null;
}

/** Memastikan data rekening transfer penarikan terisi lengkap. */
export function validateTransferDetails(input: {
  method: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}): string | null {
  if (input.method !== "TRANSFER") {
    return null;
  }

  if (input.bankName && input.accountNumber && input.accountName) {
    return null;
  }

  return "Informasi bank harus diisi untuk metode transfer";
}
