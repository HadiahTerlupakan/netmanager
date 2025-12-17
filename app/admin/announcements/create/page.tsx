
'use client';

import AnnouncementForm from '../_components/AnnouncementForm';

export default function CreateAnnouncementPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Create New Announcement</h1>
            <AnnouncementForm />
        </div>
    );
}
