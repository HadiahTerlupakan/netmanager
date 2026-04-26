import Image from "next/image";
import { HiOutlineXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { ZOOM_MODAL_TITLE_ID } from "./CanvasingListTypes";

interface ZoomImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

/** Render zoomed proof image above the claim review modal. */
export default function ZoomImageModal({
  imageUrl,
  onClose,
}: ZoomImageModalProps) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={ZOOM_MODAL_TITLE_ID}
      className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <h3 id={ZOOM_MODAL_TITLE_ID} className="sr-only">
        Preview bukti claim poin
      </h3>
      <div className="relative h-full max-h-[90vh] w-full max-w-4xl">
        <Image
          src={imageUrl}
          alt="Zoomed"
          fill
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="rounded-lg object-contain shadow-2xl"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Tutup preview gambar"
        className="absolute right-6 top-6"
        onClick={onClose}
      >
        <HiOutlineXMark className="h-8 w-8" />
      </Button>
    </div>
  );
}
