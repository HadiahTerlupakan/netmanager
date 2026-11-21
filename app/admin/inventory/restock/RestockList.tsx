"use client";

import { usePermission } from "@/hooks/use-permission";

import { RestockApprovalModal } from "./RestockApprovalModal";
import { RestockCancelModal } from "./RestockCancelModal";
import { RestockDetailModal } from "./RestockDetailModal";
import { RestockFormModal } from "./RestockFormModal";
import { RestockReceiveModal } from "./RestockReceiveModal";
import { RestockConfirmJasaModal } from "./RestockConfirmJasaModal";
import { RestockTable } from "./RestockTable";
import { useDetailChainedFocus } from "./useDetailChainedFocus";
import { useRestockPage } from "./useRestockPage";
import type { PurchaseRequest } from "./types";

/** Halaman Pengajuan Barang: tabel pengajuan beserta semua modalnya. */
export default function RestockCRUDPage() {
  const { hasPermission } = usePermission();
  const canApprove = hasPermission("restock:approve");
  const canUpdate = hasPermission("restock:update");
  const canVerify = hasPermission("restock:verify");
  const canDelete = hasPermission("restock:delete");
  // Barang yang masuk lebih banyak dari sisa menambah isi pesanan.
  const canOverReceive = hasPermission("purchase_orders:update");

  const {
    requests,
    barangs,
    allBarangs,
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
    submitting,
    openCreate,
    openEdit,
    closeForm,
    saveRequest,
    deleteRequest,
    approval,
    entry,
    cancel,
    confirmJasaPR,
    openConfirmJasa,
    closeConfirmJasa,
    jasaConfirmStates,
    updateJasaConfirmState,
    jasaPhotoUploadRefs,
    submitConfirmJasa,
  } = useRestockPage();
  const { rememberDetailTrigger, markOpenedFromDetail } = useDetailChainedFocus(
    !!entry.request || !!cancel.request,
  );

  const openDetail = (request: PurchaseRequest) => {
    rememberDetailTrigger();
    setViewingPR(request);
  };

  /** Detail ditutup dulu; fokus nanti kembali ke tombol tabel pembuka detail. */
  const openFromDetail =
    (openModal: (request: PurchaseRequest) => void) =>
    (request: PurchaseRequest) => {
      markOpenedFromDetail();
      setViewingPR(null);
      openModal(request);
    };

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
        canDelete={canDelete}
        onOpenCreate={openCreate}
        onOpenEdit={openEdit}
        onOpenDetail={openDetail}
        onOpenApproval={approval.open}
        onOpenReceive={entry.open}
        onOpenCancel={cancel.open}
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

      <RestockApprovalModal approval={approval} allBarangs={allBarangs} />

      <RestockDetailModal
        request={viewingPR}
        onClose={() => setViewingPR(null)}
        canVerify={canVerify}
        onOpenReceive={openFromDetail(entry.open)}
        onOpenCancel={openFromDetail(cancel.open)}
      />

      <RestockCancelModal state={cancel} />

      <RestockReceiveModal
        key={entry.request?.id ?? "no-entry"}
        entry={entry}
        barangs={allBarangs}
        canOverReceive={canOverReceive}
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
