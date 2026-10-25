"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { useApi } from "@/lib/hooks/useApi";

export const MAX_PAYMENTS = 10;

const PAGE_URL = "/api/admin/isolir-page";
const LOGO_URL = "/api/admin/isolir-page/logo";
const STATUS_URL = "/api/admin/isolir-page/status";
const STATUS_REFRESH_MS = 15_000;

export type IsolirPayment = { label: string; number: string; holder: string };

export type IsolirPageForm = {
  ispName: string;
  title: string;
  message: string;
  contactText: string;
  whatsappNumber: string;
  whatsappText: string;
  linkLabel: string;
  linkUrl: string;
  primaryColor: string;
  payments: IsolirPayment[];
};

export type IsolirTextField = Exclude<keyof IsolirPageForm, "payments">;

export type IsolirPreview = {
  html: string;
  hash: string;
  dropped: Array<"logo" | "message">;
};

export type IsolirRouterStatus = {
  id: string;
  name: string;
  synced: boolean;
  isolirPageSyncedAt: string | null;
  isolirPageError: string | null;
};

type StoredPage = Partial<Record<IsolirTextField, string | null>> & {
  logoUrl: string | null;
  payments: IsolirPayment[];
};

type PageView = { page: StoredPage | null; preview: IsolirPreview };

const EMPTY_FORM: IsolirPageForm = {
  ispName: "",
  title: "",
  message: "",
  contactText: "",
  whatsappNumber: "",
  whatsappText: "",
  linkLabel: "",
  linkUrl: "",
  primaryColor: "",
  payments: [],
};

function toForm(page: StoredPage | null): IsolirPageForm {
  if (!page) return EMPTY_FORM;
  const text = (field: IsolirTextField) => page[field] ?? "";
  return {
    ispName: text("ispName"),
    title: text("title"),
    message: text("message"),
    contactText: text("contactText"),
    whatsappNumber: text("whatsappNumber"),
    whatsappText: text("whatsappText"),
    linkLabel: text("linkLabel"),
    linkUrl: text("linkUrl"),
    primaryColor: text("primaryColor"),
    payments: page.payments ?? [],
  };
}

// Validasi server mengirim pesan per field di `details`; itu lebih berguna
// daripada "Validasi gagal" yang umum.
type ErrorBody = { error?: string; details?: Record<string, unknown> };

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body: ErrorBody | null = await res.json().catch((): null => null);
  const first = Object.values(body?.details ?? {}).find(
    (value): value is string => typeof value === "string",
  );
  return first ?? body?.error ?? fallback;
}

export function useIsolirPage() {
  const [form, setForm] = useState<IsolirPageForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const view = useApi<PageView>(PAGE_URL, {
    onError: (error) =>
      clientLogger.error("Gagal memuat halaman isolir", error),
  });
  // Pengiriman ke router berjalan di latar belakang setelah respons simpan,
  // jadi status dibaca berkala agar hasilnya muncul tanpa memuat ulang.
  const status = useApi<IsolirRouterStatus[]>(STATUS_URL, {
    refreshInterval: STATUS_REFRESH_MS,
  });

  // Form diisi sekali dari data awal: refetch sesudah unggah logo atau saat
  // jendela kembali fokus tidak boleh menimpa isian yang belum disimpan.
  const [didHydrate, setDidHydrate] = useState(false);
  if (view.data && !didHydrate) {
    setDidHydrate(true);
    setForm(toForm(view.data.page));
  }

  const setField = (field: IsolirTextField, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setPayments = (payments: IsolirPayment[]) =>
    setForm((prev) => ({ ...prev, payments }));

  const refreshStatus = () => status.mutate();

  const save = async () => {
    // PUT mengganti seluruh konfigurasi dan mengirimnya ke semua router;
    // menyimpan form kosong sebelum data awal termuat menghapus isian
    // tersimpan.
    if (!didHydrate) return;
    setSaving(true);
    try {
      const res = await fetch(PAGE_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, "Gagal menyimpan halaman isolir"));
        return;
      }
      const saved: PageView = (await res.json()).data;
      setForm(toForm(saved.page));
      await view.mutate(saved, { revalidate: false });
      toast.success("Halaman isolir disimpan");
      await refreshStatus();
    } catch (error) {
      clientLogger.error("Gagal menyimpan halaman isolir", error);
      toast.error("Terjadi kesalahan saat menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const sendLogo = async (init: RequestInit, success: string) => {
    setSaving(true);
    try {
      const res = await fetch(LOGO_URL, init);
      if (!res.ok) {
        toast.error(await errorMessage(res, "Gagal memperbarui logo"));
        return;
      }
      toast.success(success);
      await Promise.all([view.mutate(), refreshStatus()]);
    } catch (error) {
      clientLogger.error("Gagal memperbarui logo halaman isolir", error);
      toast.error("Terjadi kesalahan saat memperbarui logo");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return sendLogo({ method: "POST", body }, "Logo diunggah");
  };

  const removeLogo = () => sendLogo({ method: "DELETE" }, "Logo dihapus");

  return {
    form,
    setField,
    setPayments,
    loading: view.isLoading,
    loadError: view.error?.message ?? null,
    hydrated: didHydrate,
    retry: () => {
      void view.refetch();
    },
    saving,
    logoUrl: view.data?.page?.logoUrl ?? null,
    preview: view.data?.preview ?? null,
    routers: status.data ?? [],
    save,
    uploadLogo,
    removeLogo,
  };
}
