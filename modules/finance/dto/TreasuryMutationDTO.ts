/** Satu baris riwayat perpindahan dana antar akun kas/bank, siap ditampilkan. */
export interface TreasuryMutationRecord {
  id: string;
  date: Date;
  amount: number;
  description: string | null;
  sourceAccount: { id: string; name: string };
  destinationAccount: { id: string; name: string };
  createdBy: { name: string | null } | null;
}
