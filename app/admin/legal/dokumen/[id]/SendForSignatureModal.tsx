"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import SignerDraftCard, {
  EMPTY_SIGNER,
  type SignerDraft,
} from "../../../pengesahan/SignerDraftCard";
import SignerLinkCopy from "../../../pengesahan/SignerLinkCopy";
import { FormField, INPUT_CLASS } from "../../components/form/form-fields";
import { jsonRequest, sendLegalRequest } from "../../components/legal-request";
import type { LegalDocumentDetail } from "../../components/legal-types";

/**
 * Kirim berkas dokumen legal untuk ditandatangani. Setelah semua pihak tanda
 * tangan, dokumen legal ini otomatis memakai PDF final yang sudah sah.
 */

interface IssueResponse {
  endorsement: { id: string; number: string };
  deliveries: Array<{ signerId: string; channel: string; delivered: boolean; error?: string }>;
  links: Array<{ signerId: string; name: string; url: string }>;
}

function toSignerPayload(signer: SignerDraft) {
  return {
    userId: signer.userId,
    name: signer.name.trim(),
    role: signer.role.trim() || undefined,
    email: signer.email.trim() || undefined,
    phone: signer.phone.trim() || undefined,
  };
}

export default function SendForSignatureModal({
  document,
  onClose,
  onSent,
}: {
  document: LegalDocumentDetail;
  onClose: () => void;
  onSent: () => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [signers, setSigners] = useState<SignerDraft[]>([{ ...EMPTY_SIGNER }]);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<IssueResponse | null>(null);
  const selectedUserIds = signers
    .map((signer) => signer.userId)
    .filter((userId): userId is string => Boolean(userId));

  const replaceSigner = (index: number, next: SignerDraft) =>
    setSigners((current) => current.map((signer, position) => (position === index ? next : signer)));

  const submit = async () => {
    const filled = signers.filter((signer) => signer.name.trim()).map(toSignerPayload);
    if (filled.length === 0) {
      toast.error("Tambahkan minimal satu penanda tangan");
      return;
    }

    setIsSending(true);
    const response = await sendLegalRequest<IssueResponse>(
      `/api/admin/legal/documents/${document.id}/send-for-signature`,
      jsonRequest("POST", { title: title.trim(), signers: filled }),
      "Gagal mengirim untuk ditandatangani",
    );
    setIsSending(false);
    if (!response) return;

    toast.success(`Surat ${response.endorsement.number} dikirim`);
    setResult(response);
  };

  if (result) {
    return (
      <Modal isOpen onClose={onSent} title="Dikirim untuk ditandatangani">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Surat <strong>{result.endorsement.number}</strong> dibuat. Setelah semua
            pihak menandatangani, dokumen legal ini otomatis memakai PDF yang sudah sah.
          </p>
          <ul className="space-y-3">
            {result.links.map((link) => {
              const delivery = result.deliveries.find((item) => item.signerId === link.signerId);
              const isApp = delivery?.channel === "app" && delivery.delivered;

              return (
                <li key={link.signerId} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white">{link.name}</p>
                  {isApp ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Notifikasi terkirim ke aplikasi mobile
                    </p>
                  ) : (
                    <>
                      <SignerLinkCopy url={link.url} />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {delivery?.delivered
                          ? `Terkirim lewat ${delivery.channel}`
                          : (delivery?.error ?? "Belum terkirim otomatis — bagikan tautan manual")}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <ModalFooter>
          <Button onClick={onSent}>Selesai</Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Kirim untuk ditandatangani">
      <div className="space-y-4">
        <FormField label="Judul surat" hint={`Berkas: ${document.fileName}`}>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Penanda tangan</p>
          {signers.map((signer, index) => (
            <SignerDraftCard
              key={index}
              signer={signer}
              excludedUserIds={selectedUserIds}
              isRemovable={signers.length > 1}
              onChange={(next) => replaceSigner(index, next)}
              onRemove={() =>
                setSigners((current) => current.filter((_, position) => position !== index))
              }
            />
          ))}
          <Button
            variant="ghost"
            onClick={() => setSigners((current) => [...current, { ...EMPTY_SIGNER }])}
          >
            Tambah penanda tangan
          </Button>
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={isSending}>
          {isSending ? "Mengirim..." : "Kirim untuk ditandatangani"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
