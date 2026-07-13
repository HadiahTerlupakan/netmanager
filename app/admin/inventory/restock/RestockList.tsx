"use client";

import { usePermission } from "@/hooks/use-permission";

import { RestockDetailModal } from "./RestockDetailModal";
import { RestockFormModal } from "./RestockFormModal";
import { RestockReceiveModal } from "./RestockReceiveModal";
import { RestockConfirmJasaModal } from "./RestockConfirmJasaModal";
import { RestockTable } from "./RestockTable";
import { useRestockPage } from "./useRestockPage";

export default function RestockCRUDPage() {
  const { hasPermission } = usePermission();
  const canApprove = hasPermission("restock:approve");
  const canUpdate = hasPermission("restock:update");
  const canVerify = hasPermission("restock:verify");

  const {
    requests,
    barangs,
    allJasaSource,
    allSettingsSource,
    gudangs,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    statusOptions,
    gudangFilter,
    setGudangFilter,
    gudangOptions,
    currentPage,
    totalPages,
    itemsPerPage,
    setItemsPerPage,
    setCurrentPage,
    showAllItems,
    setShowAllItems,
    showForm,
    editingPR,
    formGudang,
    setFormGudang,
    formNotes,
    setFormNotes,
    formItems,
    setFormItems,
    viewingPR,
    setViewingPR,
    receivingPR,
    receivedItems,
    setReceivedItems,
    receivedPhotos,
    setReceivedPhotos,
    isFinishingPO,
    setIsFinishingPO,
    submitting,
    photoUploadRef,
    openCreate,
    openEdit,
    closeForm,
    saveRequest,
    deleteRequest,
    approveRequest,
    openReceive,
    closeReceive,
    submitReceipt,
    confirmJasaPR,
    openConfirmJasa,
    closeConfirmJasa,
    jasaConfirmStates,
    updateJasaConfirmState,
    jasaPhotoUploadRefs,
    submitConfirmJasa,
  } = useRestockPage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RestockTable
        requests={requests}
        loading={loading}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        gudangFilter={gudangFilter}
        onGudangFilterChange={setGudangFilter}
        gudangOptions={gudangOptions}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        canApprove={canApprove}
        canUpdate={canUpdate}
        canVerify={canVerify}
        onOpenCreate={openCreate}
        onOpenEdit={openEdit}
        onOpenDetail={setViewingPR}
        onApprove={approveRequest}
        onOpenReceive={openReceive}
        onOpenConfirmJasa={openConfirmJasa}
        onDelete={deleteRequest}
      />

      <RestockFormModal
        isOpen={showForm}
        isEditing={!!editingPR}
        formGudang={formGudang}
        onFormGudangChange={setFormGudang}
        formNotes={formNotes}
        onFormNotesChange={setFormNotes}
        formItems={formItems}
        onFormItemsChange={setFormItems}
        gudangs={gudangs}
        barangs={barangs}
        jasaList={allJasaSource}
        allSettings={allSettingsSource}
        showAllItems={showAllItems}
        onShowAllItemsChange={setShowAllItems}
        loading={loading}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={saveRequest}
      />

      <RestockDetailModal
        request={viewingPR}
        onClose={() => setViewingPR(null)}
      />

      <RestockReceiveModal
        request={receivingPR}
        receivedItems={receivedItems}
        onReceivedItemsChange={setReceivedItems}
        receivedPhotos={receivedPhotos}
        onReceivedPhotosChange={setReceivedPhotos}
        isFinishingPO={isFinishingPO}
        onIsFinishingPOChange={setIsFinishingPO}
        submitting={submitting}
        photoUploadRef={photoUploadRef}
        onClose={closeReceive}
        onSubmit={submitReceipt}
      />

      <RestockConfirmJasaModal
        request={confirmJasaPR}
        jasaConfirmStates={jasaConfirmStates}
        onJasaConfirmStateChange={updateJasaConfirmState}
        photoUploadRefs={jasaPhotoUploadRefs}
        submitting={submitting}
        onClose={closeConfirmJasa}
        onSubmit={submitConfirmJasa}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </div>
  );
}
