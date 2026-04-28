"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  HiArrowPath,
  HiCheck,
  HiExclamationTriangle,
  HiXMark,
} from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";

type Router = {
  id: string;
  name: string;
  ipAddress: string;
  pingStatus: string;
};

type ReconfigureResult = {
  id: string;
  name: string;
  success: boolean;
  message?: string;
  error?: string;
  logs?: string[];
};

type ReconfigureModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ReconfigureModal({
  open,
  onClose,
  onSuccess,
}: ReconfigureModalProps) {
  const [routers, setRouters] = useState<Router[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [_processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ReconfigureResult[]>([]);
  const [step, setStep] = useState<"select" | "processing" | "result">(
    "select",
  );

  // Fetch routers when modal opens
  useEffect(() => {
    if (open) {
      fetchRouters();
      setStep("select");
      setResults([]);
      setProcessing(false);
    }
  }, [open]);

  const fetchRouters = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mikrotik-routers?limit=100"); // Fetch many
      const data = await res.json();
      if (res.ok) {
        setRouters(data.routers || []);
        // Default select all online routers
        const onlineIds = (data.routers || [])
          .filter((r: Router) => r.pingStatus === "online")
          .map((r: Router) => r.id);
        setSelectedIds(new Set(onlineIds));
      }
    } catch (_error) {
      clientLogger.error("Failed to fetch routers", _error);
      toast.error("Gagal memuat list router");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === routers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(routers.map((r) => r.id)));
    }
  };

  const handleReconfigure = async () => {
    if (selectedIds.size === 0) return;

    setProcessing(true);
    setStep("processing");

    try {
      const res = await fetch("/api/mikrotik-routers/reconfigure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routerIds: Array.from(selectedIds) }),
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);
        setStep("result");
        onSuccess(); // Refresh parent list
      } else {
        toast.error(data.error || "Terjadi kesalahan");
        setStep("select");
      }
    } catch (_error) {
      toast.error("Gagal menghubungi server");
      setStep("select");
    } finally {
      setProcessing(false);
    }
  };

  const renderSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Pilih router yang ingin dikonfigurasi ulang:
        </p>
        <Button onClick={handleSelectAll}>
          {selectedIds.size === routers.length ? "Unselect All" : "Select All"}
        </Button>
      </div>

      <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : routers.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Tidak ada router aktif
          </div>
        ) : (
          routers.map((router) => (
            <label
              key={router.id}
              className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(router.id)}
                onChange={() => handleToggle(router.id)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {router.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      router.pingStatus === "online"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {router.pingStatus}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {router.ipAddress}
                </span>
              </div>
            </label>
          ))
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex gap-2 text-yellow-700 dark:text-yellow-400 text-xs">
        <HiExclamationTriangle className="w-5 h-5 shrink-0" />
        <p>
          Proses ini akan mengirim ulang konfigurasi RADIUS, Firewall Filter, IP
          Pool, dan Profile PPP ke router yang dipilih. Koneksi user{" "}
          <strong>tidak akan terputus</strong>, namun router mungkin akan
          mengalami spike CPU sesaat.
        </p>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <HiArrowPath className="w-12 h-12 text-blue-500 animate-spin mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Sedang Memproses...
      </h3>
      <p className="text-sm text-gray-500 mt-2">
        Mohon tunggu, sedang mengirim konfigurasi ke router.
      </p>
    </div>
  );

  const renderResults = () => {
    const successCount = results.filter((r) => r.success).length;
    return (
      <div className="space-y-4">
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            successCount === results.length
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-orange-50 text-orange-700 border border-orange-200"
          }`}
        >
          {successCount === results.length ? (
            <HiCheck className="w-6 h-6" />
          ) : (
            <HiExclamationTriangle className="w-6 h-6" />
          )}
          <div>
            <p className="font-semibold">Proses Selesai</p>
            <p className="text-sm">
              Berhasil: {successCount}, Gagal: {results.length - successCount}
            </p>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y divide-gray-100">
          {results.map((res) => (
            <div key={res.id} className="p-3 flex items-start gap-3">
              {res.success ? (
                <HiCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <HiXMark className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{res.name}</p>
                {res.logs && res.logs.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                    {res.logs.map((log, i) => (
                      <div key={i}>{log}</div>
                    ))}
                  </div>
                )}
                {res.error && (
                  <p className="text-xs text-red-600 mt-1">{res.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={
        step === "result" ? "Hasil Reconfigurasi" : "Reconfigurasi Mikrotik"
      }
      size="lg"
    >
      <div className="p-6">
        {step === "select" && renderSelection()}
        {step === "processing" && renderProcessing()}
        {step === "result" && renderResults()}
      </div>

      <ModalFooter>
        {step === "select" && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button
              onClick={handleReconfigure}
              disabled={selectedIds.size === 0 || loading}
            >
              Proses ({selectedIds.size})
            </Button>
          </>
        )}
        {step === "processing" && (
          <Button variant="secondary" disabled>
            Memproses...
          </Button>
        )}
        {step === "result" && <Button onClick={onClose}>Tutup</Button>}
      </ModalFooter>
    </Modal>
  );
}
