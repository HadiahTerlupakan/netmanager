"use client";

import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";
import { MdContentCopy, MdDownload } from "react-icons/md";
import { Button } from "@/components/ui/Button";

const QR_SIZE_PX = 240;

type Props = {
  amount: string;
  vaNumber?: string | null;
  qrString?: string | null;
  methodName?: string;
  methodType?: string;
  onCopy: (text: string, label: string) => void;
};

/**
 * Kartu checkout gateway yang menunggu dibayar. Halaman bayar gateway hanya
 * dibuka untuk metode tanpa instruksi (kartu kredit, e-wallet dengan login).
 */
export function GatewayPendingCard(
  props: Props & { paymentUrl?: string; onChangeMethod: () => void },
) {
  const hasInstructions = Boolean(props.vaNumber || props.qrString);

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-lg p-4 border border-gray-100 dark:border-gray-800 shadow-sm mb-4">
      {hasInstructions ? (
        <GatewayPayInstructions {...props} />
      ) : (
        <>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-2 font-medium">
            Total Pembayaran
          </p>
          <p className="font-bold text-center text-[#0d9488] text-2xl">
            {props.amount}
          </p>
        </>
      )}
      {props.paymentUrl && !hasInstructions && (
        <Button
          className="w-full mt-4"
          onClick={() => {
            window.location.href = props.paymentUrl!;
          }}
        >
          Lanjutkan ke Halaman Pembayaran
        </Button>
      )}
      {/* VA yang belum dibayar bisa diganti QRIS dan sebaliknya; backend
          menutup checkout lama. */}
      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={props.onChangeMethod}
      >
        Ganti Metode Pembayaran
      </Button>
    </div>
  );
}

/**
 * Instruksi bayar yang dikirim gateway (nomor VA, kode bayar minimarket,
 * string QRIS), ditampilkan di portal sendiri alih-alih mengalihkan
 * pelanggan ke halaman bayar gateway.
 */
export function GatewayPayInstructions(props: Props) {
  if (props.qrString) {
    return <QrisInstructions {...props} qrString={props.qrString} />;
  }
  if (props.vaNumber) {
    return <CodeInstructions {...props} vaNumber={props.vaNumber} />;
  }
  return null;
}

function QrisInstructions({ amount, qrString }: Props & { qrString: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCodeLib.toDataURL(qrString, { width: QR_SIZE_PX, margin: 2 })
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [qrString]);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
        Scan QRIS dengan aplikasi bank atau e-wallet
      </p>
      {dataUrl ? (
        // QR harus tetap putih agar terbaca kamera, termasuk di mode gelap.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="Kode QRIS pembayaran"
          width={QR_SIZE_PX}
          height={QR_SIZE_PX}
          className="rounded-lg bg-white"
        />
      ) : (
        <div className="w-[240px] h-[240px] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      )}
      <p className="font-bold text-[#0d9488] text-2xl mt-3">{amount}</p>
      {dataUrl && (
        <a
          href={dataUrl}
          download="qris-pembayaran.png"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#0d9488]"
        >
          <MdDownload /> Simpan gambar QRIS
        </a>
      )}
    </div>
  );
}

function CodeInstructions({
  amount,
  vaNumber,
  methodName,
  methodType,
  onCopy,
}: Props & { vaNumber: string }) {
  const isRetail = methodType === "RETAIL";
  const label = isRetail ? "Kode Pembayaran" : "Nomor Virtual Account";

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
        {methodName ? `${label} ${methodName}` : label}
      </p>
      <div className="flex justify-between items-center gap-2 mb-3">
        <p className="font-bold text-[#111418] dark:text-white text-xl tracking-wider break-all">
          {vaNumber}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCopy(vaNumber, label)}
        >
          <MdContentCopy /> Salin
        </Button>
      </div>
      <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">
          Nominal yang harus dibayar (tepat):
        </p>
        <p className="font-bold text-[#0d9488] text-2xl">{amount}</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        {isRetail
          ? "Tunjukkan kode ini ke kasir Alfamart atau Indomaret."
          : "Bayar lewat m-banking, internet banking, atau ATM: pilih menu transfer ke Virtual Account, masukkan nomor di atas, lalu periksa nama dan nominalnya sebelum konfirmasi."}
      </p>
    </div>
  );
}
