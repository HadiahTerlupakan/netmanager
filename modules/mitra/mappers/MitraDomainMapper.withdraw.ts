import type { Prisma, WithdrawRequest } from "@prisma/client-mitra";
import type {
  WithdrawRequestEntity,
  WithdrawRequestWalletEntity,
} from "../domain/entities/WithdrawRequestEntity";

/** Map Prisma withdraw wallet projection into pure entity. */
export function toWithdrawRequestWalletEntity(input: {
  id: string;
  balance: Prisma.Decimal | number;
  mitra?: {
    id: string;
    name: string | null;
    email: string;
    mitraType: string;
  } | null;
}): WithdrawRequestWalletEntity {
  return {
    id: input.id,
    balance: toNumberValue(input.balance),
    mitra: input.mitra
      ? {
          id: input.mitra.id,
          name: input.mitra.name,
          email: input.mitra.email,
          mitraType: input.mitra.mitraType,
        }
      : undefined,
  };
}

/** Map Prisma withdraw request into pure entity. */
export function toWithdrawRequestEntity(
  request: Pick<
    WithdrawRequest,
    | "id"
    | "mitraId"
    | "mitraWalletId"
    | "amount"
    | "method"
    | "status"
    | "bankName"
    | "bankAccountNo"
    | "bankAccountName"
    | "notes"
    | "rejectionReason"
    | "processedById"
    | "processedAt"
    | "createdAt"
  > & {
    mitraWallet?: {
      id: string;
      balance: Prisma.Decimal | number;
      mitra?: {
        id: string;
        name: string | null;
        email: string;
        mitraType: string;
      } | null;
    } | null;
  },
): WithdrawRequestEntity {
  return {
    id: request.id,
    mitraId: request.mitraId,
    mitraWalletId: request.mitraWalletId,
    amount: toNumberValue(request.amount),
    method: request.method,
    status: request.status,
    bankName: request.bankName,
    bankAccountNo: request.bankAccountNo,
    bankAccountName: request.bankAccountName,
    notes: request.notes,
    rejectionReason: request.rejectionReason,
    processedById: request.processedById,
    processedAt: request.processedAt,
    createdAt: request.createdAt,
    mitraWallet: request.mitraWallet
      ? toWithdrawRequestWalletEntity(request.mitraWallet)
      : undefined,
  };
}

function toNumberValue(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}
