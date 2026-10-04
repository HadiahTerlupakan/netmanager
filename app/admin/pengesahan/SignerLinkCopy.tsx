"use client";

import { toast } from "react-hot-toast";
import { HiOutlineClipboardDocument } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

/** URL tautan tanda tangan beserta tombol salin, untuk diteruskan manual. */
export default function SignerLinkCopy({ url }: { url: string }) {
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tautan disalin");
    } catch (error) {
      clientLogger.error("[Pengesahan] gagal menyalin tautan:", error);
      toast.error("Gagal menyalin — salin manual dari teks tautan");
    }
  };

  return (
    <div className="mt-1 flex items-start gap-2">
      <p className="min-w-0 flex-1 break-all font-mono text-xs text-gray-600 dark:text-gray-300">
        {url}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
        <HiOutlineClipboardDocument />
        Salin
      </Button>
    </div>
  );
}
