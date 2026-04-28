import { announcementService } from "@/modules/notification";
import AnnouncementForm from "../_components/AnnouncementForm";
import { notFound } from "next/navigation";

interface EditAnnouncementPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function ClientComponent({ params }: EditAnnouncementPageProps) {
  const { id } = await params;

  const initialData = await announcementService.getAnnouncementEditData(id);

  if (!initialData) {
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        Edit Announcement
      </h1>
      <AnnouncementForm initialData={initialData} isEdit={true} />
    </div>
  );
}
