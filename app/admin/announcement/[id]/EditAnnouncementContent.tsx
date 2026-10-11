import { notFound } from "next/navigation";

import { announcementService } from "@/modules/notification";
import AnnouncementForm from "../_components/AnnouncementForm";
import { DaftarPembaca } from "../_components/DaftarPembaca";

interface EditAnnouncementPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Server-side data loader untuk halaman edit announcement.
 * Mengambil initialData + statistik pembaca via service layer, lalu render
 * form client dan panel pembaca.
 */
export async function EditAnnouncementContent({
  params,
}: EditAnnouncementPageProps) {
  const { id } = await params;

  const initialData = await announcementService.getAnnouncementEditData(id);

  if (!initialData) {
    notFound();
  }

  const { readCount, recentReaders } =
    await announcementService.getAnnouncementReadStats(id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        Edit Pengumuman
      </h1>
      <AnnouncementForm initialData={initialData} isEdit={true} />
      <DaftarPembaca
        jumlahPembaca={readCount}
        pembacaTerbaru={recentReaders}
      />
    </div>
  );
}
