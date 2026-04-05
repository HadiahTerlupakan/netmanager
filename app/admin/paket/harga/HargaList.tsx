"use client"

import PageLoader from '@/components/ui/PageLoader'

import { HargaFormModal } from '@/app/admin/paket/harga/components/HargaFormModal'
import { HargaTable } from '@/app/admin/paket/harga/components/HargaTable'
import { useHargaPaketPageState } from '@/app/admin/paket/harga/hooks/useHargaPaketPageState'

export default function HargaPaketPage() {
  const {
    loading,
    hargaPakets,
    profilePPPs,
    sites,
    bandwidths,
    error,
    isModalOpen,
    editingPaket,
    siteId,
    setSiteId,
    formData,
    pppConnectionMode,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    openCreateModal,
  } = useHargaPaketPageState()

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-20">
          <PageLoader />
        </div>
      ) : (
        <HargaTable
          hargaPakets={hargaPakets}
          loading={loading}
          error={error}
          siteId={siteId}
          onSiteChange={setSiteId}
          onAddClick={openCreateModal}
          onEdit={handleEdit}
          onDelete={(id) => {
            void handleDelete(id)
          }}
        />
      )}

      <HargaFormModal
        open={isModalOpen}
        editingPaketName={editingPaket?.name || null}
        formData={formData}
        profilePPPs={profilePPPs}
        sites={sites}
        bandwidths={bandwidths}
        pppConnectionMode={pppConnectionMode}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onFieldChange={handleFormChange}
      />
    </div>
  )
}
