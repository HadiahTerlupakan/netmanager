"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineScale } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import ArchiveToLegalModal from "./ArchiveToLegalModal";

/**
 * Hubungan surat dengan arsip Legal: asal dokumen legal, sudah diarsipkan,
 * atau tombol untuk mengarsipkan surat yang sudah sah. Tersembunyi bagi
 * pengguna tanpa izin Legal (API menolak, bagian ini tidak dirender).
 */

const LEGAL_SOURCE_TYPE = "LEGAL_DOCUMENT";
const BOX_CLASS =
  "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-200";
const LINK_CLASS = "font-medium text-indigo-700 hover:underline dark:text-indigo-300";

export default function LegalArchiveSection({
  endorsement,
}: {
  endorsement: { id: string; title: string; status: string; sourceType: string; sourceId: string | null };
}) {
  const isFromLegal = endorsement.sourceType === LEGAL_SOURCE_TYPE && Boolean(endorsement.sourceId);

  if (isFromLegal) {
    return (
      <div className={BOX_CLASS}>
        <span className="flex items-center gap-2">
          <HiOutlineScale className="h-5 w-5" />
          Surat ini berasal dari dokumen legal; setelah sah, dokumennya memakai PDF bertanda tangan.
        </span>
        <Link href={`/admin/legal/dokumen/${endorsement.sourceId}`} className={LINK_CLASS}>
          Lihat dokumen legal
        </Link>
      </div>
    );
  }

  if (endorsement.status !== "COMPLETED") return null;

  return <ArchiveStatus endorsementId={endorsement.id} title={endorsement.title} />;
}

function ArchiveStatus({ endorsementId, title }: { endorsementId: string; title: string }) {
  const [isArchiving, setIsArchiving] = useState(false);
  const { data, error, isLoading } = useApi<{ documentId: string | null }>(
    `/api/admin/legal/documents/by-endorsement/${endorsementId}`,
  );

  if (isLoading || error || !data) return null;

  return (
    <div className={BOX_CLASS}>
      <span className="flex items-center gap-2">
        <HiOutlineScale className="h-5 w-5" />
        {data.documentId
          ? "Surat ini sudah tersimpan di arsip Legal."
          : "Simpan surat yang sudah sah ini ke arsip Legal agar masa berlakunya terpantau."}
      </span>
      {data.documentId ? (
        <Link href={`/admin/legal/dokumen/${data.documentId}`} className={LINK_CLASS}>
          Lihat di arsip Legal
        </Link>
      ) : (
        <Button size="sm" onClick={() => setIsArchiving(true)}>
          Simpan ke arsip Legal
        </Button>
      )}
      {isArchiving && (
        <ArchiveToLegalModal
          endorsementId={endorsementId}
          defaultTitle={title}
          onClose={() => setIsArchiving(false)}
        />
      )}
    </div>
  );
}
