"use client";

import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useApi } from "@/lib/hooks/useApi";
import type { PaymentMethod } from "./checkout";

const PAYMENT_METHODS_URL = "/api/customer/payment-methods";

export type PaymentMethodsState = {
  list: PaymentMethod[];
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
};

/**
 * Metode bayar untuk nominal yang akan dibayar: server hanya menawarkan
 * kanal yang aktif untuk nominal itu. Daftar lama tetap tampil selama
 * nominal baru (mis. setelah kupon) dimuat.
 */
export function usePaymentMethods(
  isEnabled: boolean,
  amountToPay: number,
): PaymentMethodsState {
  const url =
    amountToPay > 0
      ? `${PAYMENT_METHODS_URL}?amount=${amountToPay}`
      : PAYMENT_METHODS_URL;
  const { data, error, isLoading, refetch } = useApi<PaymentMethod[]>(
    isEnabled ? url : null,
    { queryOptions: { placeholderData: keepPreviousData } },
  );
  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return {
    list,
    isLoading,
    error,
    retry: () => void refetch(),
  };
}
