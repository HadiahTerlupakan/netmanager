
'use client';

import AnnouncementForm from '../_components/AnnouncementForm';

export function ClientComponent() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6 dark:text-white">Create New Announcement</h1>
            <AnnouncementForm />
        </div>
    );
}
