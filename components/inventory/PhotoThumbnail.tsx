"use client";

import { useState } from "react";
import Image from "next/image";
import { HiEye, HiTrash, HiPhoto } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

interface Photo {
  id: string;
  url: string;
  name?: string;
  size?: number;
  uploadedAt?: string;
}

interface PhotoThumbnailProps {
  photo: Photo;
  onDelete?: ((photoId: string) => void) | undefined;
  showDeleteButton?: boolean | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
  onClick?: ((photo: Photo) => void) | undefined;
  disabled?: boolean | undefined;
}

export function PhotoThumbnail({
  photo,
  onDelete,
  showDeleteButton = true,
  size = "md",
  className = "",
  onClick,
  disabled = false,
}: PhotoThumbnailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (disabled || isDeleting) return;

    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 2000);
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete?.(photo.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClick = () => {
    if (!disabled && !isDeleting) {
      onClick?.(photo);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Photo Container */}
      <div
        className={`
          ${sizeClasses[size]}
          relative rounded-lg overflow-hidden border-2
          border-gray-200 dark:border-gray-600
          bg-gray-100 dark:bg-gray-700
          cursor-pointer transition-all duration-200
          hover:border-blue-400 dark:hover:border-blue-500
          hover:shadow-lg
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isDeleting ? "animate-pulse" : ""}
        `}
        onClick={handleClick}
      >
        {/* Photo Image */}
        {photo.url ? (
          <Image
            src={photo.url}
            alt={photo.name || "Photo"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HiPhoto className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
        )}

        {/* Hover Overlay */}
        {!disabled && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
              {/* View Button */}
              <Button size="icon-sm" title="Lihat foto">
                <HiEye className="w-4 h-4" />
              </Button>

              {/* Delete Button */}
              {showDeleteButton && onDelete && (
                <Button
                  variant="destructive"
                  size="icon-sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className={isDeleting ? "opacity-50 cursor-not-allowed" : ""}
                  title={showDeleteConfirm ? "Konfirmasi hapus" : "Hapus foto"}
                >
                  <HiTrash className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Tooltip */}
        {showDeleteConfirm && !isDeleting && (
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            Klik lagi untuk menghapus
          </div>
        )}

        {/* Loading Overlay */}
        {isDeleting && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
          </div>
        )}
      </div>

      {/* Photo Info */}
      {size !== "sm" && photo.name && (
        <div className="mt-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
            {photo.name}
          </p>
          {photo.size && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {(photo.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Extended PhotoThumbnail with count badge for multiple photos
interface PhotoThumbnailWithCountProps extends Omit<
  PhotoThumbnailProps,
  "photo"
> {
  photos: Photo[];
  maxVisible?: number;
}

export function PhotoThumbnailWithCount({
  photos,
  maxVisible = 1,
  ...props
}: PhotoThumbnailWithCountProps) {
  const visiblePhotos = photos.slice(0, maxVisible);
  const remainingCount = Math.max(0, photos.length - maxVisible);

  if (photos.length === 0) {
    return (
      <div className={`${props.className || ""}`}>
        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
          <HiPhoto className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    );
  }

  if (photos.length === 1) {
    const firstPhoto = photos[0];
    if (firstPhoto) {
      return <PhotoThumbnail photo={firstPhoto} {...props} />;
    }
  }

  return (
    <div className={`relative ${props.className}`}>
      {/* Stack of photos */}
      <div className="relative">
        {visiblePhotos.map((photo, index) => (
          <div
            key={photo.id}
            className="absolute"
            style={{
              transform: `translate(${index * 4}px, ${index * 4}px)`,
              zIndex: visiblePhotos.length - index,
            }}
          >
            <PhotoThumbnail
              photo={photo}
              size={props.size}
              disabled={props.disabled}
              onClick={props.onClick}
              onDelete={index === 0 ? props.onDelete : undefined}
              showDeleteButton={index === 0 && props.showDeleteButton}
            />
          </div>
        ))}
      </div>

      {/* Count Badge */}
      {remainingCount > 0 && (
        <div
          className="absolute -top-2 -right-2 bg-blue-500 dark:bg-blue-400 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-20"
          title={`+${remainingCount} foto lagi`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
