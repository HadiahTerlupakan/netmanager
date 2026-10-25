"use client";

import type { ChangeEvent, ReactNode } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { IsolirPreviewPanel, IsolirSyncStatusTable } from "./IsolirPanels";
import {
  MAX_PAYMENTS,
  useIsolirPage,
  type IsolirPayment,
  type IsolirTextField,
} from "./useIsolirPage";

const INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60";
const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
const CARD_CLASS =
  "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5";
const EMPTY_PAYMENT: IsolirPayment = { label: "", number: "", holder: "" };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={CARD_CLASS}>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h3>
      {hint && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ClientComponent() {
  const page = useIsolirPage();
  const { hasPermission } = usePermission();
  const canUpdate = hasPermission("isolir_page:update");

  if (page.loading) return <PageLoader />;

  const text = (
    field: IsolirTextField,
    label: string,
    maxLength: number,
    placeholder?: string,
  ) => (
    <div>
      <label htmlFor={`isolir-${field}`} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={`isolir-${field}`}
        type="text"
        value={page.form[field]}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => page.setField(field, event.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );

  const textArea = (
    field: IsolirTextField,
    label: string,
    maxLength: number,
    placeholder?: string,
  ) => (
    <div>
      <label htmlFor={`isolir-${field}`} className={LABEL_CLASS}>
        {label}
      </label>
      <textarea
        id={`isolir-${field}`}
        rows={4}
        value={page.form[field]}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => page.setField(field, event.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );

  const payments = page.form.payments;
  const updatePayment = (
    index: number,
    key: keyof IsolirPayment,
    value: string,
  ) =>
    page.setPayments(
      payments.map((payment, i) =>
        i === index ? { ...payment, [key]: value } : payment,
      ),
    );

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void page.uploadLogo(file);
  };

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Halaman Isolir
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Halaman yang dilihat pelanggan saat layanannya diisolir. Kolom yang
          dikosongkan memakai isi bawaan.
        </p>
      </div>

      {page.loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm text-red-600 dark:text-red-400"
        >
          <span>{page.loadError}</span>
          <Button type="button" variant="outline" onClick={page.retry}>
            Coba lagi
          </Button>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void page.save();
        }}
      >
        {/* Sebelum data awal termuat form masih berisi nilai kosong; Simpan
            saat itu akan menimpa seluruh konfigurasi tersimpan. */}
        <fieldset
          disabled={!canUpdate || !page.hydrated || page.saving}
          className="space-y-5"
        >
          <Section title="Identitas">
            {text("ispName", "Nama ISP", 120, "Nama tenant")}
            {text(
              "title",
              "Judul",
              120,
              "Layanan Internet Anda Sedang Diisolir",
            )}
            {text("primaryColor", "Warna utama", 7, "#RRGGBB")}
          </Section>

          <Section
            title="Logo"
            hint="Bila tidak diunggah, memakai logo dari Pengaturan → Logo. Logo tampil di pratinjau."
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Unggah logo halaman isolir"
                onChange={handleLogoChange}
                className="text-sm text-gray-700 dark:text-gray-300"
              />
              {page.logoUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void page.removeLogo()}
                >
                  Hapus logo
                </Button>
              )}
            </div>
          </Section>

          <Section title="Pesan">
            {textArea(
              "message",
              "Pesan",
              2000,
              "Layanan internet Anda dihentikan sementara. Silakan lakukan pembayaran atau hubungi layanan pelanggan kami agar layanan aktif kembali.",
            )}
          </Section>

          <Section
            title="Info pembayaran"
            hint="Kosongkan untuk memakai rekening aktif dari Pengaturan → Rekening Perusahaan."
          >
            {payments.map((payment, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
              >
                <input
                  aria-label={`Bank/e-wallet ${index + 1}`}
                  placeholder="Bank/e-wallet"
                  value={payment.label}
                  maxLength={60}
                  onChange={(e) =>
                    updatePayment(index, "label", e.target.value)
                  }
                  className={INPUT_CLASS}
                />
                <input
                  aria-label={`Nomor ${index + 1}`}
                  placeholder="Nomor"
                  value={payment.number}
                  maxLength={60}
                  onChange={(e) =>
                    updatePayment(index, "number", e.target.value)
                  }
                  className={INPUT_CLASS}
                />
                <input
                  aria-label={`Atas nama ${index + 1}`}
                  placeholder="Atas nama"
                  value={payment.holder}
                  maxLength={100}
                  onChange={(e) =>
                    updatePayment(index, "holder", e.target.value)
                  }
                  className={INPUT_CLASS}
                />
                <Button
                  type="button"
                  variant="destructive"
                  aria-label={`Hapus rekening ${index + 1}`}
                  onClick={() =>
                    page.setPayments(payments.filter((_, i) => i !== index))
                  }
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={payments.length >= MAX_PAYMENTS}
              onClick={() => page.setPayments([...payments, EMPTY_PAYMENT])}
            >
              <HiOutlinePlus className="w-4 h-4" />
              Tambah rekening
            </Button>
          </Section>

          <Section title="WhatsApp CS" hint="Tidak ditampilkan bila kosong.">
            {text("whatsappNumber", "Nomor WhatsApp", 20, "08xxxxxxxxxx")}
            {text("whatsappText", "Teks pesan awal", 300)}
          </Section>

          <Section
            title="Link pembayaran / portal pelanggan"
            hint="Tidak ditampilkan bila kosong."
          >
            {text("linkLabel", "Label", 60)}
            {text("linkUrl", "URL", 500, "https://")}
          </Section>

          <Section
            title="Kontak tambahan"
            hint="Tidak ditampilkan bila kosong."
          >
            {textArea("contactText", "Kontak dan jam operasional", 500)}
          </Section>

          {canUpdate && (
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={!page.hydrated || page.saving}
              >
                {page.saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          )}
        </fieldset>
      </form>

      {page.preview && <IsolirPreviewPanel preview={page.preview} />}
      <IsolirSyncStatusTable routers={page.routers} />
    </div>
  );
}
