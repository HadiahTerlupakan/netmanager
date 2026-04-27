export interface WithdrawRequestMitraEntity {
  id: string;
  name: string | null;
  email: string;
  mitraType: string;
}

export interface WithdrawRequestWalletEntity {
  id: string;
  balance: number;
  mitra?: WithdrawRequestMitraEntity;
}

export interface WithdrawRequestEntity {
  id: string;
  mitraId: string;
  mitraWalletId: string;
  amount: number;
  method: string;
  status: string;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  notes: string | null;
  rejectionReason: string | null;
  processedById: string | null;
  processedAt: Date | null;
  createdAt: Date;
  mitraWallet?: WithdrawRequestWalletEntity;
}

export interface WithdrawRequestListEntity {
  requests: WithdrawRequestEntity[];
  total: number;
  page: number;
  totalPages: number;
}
