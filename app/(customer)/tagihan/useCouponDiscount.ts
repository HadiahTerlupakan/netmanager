"use client";

import { useState } from "react";

export type AppliedCoupon = { code: string; amount: number };

/** Kode kupon yang diketik pelanggan dan potongan yang sudah diverifikasi server. */
export function useCouponDiscount(totalPending: number) {
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);

  const apply = async () => {
    if (!code.trim()) return;
    setIsChecking(true);
    setError("");
    setApplied(null);
    try {
      // `/api/coupons/verify` khusus staf (NextAuth) dan selalu 401 untuk
      // pelanggan; endpoint pelanggan mengambil id pelanggan dari sesi.
      const res = await fetch("/api/customer/coupons/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount: totalPending }),
      });
      const data = await res.json();
      if (data.success && data.data?.valid) {
        setApplied({ code: data.data.code, amount: data.data.discountAmount });
      } else {
        setError(data.error || "Kupon tidak valid");
      }
    } catch {
      setError("Gagal memverifikasi kupon");
    } finally {
      setIsChecking(false);
    }
  };

  const remove = () => {
    setApplied(null);
    setCode("");
  };

  return {
    code,
    setCode: (value: string) => setCode(value.toUpperCase()),
    isChecking,
    error,
    applied,
    apply,
    remove,
  };
}

export type CouponDiscount = ReturnType<typeof useCouponDiscount>;
