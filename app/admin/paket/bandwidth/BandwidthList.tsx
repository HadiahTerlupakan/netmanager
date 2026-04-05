"use client"

import PageLoader from '@/components/ui/PageLoader'

import { BandwidthFormModal } from '@/app/admin/paket/bandwidth/components/BandwidthFormModal'
import { BandwidthTable } from '@/app/admin/paket/bandwidth/components/BandwidthTable'
import { useBandwidthPageState } from '@/app/admin/paket/bandwidth/hooks/useBandwidthPageState'

export default function BandwidthPage() {
  const {
    loading,
    bandwidths,
    error,
    siteId,
    setSiteId,
    isModalOpen,
    editingBandwidth,
    formData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    handleOpenCreate,
  } = useBandwidthPageState()

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      <BandwidthTable
        bandwidths={bandwidths}
        error={error}
        siteId={siteId}
        onSiteChange={setSiteId}
        onAddClick={handleOpenCreate}
        onEdit={handleEdit}
        onDelete={(id) => {
          void handleDelete(id)
        }}
      />

      <BandwidthFormModal
        open={isModalOpen}
        editingBandwidthName={editingBandwidth?.name || null}
        formData={formData}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        onFieldChange={handleFormChange}
      />
    </div>
  )
}
