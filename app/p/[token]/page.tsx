import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { runAsSystemContext } from "@/lib/tenant-context";
import { EndorsementService, isValidTokenFormat } from "@/modules/endorsement";
import EndorsementSignClient from "./EndorsementSignClient";

/**
 * Halaman tanda tangan untuk pemegang short link.
 *
 * Tidak butuh sesi: penanda tangan pihak luar tidak punya akun, tokenlah bukti
 * kepemilikan tautan. Karena itu halaman ini dijalankan dalam konteks sistem —
 * tenant surat ditentukan oleh token, bukan oleh sesi pengunjung.
 *
 * `noindex` dipasang di metadata **dan** header respons; robots.txt saja tidak
 * cukup karena tautan yang terlanjur dibagikan tetap bisa terindeks lewat
 * backlink.
 */
export const metadata: Metadata = {
  title: "Surat Pengesahan",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function EndorsementSignPage({ params }: PageProps) {
  const { token } = await params;
  if (!isValidTokenFormat(token)) notFound();

  const headerStore = await headers();
  const context = {
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: headerStore.get("user-agent") ?? undefined,
  };

  const view = await runAsSystemContext(
    "endorsement: buka tautan tanda tangan",
    async () => {
      const service = new EndorsementService();
      try {
        return await service.markViewed(token, context);
      } catch {
        return null;
      }
    },
    { silent: true },
  );

  if (!view) notFound();

  const { endorsement, signer } = view;

  return (
    <EndorsementSignClient
      token={token}
      number={endorsement.number}
      title={endorsement.title}
      description={endorsement.description}
      status={endorsement.status}
      expiresAt={endorsement.expiresAt?.toISOString() ?? null}
      signerName={signer.name}
      signerRole={signer.role}
      signerStatus={signer.status}
      signedCount={
        endorsement.signers.filter((item) => item.status === "SIGNED").length
      }
      signerCount={endorsement.signers.length}
    />
  );
}
