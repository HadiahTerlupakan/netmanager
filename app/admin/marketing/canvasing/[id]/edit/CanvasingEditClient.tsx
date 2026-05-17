"use client";
import { clientLogger } from "@/lib/client-logger";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineChevronLeft } from "react-icons/hi2";
import axios from "axios";
import { toast } from "react-hot-toast";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import CanvasingForm from "@/app/admin/marketing/canvasing/CanvasingForm";
import type { CanvasingFormValues } from "@/modules/marketing/client";

export default function CanvasingEditClient({ id }: { id: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialValue, setInitialValue] = useState<CanvasingFormValues | null>(
    null,
  );
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  const loadCanvasingDetail = useCallback(async () => {
    setIsLoading(true);
    setLoadErrorMessage(null);

    try {
      const response = await axios.get(`/api/marketing/canvasing/${id}`);
      const data = response.data?.data || response.data;

      setInitialValue({
        nama: data.nama,
        noKtp: data.noKtp,
        noTelpon: data.noTelpon,
        email: data.email || "",
        alamat: data.alamat,
        kabel: data.kabel,
        odp: data.odp || "",
        paket: data.paket,
        sn: data.sn || "",
      });
    } catch (error) {
      clientLogger.error("Fetch detail error:", error);
      const errorMessage = getLoadErrorMessage(error);
      setLoadErrorMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Pattern E: fetchOnMount with hasFetched comparator (avoid setState-in-effect)
  const [hasFetchedFor, setHasFetchedFor] = useState<string | null>(null);
  if (hasFetchedFor !== id) {
    setHasFetchedFor(id);
    void loadCanvasingDetail();
  }

  async function handleSubmit(values: CanvasingFormValues) {
    setIsProcessing(true);

    try {
      await axios.put(`/api/marketing/canvasing/${id}`, values);
      toast.success("Data berhasil diperbarui");
      router.push("/admin/marketing/canvasing");
      router.refresh();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || "Gagal memperbarui data");
      } else {
        toast.error("Gagal memperbarui data");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (!initialValue) {
    return (
      <CanvasingEditErrorState
        message={loadErrorMessage ?? "Gagal memuat data canvasing"}
        onBack={() => router.push("/admin/marketing/canvasing")}
        onRetry={() => void loadCanvasingDetail()}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <HiOutlineChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Canvasing
          </h1>
          <p className="text-gray-500">
            Perbarui data canvasing calon pelanggan
          </p>
        </div>
      </div>

      <CanvasingForm
        initialValue={initialValue}
        submitLabel="Simpan Perubahan"
        processing={isProcessing}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}

function getLoadErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "Gagal memuat data canvasing";
  }

  return error.response?.data?.error || "Gagal memuat data canvasing";
}

type CanvasingEditErrorStateProps = {
  message: string;
  onBack: () => void;
  onRetry: () => void;
};

function CanvasingEditErrorState({
  message,
  onBack,
  onRetry,
}: CanvasingEditErrorStateProps) {
  return (
    <div className="p-6">
      <div className="max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <h1 className="text-2xl font-bold text-red-700 dark:text-red-300">
          Gagal memuat data canvasing
        </h1>
        <p className="mt-3 text-sm text-red-600 dark:text-red-200">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="ghost" onClick={onBack}>
            Kembali ke daftar
          </Button>
          <Button onClick={onRetry}>Coba lagi</Button>
        </div>
      </div>
    </div>
  );
}
