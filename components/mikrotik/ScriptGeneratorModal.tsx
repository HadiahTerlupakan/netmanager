"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { HiClipboard, HiClipboardDocumentCheck } from "react-icons/hi2";
import type { MikrotikRouterFormData } from "@/app/admin/network/mikrotik/components/mikrotikRouterForm";
import type { PppConnectionMode } from "@/app/admin/network/mikrotik/mikrotikFormShared";
import { buildRouterPrepScript } from "@/app/admin/network/mikrotik/routerPrepScript";

const COPIED_FEEDBACK_MS = 2000;

type ScriptGeneratorModalProps = {
  open: boolean;
  onClose: () => void;
  formData: Pick<
    MikrotikRouterFormData,
    "apiPort" | "apiUsername" | "apiPassword"
  >;
  pppConnectionMode: PppConnectionMode;
};

/** Script persiapan router publik yang dibuat dari isi form, siap ditempel. */
export default function ScriptGeneratorModal({
  open,
  onClose,
  formData,
  pppConnectionMode,
}: ScriptGeneratorModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const script = buildRouterPrepScript({
    apiPort: formData.apiPort,
    apiUsername: formData.apiUsername,
    apiPassword: formData.apiPassword,
    pppConnectionMode,
  });

  const handleCopy = () => {
    if (!script) return;
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="MikroTik Script Generator"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>
            Tempel script ini di Terminal MikroTik (Winbox → New Terminal)
            sebelum menekan Tes Koneksi. Script menyalakan service API di Port
            API dan membuat user API sesuai form; user yang sudah ada tidak
            diubah.
            {pppConnectionMode === "RADIUS" &&
              " Karena PPP memakai RADIUS, script juga menyalakan use-radius di /ppp aaa."}
          </p>
          <p>
            Entri RADIUS, CoA, firewall, dan halaman isolir tidak perlu
            ditempel: NetManager memasangnya otomatis saat router disimpan.
          </p>
        </div>

        {script ? (
          <div className="relative">
            <pre className="w-full p-4 pr-16 bg-gray-900 text-green-400 font-mono text-sm rounded-lg overflow-x-auto whitespace-pre-wrap">
              {script}
            </pre>
            <Button
              onClick={handleCopy}
              className="absolute top-2 right-2"
              title="Copy to Clipboard"
            >
              {copied ? (
                <HiClipboardDocumentCheck className="w-5 h-5 text-green-400" />
              ) : (
                <HiClipboard className="w-5 h-5" />
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Isi Username API dan Password API di form terlebih dahulu; script
            dibuat dari isian itu.
          </p>
        )}

        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
