"use client";

import { clientLogger } from "@/lib/client-logger";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MdArrowBack,
  MdPerson,
  MdEmail,
  MdPhone,
  MdLocationOn,
  MdWifi,
  MdNote,
  MdCheckCircle,
  MdMap,
} from "react-icons/md";
import SearchableDropdown from "@/components/common/SearchableDropdown";
import { Button } from "@/components/ui/Button";

// Extend window interface for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          [key: string]: unknown;
        },
      ) => string;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export default function RegistrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    location: "",
    packageName: "",
    notes: "",
  });
  const [existingLocations, setExistingLocations] = useState<string[]>([]);

  // Captcha State
  const [captchaEnabled, setCaptchaEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/odcs/locations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setExistingLocations(data);
      }
    } catch (_e) {
      clientLogger.error("Failed to fetch locations", _e);
    }
  }, []);

  const loadTurnstileScript = useCallback(() => {
    if (document.getElementById("turnstile-script")) return;

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
    script.id = "turnstile-script";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    window.onloadTurnstileCallback = () => {
      if (window.turnstile && turnstileContainerRef.current) {
        window.turnstile.render(turnstileContainerRef.current, {
          sitekey: siteKey,
        });
      }
    };
  }, [siteKey]);

  const fetchCaptchaSettingsLocal = useCallback(async () => {
    try {
      // Use public endpoint (no auth required)
      const res = await fetch("/api/public/captcha-settings");
      if (res.ok) {
        const data = await res.json();
        if (data.enabled && data.siteKey) {
          setCaptchaEnabled(true);
          setSiteKey(data.siteKey);
          loadTurnstileScript();
        }
      }
    } catch (_e) {
      clientLogger.error("Failed to fetch captcha settings", _e);
    }
  }, [loadTurnstileScript]);

  useEffect(() => {
    const init = async () => {
      await fetchLocations();
      await fetchCaptchaSettingsLocal();
    };
    init();
  }, [fetchLocations, fetchCaptchaSettingsLocal]);

  // Effect to render turnstile when siteKey is available and script is loaded
  useEffect(() => {
    if (
      captchaEnabled &&
      siteKey &&
      window.turnstile &&
      turnstileContainerRef.current
    ) {
      // Clear previous if any? Turnstile handles it usually.
      try {
        window.turnstile.render(turnstileContainerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
        });
      } catch (_e) {
        // Ignore if already rendered
      }
    }

    // Also define callback if script loads LATER
    window.onloadTurnstileCallback = () => {
      if (window.turnstile && turnstileContainerRef.current && siteKey) {
        window.turnstile.render(turnstileContainerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
        });
      }
    };
  }, [captchaEnabled, siteKey]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (captchaEnabled && !turnstileToken) {
      alert("Mohon selesaikan verifikasi keamanan (Captcha).");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        alert(data.error || "Terjadi kesalahan. Silakan coba lagi.");
      }
    } catch (_error) {
      clientLogger.error("Gagal mengirim registrasi pelanggan", _error);
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#101922] flex items-center justify-center p-6 font-sans">
        <div className="bg-white dark:bg-[#1c2936] rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
            <MdCheckCircle />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Terima kasih telah mendaftar. Tim kami akan segera menghubungi Anda
            melalui WhatsApp/Email untuk verifikasi data dan jadwal survei
            lokasi.
          </p>
          <Link href="/">
            <Button size="lg" className="w-full">
              Kembali ke Beranda
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#101922] font-sans text-slate-900 dark:text-white pb-20">
      <div className="max-w-md mx-auto min-h-screen bg-white dark:bg-[#101922] shadow-2xl relative">
        {/* Header */}
        <header className="bg-white dark:bg-[#101922] p-6 sticky top-0 z-20 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <Link
            href="/"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <MdArrowBack className="text-xl" />
          </Link>
          <h1 className="font-bold text-lg">Formulir Pendaftaran Baru</h1>
        </header>

        <main className="p-6">
          <div className="mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-xl text-sm leading-relaxed border border-blue-100 dark:border-blue-800/50">
              <span className="font-bold block mb-1">
                📝 Informasi Pendaftaran
              </span>
              Silakan lengkapi data diri Anda di bawah ini. Pastikan nomor
              WhatsApp aktif untuk kemudahan komunikasi.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <MdPerson className="text-lg" />
                </div>
                <input
                  type="text"
                  name="name"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="Masukkan nama lengkap"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <MdEmail className="text-lg" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="contoh@email.com"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Nomor WhatsApp
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <MdPhone className="text-lg" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                  placeholder="08xxxxxxxxxx"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Area / Lokasi (Opsional)
              </label>
              <div className="relative">
                <div className="absolute top-3.5 left-0 pl-4 flex items-start pointer-events-none text-slate-400 z-10">
                  <MdMap className="text-lg" />
                </div>
                <div className="pl-11">
                  <SearchableDropdown
                    value={formData.location}
                    onChange={(val) =>
                      setFormData({ ...formData, location: val })
                    }
                    options={existingLocations}
                    placeholder="Pilih atau ketik area..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Alamat Pemasangan
              </label>
              <div className="relative">
                <div className="absolute top-3.5 left-0 pl-4 flex items-start pointer-events-none text-slate-400">
                  <MdLocationOn className="text-lg" />
                </div>
                <textarea
                  name="address"
                  required
                  rows={3}
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium resize-none"
                  placeholder="Nama jalan, nomor rumah, RT/RW, Kelurahan, Kecamatan"
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Paket Diminati
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <MdWifi className="text-lg" />
                </div>
                <select
                  name="packageName"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium appearance-none"
                  onChange={handleChange}
                >
                  <option value="">Pilih Paket Internet</option>
                  <option value="Home 10 Mbps">Home 10 Mbps</option>
                  <option value="Home 20 Mbps">Home 20 Mbps</option>
                  <option value="Home 50 Mbps">Home 50 Mbps</option>
                  <option value="Home 100 Mbps">Home 100 Mbps</option>
                  <option value="Business 50 Mbps">Business 50 Mbps</option>
                  <option value="Business 100 Mbps">Business 100 Mbps</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Catatan Tambahan (Opsional)
              </label>
              <div className="relative">
                <div className="absolute top-3.5 left-0 pl-4 flex items-start pointer-events-none text-slate-400">
                  <MdNote className="text-lg" />
                </div>
                <textarea
                  name="notes"
                  rows={2}
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#1c2936] border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium resize-none"
                  placeholder="Patokan lokasi, atau ketersediaan waktu survei"
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Captcha Widget */}
            {captchaEnabled && (
              <div
                className="flex justify-center py-2"
                id="turnstile-container"
                ref={turnstileContainerRef}
              >
                {/* Captcha will be rendered here */}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              loading={isLoading}
              size="lg"
              className="w-full mt-8"
            >
              Kirim Pendaftaran
            </Button>
          </form>
        </main>
      </div>
    </div>
  );
}
