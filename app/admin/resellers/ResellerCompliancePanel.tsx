"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PksStatusBadge } from "./ResellerComplianceBadges";
import type { Reseller } from "./types";
import { RESELLER_STATUS_LABELS } from "./types";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-1.5 text-sm last:border-0 dark:border-gray-700">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}

const LINK_CLASS = "text-blue-600 underline dark:text-blue-400";

/**
 * Detail kepatuhan reseller: data izin (Ps 223(2)a), PKS di modul Legal
 * (Ps 223(2)b), dan status kemitraan beserta alasannya.
 */
export function ResellerCompliancePanel({
  reseller,
}: {
  readonly reseller: Reseller;
}) {
  const compliance = reseller.compliance;
  const pksDocumentId = compliance?.pks.documentId;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Kepatuhan & kemitraan
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pelanggan reseller ditagih atas merek dan harga paket ISP; reseller
          menerima komisi.
        </p>
      </div>
      {compliance && !compliance.isCompliant && (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
        >
          Belum patuh: {compliance.issueLabels.join("; ")}.
        </div>
      )}
      <dl>
        <DetailRow
          label="Status kemitraan"
          value={RESELLER_STATUS_LABELS[reseller.status]}
        />
        {reseller.statusReason && (
          <DetailRow label="Alasan status" value={reseller.statusReason} />
        )}
        <DetailRow
          label="Status diubah"
          value={formatDate(reseller.statusChangedAt)}
        />
        <DetailRow label="Badan usaha" value={reseller.legalName || "-"} />
        <DetailRow label="NIB" value={reseller.nib || "-"} />
        <DetailRow label="KBLI" value={reseller.kbliCode || "-"} />
        <DetailRow
          label="Sertifikat Standar"
          value={reseller.standardCertificateNumber || "-"}
        />
        <DetailRow
          label="Izin diverifikasi"
          value={formatDate(reseller.licenseVerifiedAt)}
        />
        <DetailRow label="Merek tambahan" value={reseller.brandName || "-"} />
        <DetailRow label="PKS" value={<PksStatusBadge reseller={reseller} />} />
        <DetailRow
          label="PKS berakhir"
          value={
            compliance?.pks.endDate ? formatDate(compliance.pks.endDate) : "-"
          }
        />
      </dl>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {pksDocumentId ? (
          <Link
            href={`/admin/legal/dokumen/${pksDocumentId}`}
            className={LINK_CLASS}
          >
            Buka dokumen PKS
          </Link>
        ) : (
          <>
            PKS dibaca dari modul Legal: dokumen jenis Kontrak dengan pihak
            Reseller ini.{" "}
            <Link href="/admin/legal/dokumen" className={LINK_CLASS}>
              Kelola dokumen legal
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
