import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";

interface PhotoModalProps {
  photoUrl: string | null;
  onClose: () => void;
}

export function PhotoModal({ photoUrl, onClose }: PhotoModalProps) {
  return (
    <Modal
      isOpen={!!photoUrl}
      onClose={onClose}
      title="Preview Foto"
      size="4xl"
      padding={false}
      showCloseButton={true}
    >
      <div className="relative w-full h-[80vh] flex items-center justify-center bg-black/90">
        {photoUrl && (
          <Image
            src={photoUrl}
            alt="Full view"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-contain"
          />
        )}
      </div>
      <ModalFooter className="bg-black/90 border-t border-white/10">
        <Button
          onClick={onClose}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
        >
          Tutup
        </Button>
      </ModalFooter>
    </Modal>
  );
}
