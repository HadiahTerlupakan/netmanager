"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiOutlineChevronLeft } from "react-icons/hi2";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import CanvasingForm from "@/app/admin/marketing/canvasing/CanvasingForm";
import type { CanvasingFormValues } from "@/modules/marketing/validators/canvasingValidation";

export default function CanvasingCreateClient() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleSubmit(values: CanvasingFormValues) {
    setIsProcessing(true);

    try {
      await axios.post("/api/marketing/canvasing", values);
      toast.success("Canvasing berhasil ditambahkan");
      router.push("/admin/marketing/canvasing");
      router.refresh();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(
          error.response?.data?.error || "Gagal menambahkan canvasing",
        );
      } else {
        toast.error("Gagal menambahkan canvasing");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <HiOutlineChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tambah Canvasing Baru
          </h1>
          <p className="text-gray-500">
            Input data calon pelanggan baru secara manual
          </p>
        </div>
      </div>

      <CanvasingForm
        submitLabel="Simpan Data"
        processing={isProcessing}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
