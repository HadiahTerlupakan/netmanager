"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useRef } from "react";
import {
  HiOutlineSpeakerWave,
  HiOutlinePlay,
  HiOutlinePause,
  HiOutlineTrash,
  HiOutlineCloudArrowUp,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { RingtoneSettingsPayload } from "@/modules/settings";

function unwrapApiData<T>(payload: T | { data?: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: T }).data;
    if (nested !== undefined) {
      return nested;
    }
  }

  return payload as T;
}

export default function RingtoneSettingsClient() {
  const [enabled, setEnabled] = useState(true);
  const [soundType, setSoundType] = useState<"default" | "custom">("default");
  const [customSoundData, setCustomSoundData] = useState<string | null>(null);
  const [customSoundName, setCustomSoundName] = useState<string>("Custom Tone");
  const [serverHydrated, setServerHydrated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    // Initialize state from localStorage in useEffect to avoid hydration mismatch
    if (typeof window !== "undefined") {
      const storedEnabled = localStorage.getItem("chat_sound_enabled");
      const storedType = localStorage.getItem("chat_sound_type");
      const storedData = localStorage.getItem("chat_custom_sound_data");
      const storedName = localStorage.getItem("chat_custom_sound_name");

      // Use setTimeout to defer state updates and avoid synchronous setState in effect
      setTimeout(() => {
        if (storedEnabled !== null) setEnabled(storedEnabled === "true");
        if (storedType) setSoundType(storedType as "default" | "custom");
        if (storedData) setCustomSoundData(storedData);
        if (storedName) setCustomSoundName(storedName);
      }, 0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings/ringtone", {
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.text();
          clientLogger.error(
            "Failed to load ringtone settings:",
            response.status,
            body,
          );
          return;
        }

        const payload = unwrapApiData<RingtoneSettingsPayload>(
          await response.json(),
        );
        if (cancelled) return;

        setEnabled(payload.enabled);
        setSoundType(payload.soundType);
        setCustomSoundData(payload.customSoundData);
        setCustomSoundName(payload.customSoundName ?? "Custom Tone");
      } catch (error) {
        if (!cancelled) {
          clientLogger.error("Failed to load ringtone settings:", error);
        }
      } finally {
        if (!cancelled) {
          setServerHydrated(true);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem("chat_sound_enabled", String(enabled));
    localStorage.setItem("chat_sound_type", soundType);

    if (customSoundData) {
      localStorage.setItem("chat_custom_sound_data", customSoundData);
      localStorage.setItem("chat_custom_sound_name", customSoundName);
    } else {
      localStorage.removeItem("chat_custom_sound_data");
      localStorage.removeItem("chat_custom_sound_name");
    }
  }, [enabled, soundType, customSoundData, customSoundName]);

  useEffect(() => {
    if (!serverHydrated) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const normalizedCustomData =
      customSoundData && customSoundData.length > 0 ? customSoundData : null;
    const normalizedCustomName = normalizedCustomData
      ? customSoundName?.trim() || "Custom Tone"
      : null;

    const save = async () => {
      try {
        const response = await fetch("/api/settings/ringtone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            soundType,
            customSoundData: normalizedCustomData,
            customSoundName: normalizedCustomName,
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          clientLogger.error(
            "Failed to persist ringtone settings:",
            response.status,
            body,
          );
        }
      } catch (error) {
        clientLogger.error("Failed to persist ringtone settings:", error);
      }
    };

    saveTimeoutRef.current = window.setTimeout(() => {
      void save();
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [enabled, soundType, customSoundData, customSoundName, serverHydrated]);

  // Ensure audio cleanup

  const handleEnableToggle = () => {
    const newVal = !enabled;
    setEnabled(newVal);
  };

  const handleTypeChange = (type: "default" | "custom") => {
    setSoundType(type);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 500KB to respect LocalStorage limits and performance
    if (file.size > 500 * 1024) {
      alert("File terlalu besar. Maksimal 500KB.");
      return;
    }

    if (!file.type.startsWith("audio/")) {
      alert("Format file harus audio (mp3/wav).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setCustomSoundData(base64);
      setCustomSoundName(file.name);
      setSoundType("custom"); // Auto switch to custom
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCustom = () => {
    setCustomSoundData(null);
    setCustomSoundName("Custom Tone");
    if (soundType === "custom") {
      setSoundType("default");
    }
  };

  const playSound = async (src: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
    }

    try {
      let audioSrc = src;

      // Convert Data URI to Blob manually (fetch fails on large data URIs)
      if (src.startsWith("data:")) {
        try {
          const base64ToBlob = (dataURI: string) => {
            const split = dataURI.split(",");
            const data = split[1] || "";
            const byteString = atob(data);
            const mimeString =
              (split[0] ?? "").split(":")[1]?.split(";")[0] ??
              "application/octet-stream";
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            return new Blob([ab], { type: mimeString });
          };

          const blob = base64ToBlob(src);
          audioSrc = URL.createObjectURL(blob);
        } catch (e) {
          clientLogger.error("Blob conversion failed:", e);
        }
      }

      const audio = new Audio(audioSrc);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        if (src.startsWith("data:audio") && audioSrc !== src) {
          URL.revokeObjectURL(audioSrc); // Cleanup blob
        }
      };

      audio.onerror = (e) => {
        clientLogger.error("Audio play error", e);
        clientLogger.error("Audio Source Length:", src.length);

        let msg = "Gagal memutar audio.";
        if (audio.error) {
          switch (audio.error.code) {
            case 1:
              msg += " (Aborted)";
              break;
            case 2:
              msg += " (Network Error)";
              break;
            case 3:
              msg += " (Decode Error)";
              break;
            case 4:
              msg += " (Source Not Supported)";
              break;
            default:
              msg += ` (Code: ${audio.error.code})`;
          }
        }
        setIsPlaying(false);
        alert(`${msg}\nCek console untuk detail.`);
      };

      setIsPlaying(true);
      await audio.play();
    } catch (e: unknown) {
      clientLogger.error("Audio init/play catch:", e);
      setIsPlaying(false);
      alert(
        "Gagal memproses audio: " +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const handlePreview = () => {
    if (isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (soundType === "default") {
      playSound("/sounds/notification.mp3");
    } else {
      if (customSoundData) {
        playSound(customSoundData);
      } else {
        alert("Belum ada file custom yang diupload.");
      }
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
            <HiOutlineSpeakerWave className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Pengaturan Nada Dering
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Atur preferensi suara notifikasi chat Anda.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                Suara Notifikasi
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aktifkan efek suara saat ada pesan masuk
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={handleEnableToggle}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Sound Selection */}
          <div
            className={`space-y-4 ${!enabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Pilihan Nada
            </h3>

            {/* Default Option */}
            <button
              type="button"
              className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors text-left focus:outline-none ${soundType === "default" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`}
              onClick={() => handleTypeChange("default")}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  checked={soundType === "default"}
                  onChange={() => handleTypeChange("default")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="block font-medium text-gray-900 dark:text-white">
                    Default System
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Nada standar aplikasi (/sounds/notification.mp3)
                  </span>
                </div>
              </div>
            </button>

            {/* Custom Option */}
            <div
              className={`p-4 border rounded-lg transition-colors ${soundType === "custom" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700"}`}
            >
              <button
                type="button"
                className="flex items-center justify-between cursor-pointer mb-3 w-full text-left focus:outline-none"
                onClick={() => handleTypeChange("custom")}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={soundType === "custom"}
                    onChange={() => handleTypeChange("custom")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block font-medium text-gray-900 dark:text-white">
                      Custom Upload
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Gunakan file audio pilihan Anda
                    </span>
                  </div>
                </div>
              </button>

              {/* Upload Area - Show if custom selected */}
              {soundType === "custom" && (
                <div className="ml-7 mt-2 space-y-3">
                  {!customSoundData ? (
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors bg-white dark:bg-gray-800">
                      <HiOutlineCloudArrowUp className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Klik untuk upload file MP3/WAV
                      </p>
                      <p className="text-xs text-gray-500">Maks. 500KB</p>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-2xl">🎵</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                          {customSoundName}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustom();
                        }}
                        title="Hapus file"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview Button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={handlePreview}
              disabled={
                !enabled || (soundType === "custom" && !customSoundData)
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                isPlaying
                  ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {isPlaying ? (
                <HiOutlinePause className="w-5 h-5" />
              ) : (
                <HiOutlinePlay className="w-5 h-5" />
              )}
              {isPlaying ? "Stop Preview" : "Test Bunyi"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Pengaturan ini disimpan secara terpusat di server dan tetap
          dicadangkan di browser untuk respons cepat.
        </p>
      </div>
    </div>
  );
}
