"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

const DEFAULT_THUMBNAIL_CLASS = "h-20 w-20 rounded-lg";

interface PhotoThumbnailGalleryProps {
  urls: string[];
  /** Apa yang difoto, untuk teks alternatif & label tombol. Mis. "lampiran izin". */
  subject: string;
  /** Ukuran & sudut thumbnail (kelas Tailwind). */
  thumbnailClassName?: string;
}

/**
 * Deretan thumbnail foto yang membuka pratinjau (lightbox) di halaman yang
 * sama, bukan tab baru. Bila dipakai di dalam modal, lightbox dirender di
 * dalam modal itu sehingga tampil di atasnya.
 */
export function PhotoThumbnailGallery({
  urls,
  subject,
  thumbnailClassName = DEFAULT_THUMBNAIL_CLASS,
}: PhotoThumbnailGalleryProps) {
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
            className={`relative overflow-hidden border border-gray-200 transition hover:ring-2 hover:ring-blue-500 dark:border-gray-700 ${thumbnailClassName}`}
            aria-label={`Lihat foto ${index + 1} ${subject}`}
          >
            <Image
              src={url}
              alt={`Foto ${index + 1} ${subject}`}
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
        alt={`Foto ${subject}`}
      />
    </>
  );
}
