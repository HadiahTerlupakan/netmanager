"use client";

import { useId } from "react";
import { MdCancel, MdCreditCard, MdLocalOffer } from "react-icons/md";
import { CustomerDialog } from "@/components/customer/CustomerDialog";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { PaymentMethodOptions } from "./PaymentMethodOptions";
import type { CouponDiscount } from "./useCouponDiscount";
import type { PaymentMethodsState } from "./usePaymentMethods";

type Props = {
  itemCount: number;
  totalPending: number;
  /** VA/QR lama masih bisa dibayar sampai kedaluwarsa. */
  isReplacingCheckout: boolean;
  coupon: CouponDiscount;
  methods: PaymentMethodsState;
  selectedCode: string;
  onSelectMethod: (code: string) => void;
  isSubmitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** Lembar rincian pembayaran: kupon, pilihan metode, dan konfirmasi bayar. */
export function PaymentMethodDialog(props: Props) {
  const titleId = useId();
  const methodLabelId = useId();
  const couponInputId = useId();
  const { coupon } = props;
  const discount = coupon.applied?.amount ?? 0;
  const hasSelection = props.methods.list.some(
    (method) => method.code === props.selectedCode,
  );

  return (
    <CustomerDialog labelledBy={titleId} onClose={props.onClose}>
      <div className="flex justify-between items-center mb-6">
        <h2 id={titleId} className="text-xl font-bold">
          Rincian Pembayaran
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tutup"
          onClick={props.onClose}
        >
          <MdCancel className="text-2xl text-gray-500" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-4 max-h-[70vh] overflow-y-auto hide-scrollbar pb-2">
        {/* Duitku tidak bisa menutup VA lebih awal; kelebihan bayar
            dikreditkan ke saldo oleh webhook. */}
        {props.isReplacingCheckout && (
          <p className="text-xs rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Nomor VA/QRIS sebelumnya akan diganti. Bayar hanya yang baru; bila
            terlanjur membayar keduanya, kelebihannya menjadi saldo yang
            memotong tagihan berikutnya.
          </p>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">
            Total Tagihan ({props.itemCount} item)
          </span>
          <span className="font-semibold">
            {formatCurrency(props.totalPending)}
          </span>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={couponInputId}
            className="text-sm font-medium flex items-center gap-2"
          >
            <MdLocalOffer className="text-[#0d9488]" aria-hidden="true" />
            Kode Kupon
          </label>
          <div className="flex gap-2">
            <input
              id={couponInputId}
              type="text"
              className="flex-1 min-w-0 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 uppercase"
              placeholder="Masukkan kode"
              value={coupon.code}
              onChange={(event) => coupon.setCode(event.target.value)}
              disabled={coupon.applied !== null}
            />
            {coupon.applied ? (
              <Button variant="destructive" size="sm" onClick={coupon.remove}>
                Hapus
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={coupon.apply}
                disabled={coupon.isChecking || !coupon.code}
                loading={coupon.isChecking}
              >
                Gunakan
              </Button>
            )}
          </div>
          {coupon.error && (
            <p className="text-xs text-red-500">{coupon.error}</p>
          )}
          {coupon.applied && (
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
              <span>Diskon ({coupon.applied.code})</span>
              <span className="font-bold">-{formatCurrency(discount)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-4" />

        <div className="space-y-2">
          <p
            id={methodLabelId}
            className="text-sm font-medium flex items-center gap-2"
          >
            <MdCreditCard className="text-[#0d9488]" aria-hidden="true" />
            Metode Pembayaran
          </p>
          <PaymentMethodOptions
            methods={props.methods}
            labelledBy={methodLabelId}
            selectedCode={props.selectedCode}
            onSelect={props.onSelectMethod}
          />
        </div>

        <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-4" />

        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total Bayar</span>
          <span className="text-[#0d9488]">
            {formatCurrency(props.totalPending - discount)}
          </span>
        </div>

        {props.submitError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {props.submitError}
          </p>
        )}
        {!hasSelection && props.methods.list.length > 0 && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Pilih metode pembayaran terlebih dahulu.
          </p>
        )}
        <Button
          onClick={props.onConfirm}
          disabled={props.isSubmitting || !hasSelection}
          loading={props.isSubmitting}
          className="w-full h-12 mt-2"
        >
          Konfirmasi & Bayar
        </Button>
      </div>
    </CustomerDialog>
  );
}
