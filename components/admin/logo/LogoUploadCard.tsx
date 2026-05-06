import { useRef } from "react";
import { HiPhoto, HiXMark } from "react-icons/hi2";
import Image from "next/image";

import type { LogoType } from "@/app/admin/pengaturan/logo/lib/constants";
import { LOGO_TYPE_CONFIG } from "@/app/admin/pengaturan/logo/lib/constants";

interface LogoUploadCardProps {
  type: LogoType;
  preview: string | null;
  saving: boolean;
  onFileSelect: (type: LogoType, file: File) => void;
  onRemove: (type: LogoType) => void;
}

/**
 * Reusable card component for logo upload/preview/delete.
 */
export function LogoUploadCard({
  type,
  preview,
  saving,
  onFileSelect,
  onRemove,
}: LogoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = LOGO_TYPE_CONFIG[type];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(type, file);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
          {config.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {config.description}
        </p>
      </div>

      <div className="flex items-start gap-6">
        {/* Preview */}
        <div className="flex-shrink-0">
          <div className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
            {preview ? (
              <div className="relative w-full h-full">
                <Image
                  src={preview}
                  alt={`${config.title} Preview`}
                  fill
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            ) : (
              <div className="text-center p-4">
                <HiPhoto className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {config.placeholder}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <HiPhoto className="w-4 h-4" />
              {preview ? "Ganti Logo" : "Upload Logo"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => onRemove(type)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <HiXMark className="w-4 h-4" />
                Hapus Logo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
