"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import SignerDraftCard, { EMPTY_SIGNER, type SignerDraft } from "./SignerDraftCard";
import SignerLinkCopy from "./SignerLinkCopy";

/**
 * Pembuatan surat pengesahan.
 *
 * Tautan tiap penanda tangan hanya dikembalikan pada respons pembuatan — token
 * tidak pernah tersimpan mentah — jadi hasilnya ditampilkan sekali di sini agar
 * admin bisa meneruskannya manual bila pengiriman otomatis gagal.
 */

interface DeliveryResult {
  signerId: string;
  channel: string;
  delivered: boolean;
  error?: string;
}

interface CreatedLink {
  signerId: string;
  name: string;
  url: string;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function EndorsementCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<SignerDraft[]>([{ ...EMPTY_SIGNER }]);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{
    deliveries: DeliveryResult[];
    links: CreatedLink[];
  } | null>(null);

  const replaceSigner = (index: number, next: SignerDraft) => {
    setSigners((current) =>
      current.map((signer, position) => (position === index ? next : signer)),
    );
  };
  const selectedUserIds = signers
    .map((signer) => signer.userId)
    .filter((userId): userId is string => Boolean(userId));

  const submit = async () => {
    if (!file) {
      toast.error("Pilih berkas PDF yang akan disahkan");
      return;
    }

    const cleanedSigners = signers
      .map((signer) => ({
        userId: signer.userId,
        name: signer.name.trim(),
        role: signer.role.trim() || undefined,
        email: signer.email.trim() || undefined,
        phone: signer.phone.trim() || undefined,
      }))
      .filter((signer) => signer.name.length > 0);

    if (cleanedSigners.length === 0) {
      toast.error("Tambahkan minimal satu penanda tangan");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "payload",
      JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        sourceType: "UPLOAD",
        signers: cleanedSigners,
      }),
    );

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/endorsements", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        data?: { deliveries: DeliveryResult[]; links: CreatedLink[] };
      };

      if (!response.ok || !payload.data) {
        toast.error(payload.error || "Gagal membuat surat pengesahan");
        return;
      }

      toast.success("Surat pengesahan dibuat dan tautan dikirim");
      setResult(payload.data);
    } catch (error) {
      clientLogger.error("[Pengesahan] gagal membuat surat:", error);
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setIsSaving(false);
    }
  };

  if (result) {
    return (
      <Modal isOpen onClose={onCreated} title="Surat pengesahan dibuat">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tautan di bawah hanya ditampilkan sekali. Salin bila ada penerima
            yang perlu dikirimi manual; tautan yang hilang bisa diterbitkan
            ulang dari halaman detail surat.
          </p>
          <ul className="space-y-3">
            {result.links.map((link) => {
              const delivery = result.deliveries.find(
                (item) => item.signerId === link.signerId,
              );

              return (
                <li
                  key={link.signerId}
                  className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <p className="font-medium text-gray-900 dark:text-white">
                    {link.name}
                  </p>
                  {delivery?.channel === "app" && delivery.delivered ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Notifikasi terkirim ke aplikasi mobile — tanda tangan di aplikasi
                    </p>
                  ) : (
                    <>
                      <SignerLinkCopy url={link.url} />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {delivery?.delivered
                          ? `Terkirim lewat ${delivery.channel}`
                          : (delivery?.error ??
                            "Belum terkirim otomatis — bagikan tautan manual")}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <ModalFooter>
          <Button onClick={onCreated}>Selesai</Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="Buat surat pengesahan">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Judul surat
          </label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={INPUT_CLASS}
            placeholder="Berita Acara Serah Terima Pekerjaan"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Keterangan (opsional)
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Berkas PDF
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Penanda tangan
          </p>
          {signers.map((signer, index) => (
            <SignerDraftCard
              key={index}
              signer={signer}
              excludedUserIds={selectedUserIds}
              isRemovable={signers.length > 1}
              onChange={(next) => replaceSigner(index, next)}
              onRemove={() =>
                setSigners((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
            />
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              setSigners((current) => [...current, { ...EMPTY_SIGNER }])
            }
          >
            Tambah penanda tangan
          </Button>
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button onClick={submit} disabled={isSaving}>
          {isSaving ? "Menyimpan..." : "Buat & kirim tautan"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
