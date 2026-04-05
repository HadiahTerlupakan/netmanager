"use client"

import PageLoader from '@/components/ui/PageLoader'

import { ProfilePppFormModal } from '@/app/admin/paket/profileppp/components/ProfilePppFormModal'
import { ProfilePppTable } from '@/app/admin/paket/profileppp/components/ProfilePppTable'
import { useProfilePppPageState } from '@/app/admin/paket/profileppp/hooks/useProfilePppPageState'

export default function ProfilePPPPage() {
  const {
    loading,
    siteId,
    setSiteId,
    profilePPPs,
    mikroTikRouters,
    bandwidths,
    pppConnectionMode,
    error,
    isModalOpen,
    editingProfile,
    formData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    openCreateModal,
  } = useProfilePppPageState()

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      <ProfilePppTable
        profilePPPs={profilePPPs}
        error={error}
        siteId={siteId}
        pppConnectionMode={pppConnectionMode}
        onSiteChange={setSiteId}
        onAddClick={openCreateModal}
        onEdit={(profile) => {
          void handleEdit(profile)
        }}
        onDelete={(id) => {
          void handleDelete(id)
        }}
      />

      <ProfilePppFormModal
        open={isModalOpen}
        editingProfileName={editingProfile?.name || null}
        formData={formData}
        mikroTikRouters={mikroTikRouters}
        bandwidths={bandwidths}
        pppConnectionMode={pppConnectionMode}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onFieldChange={handleFormChange}
      />
    </div>
  )
}
