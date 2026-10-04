"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlinePlus } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import LegalDocumentFormModal from "./form/LegalDocumentFormModal";

/** Tombol "Tambah dokumen" yang membuka formulir lalu menuju detail dokumen baru. */
export default function AddLegalDocumentButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5"
      >
        <HiOutlinePlus className="h-4 w-4" />
        Tambah dokumen
      </Button>
      {isOpen && (
        <LegalDocumentFormModal
          mode="create"
          onClose={() => setIsOpen(false)}
          onSaved={(saved) => {
            setIsOpen(false);
            router.push(`/admin/legal/dokumen/${saved.id}`);
          }}
        />
      )}
    </>
  );
}
