"use client";

import { Modal } from "@/components/ui/Modal";

import { ProfileDetailContent } from "@/app/admin/paket/profileppp/components/ProfileDetailContent";
import type { ProfileDetail } from "@/app/admin/paket/profileppp/lib/profilePppTypes";
import { useApi } from "@/lib/hooks/useApi";

type ProfileDetailModalProps = {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
};

export default function ProfileDetailModal({
  open,
  onClose,
  profileId,
}: ProfileDetailModalProps) {
  const shouldFetch = open && profileId;
  const { data, error, isLoading } = useApi<ProfileDetail>(
    shouldFetch ? `/api/profileppps/${profileId}` : null,
  );

  const profile: ProfileDetail | null = data ?? null;
  const errorMessage = error
    ? error.message || "Gagal memuat detail profile"
    : null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Detail Profile PPP"
      size="2xl"
    >
      <ProfileDetailContent
        profile={profile}
        loading={isLoading}
        error={errorMessage}
      />
    </Modal>
  );
}
