"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

interface LeaveAttachmentGalleryProps {
  urls: string[];
}

/**
 * Thumbnail lampiran izin yang membuka pratinjau di halaman yang sama,
 * bukan tab baru. Lightbox dirender di dalam modal pemanggil agar tampil
 * di atasnya.
 */
export function LeaveAttachmentGallery({ urls }: LeaveAttachmentGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500 transition"
            aria-label={`Lihat lampiran ${index + 1}`}
          >
            <Image
              src={url}
              alt={`Lampiran ${index + 1}`}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>
      <ImageLightbox
        images={urls}
        initialIndex={openIndex ?? 0}
        isOpen={openIndex !== null}
        onClose={() => setOpenIndex(null)}
        alt="Lampiran izin"
      />
    </>
  );
}
