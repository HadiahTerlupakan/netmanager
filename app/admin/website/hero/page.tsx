"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  HiArrowPath,
  HiCheckCircle,
  HiExclamationCircle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { LogoUploader } from "@/components/admin/website/LogoUploader";

interface HeroForm {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaLink: string;
  logoUrl: string;
}

const EMPTY_FORM: HeroForm = {
  badge: "",
  title: "",
  highlight: "",
  subtitle: "",
  ctaPrimary: "",
  ctaSecondary: "",
  ctaLink: "",
  logoUrl: "",
};

export default function HeroPage() {
  const [form, setForm] = useState<HeroForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fetchedRef = useRef(false);

  const fetchHero = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/website/hero");
      if (!res.ok) throw new Error("Gagal memuat data hero");
      const json = await res.json();
      if (json.data) {
        setForm({
          badge: json.data.badge ?? "",
          title: json.data.title ?? "",
          highlight: json.data.highlight ?? "",
          subtitle: json.data.subtitle ?? "",
          ctaPrimary: json.data.ctaPrimary ?? "",
          ctaSecondary: json.data.ctaSecondary ?? "",
          ctaLink: json.data.ctaLink ?? "",
          logoUrl: json.data.logoUrl ?? "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchHero();
    }
  }, [fetchHero]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        ...form,
        badge: form.badge || null,
        highlight: form.highlight || null,
        logoUrl: form.logoUrl || null,
      };
      const res = await fetch("/api/admin/website/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Gagal menyimpan data");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <HiArrowPath className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Hero Section
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola konten bagian hero di halaman landing page.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-400 font-medium">
              Hero berhasil disimpan!
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5"
        >
          <LogoUploader
            label="Logo Navbar"
            hint="Logo berwarna untuk navbar di atas background terang. Jika kosong, ikon default ditampilkan."
            value={form.logoUrl}
            onChange={(url) => setForm((prev) => ({ ...prev, logoUrl: url }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Badge{" "}
              <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              name="badge"
              value={form.badge}
              onChange={handleChange}
              maxLength={100}
              placeholder="Contoh: Baru! v2.0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="Judul utama hero"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Highlight{" "}
              <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              name="highlight"
              value={form.highlight}
              onChange={handleChange}
              maxLength={100}
              placeholder="Kata yang di-highlight dalam judul"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subtitle <span className="text-red-500">*</span>
            </label>
            <textarea
              name="subtitle"
              value={form.subtitle}
              onChange={handleChange}
              required
              maxLength={500}
              rows={3}
              placeholder="Deskripsi singkat di bawah judul"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teks CTA Utama <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="ctaPrimary"
                value={form.ctaPrimary}
                onChange={handleChange}
                required
                maxLength={50}
                placeholder="Contoh: Mulai Gratis"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teks CTA Sekunder <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="ctaSecondary"
                value={form.ctaSecondary}
                onChange={handleChange}
                required
                maxLength={50}
                placeholder="Contoh: Lihat Demo"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Link CTA <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ctaLink"
              value={form.ctaLink}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="Contoh: /register"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
