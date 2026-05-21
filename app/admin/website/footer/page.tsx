"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  HiArrowPath,
  HiCheckCircle,
  HiExclamationCircle,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterLinks {
  [section: string]: FooterLink[];
}

interface FooterForm {
  companyName: string;
  description: string;
  address: string;
  email: string;
  phone: string;
  links: FooterLinks;
  socials: Record<string, string>;
}

const EMPTY_FORM: FooterForm = {
  companyName: "",
  description: "",
  address: "",
  email: "",
  phone: "",
  links: {
    produk: [],
    perusahaan: [],
    akun: [],
  },
  socials: {},
};

const DEFAULT_SECTIONS = ["produk", "perusahaan", "akun"];

export default function FooterPage() {
  const [form, setForm] = useState<FooterForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fetchedRef = useRef(false);

  const fetchFooter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/website/footer");
      if (!res.ok) throw new Error("Gagal memuat data footer");
      const json = await res.json();
      if (json.data) {
        const d = json.data;
        // Ensure default sections exist
        const links: FooterLinks = { ...EMPTY_FORM.links, ...(d.links ?? {}) };
        for (const s of DEFAULT_SECTIONS) {
          if (!links[s]) links[s] = [];
        }
        setForm({
          companyName: d.companyName ?? "",
          description: d.description ?? "",
          address: d.address ?? "",
          email: d.email ?? "",
          phone: d.phone ?? "",
          links,
          socials: d.socials ?? {},
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
      fetchFooter();
    }
  }, [fetchFooter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        companyName: form.companyName,
        description: form.description || null,
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
        links: form.links,
        socials: Object.keys(form.socials).length > 0 ? form.socials : null,
      };
      const res = await fetch("/api/admin/website/footer", {
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

  function handleField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleLinkChange(
    section: string,
    index: number,
    field: "label" | "href",
    value: string,
  ) {
    setForm((prev) => {
      const updated = [...(prev.links[section] ?? [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, links: { ...prev.links, [section]: updated } };
    });
  }

  function addLink(section: string) {
    setForm((prev) => ({
      ...prev,
      links: {
        ...prev.links,
        [section]: [...(prev.links[section] ?? []), { label: "", href: "" }],
      },
    }));
  }

  function removeLink(section: string, index: number) {
    setForm((prev) => {
      const updated = [...(prev.links[section] ?? [])];
      updated.splice(index, 1);
      return { ...prev, links: { ...prev.links, [section]: updated } };
    });
  }

  function handleSocialChange(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      socials: { ...prev.socials, [key]: value },
    }));
  }

  function addSocial() {
    setForm((prev) => ({
      ...prev,
      socials: { ...prev.socials, "": "" },
    }));
  }

  function removeSocial(key: string) {
    setForm((prev) => {
      const updated = { ...prev.socials };
      delete updated[key];
      return { ...prev, socials: updated };
    });
  }

  function renameSocialKey(oldKey: string, newKey: string) {
    setForm((prev) => {
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev.socials)) {
        updated[k === oldKey ? newKey : k] = v;
      }
      return { ...prev, socials: updated };
    });
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Footer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola konten footer di halaman landing page.
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
              Footer berhasil disimpan!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Perusahaan */}
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Info Perusahaan
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Perusahaan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="companyName"
                value={form.companyName}
                onChange={handleField}
                required
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deskripsi
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleField}
                maxLength={300}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alamat
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleField}
                maxLength={300}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleField}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telepon
                </label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleField}
                  maxLength={20}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </section>

          {/* Links per section */}
          {DEFAULT_SECTIONS.map((section) => (
            <section
              key={section}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white capitalize">
                  Links — {section}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addLink(section)}
                >
                  <HiPlus className="w-4 h-4" />
                  Tambah
                </Button>
              </div>

              {(form.links[section] ?? []).length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Belum ada link.
                </p>
              )}

              {(form.links[section] ?? []).map((link, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) =>
                      handleLinkChange(section, idx, "label", e.target.value)
                    }
                    placeholder="Label"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={link.href}
                    onChange={(e) =>
                      handleLinkChange(section, idx, "href", e.target.value)
                    }
                    placeholder="URL / path"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(section, idx)}
                    className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>
          ))}

          {/* Socials */}
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Media Sosial
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSocial}
              >
                <HiPlus className="w-4 h-4" />
                Tambah
              </Button>
            </div>

            {Object.keys(form.socials).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Belum ada media sosial.
              </p>
            )}

            {Object.entries(form.socials).map(([key, value]) => (
              <div key={key} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => renameSocialKey(key, e.target.value)}
                  placeholder="Platform (contoh: twitter)"
                  className="w-36 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleSocialChange(key, e.target.value)}
                  placeholder="URL"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => removeSocial(key)}
                  className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            ))}
          </section>

          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
