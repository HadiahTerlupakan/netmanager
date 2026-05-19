"use client";

import AnnouncementForm from "../_components/AnnouncementForm";

export function AnnouncementCreateClient() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        Buat Pengumuman Baru
      </h1>
      <AnnouncementForm />
    </div>
  );
}
