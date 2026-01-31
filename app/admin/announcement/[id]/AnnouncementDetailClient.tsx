
import { prisma } from '@/lib/prisma';
import AnnouncementForm from '../_components/AnnouncementForm';
import { notFound } from 'next/navigation';

interface EditAnnouncementPageProps {
    params: Promise<{
        id: string;
    }>;
}

export async function ClientComponent({ params }: EditAnnouncementPageProps) {
    const { id } = await params;

    const announcement = await prisma.announcement.findUnique({
        where: { id },
    });

    if (!announcement) {
        notFound();
    }

    // Convert dates to string for serialization if needed, or just pass as is (dates are objects in server components usually)
    // But client components expect serializable props.
    const initialData = {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        target: announcement.target,
        isActive: announcement.isActive,
        isPinned: announcement.isPinned,
        startDate: announcement.startDate ? announcement.startDate.toISOString() : null,
        endDate: announcement.endDate ? announcement.endDate.toISOString() : null,
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 dark:text-white">Edit Announcement</h1>
            <AnnouncementForm initialData={initialData} isEdit={true} />
        </div>
    );
}
