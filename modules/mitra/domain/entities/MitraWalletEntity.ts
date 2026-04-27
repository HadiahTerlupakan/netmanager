export interface MitraWalletEntity {
  id: string;
  mitraId: string;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
}

export interface MitraTypeEntity {
  mitraType: string;
}

export interface MitraTransactionEntity {
  id: string;
  walletId: string;
  amount: number;
  type: string;
  description: string | null;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: Date;
}

export interface WalletTransactionPageEntity {
  transactions: MitraTransactionEntity[];
  total: number;
  page: number;
  totalPages: number;
}

export interface WalletSummaryEntity {
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  earningsThisMonth: number;
  earningsCount: number;
}
