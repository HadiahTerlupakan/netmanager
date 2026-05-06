"use client";

import { useState } from "react";
import { X, RefreshCw, Wifi } from "lucide-react";

interface WiFiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
  title: string;
  currentValue: string;
  parameter: string;
  isLoading: boolean;
}

export function WiFiModal({
  isOpen,
  onClose,
  onSave,
  title,
  currentValue,
  isLoading,
}: WiFiModalProps) {
  const [value, setValue] = useState(currentValue || "");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center">
            <Wifi className="w-5 h-5 mr-2 text-purple-500" /> {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Nilai Baru
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-colors"
                placeholder="Masukkan nilai baru..."
              />
            </div>
            <p className="text-xs text-gray-500">
              Perubahan ini akan dikirimkan langsung ke perangkat melalui
              protokol TR-069. Router mungkin akan mengalami disconnect sesaat.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(value)}
            disabled={isLoading || value === currentValue || !value}
            className="flex items-center px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white font-medium text-sm rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
