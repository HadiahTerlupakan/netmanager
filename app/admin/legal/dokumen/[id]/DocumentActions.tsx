"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import LegalDocumentFormModal from "../../components/form/LegalDocumentFormModal";
import { CLOSED_STATUSES } from "../../components/legal-format";
import type { LegalDocumentDetail } from "../../components/legal-types";
import TerminateDocumentModal from "./TerminateDocumentModal";

/** Aksi Ubah/Perpanjang/Akhiri; disembunyikan bila dokumen sudah ditutup. */

type OpenDialog = "edit" | "renew" | "terminate" | null;

export default function DocumentActions({
  document,
  onChanged,
}: {
  document: LegalDocumentDetail;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const closeDialog = () => setOpenDialog(null);

  if (CLOSED_STATUSES.includes(document.status)) return null;

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setOpenDialog("edit")}>
        Ubah
      </Button>
      <Button variant="outline" onClick={() => setOpenDialog("renew")}>
        Perpanjang
      </Button>
      <Button variant="destructive" onClick={() => setOpenDialog("terminate")}>
        Akhiri
      </Button>

      {openDialog === "edit" && (
        <LegalDocumentFormModal
          mode="edit"
          document={document}
          onClose={closeDialog}
          onSaved={() => {
            closeDialog();
            onChanged();
          }}
        />
      )}
      {openDialog === "renew" && (
        <LegalDocumentFormModal
          mode="renew"
          document={document}
          onClose={closeDialog}
          onSaved={(renewed) => {
            closeDialog();
            router.push(`/admin/legal/dokumen/${renewed.id}`);
          }}
        />
      )}
      {openDialog === "terminate" && (
        <TerminateDocumentModal
          documentId={document.id}
          onClose={closeDialog}
          onTerminated={() => {
            closeDialog();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
