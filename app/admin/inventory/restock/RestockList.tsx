"use client";

import { useState } from "react";

import { usePermission } from "@/hooks/use-permission";

import { RestockApprovalModal } from "./RestockApprovalModal";
import { RestockCloseUnpurchasedModal } from "./RestockCloseUnpurchasedModal";
import { RestockDetailModal } from "./RestockDetailModal";
import { RestockFormModal } from "./RestockFormModal";
import { RestockReceiveModal } from "./RestockReceiveModal";
import { RestockConfirmJasaModal } from "./RestockConfirmJasaModal";
import { RestockTable } from "./RestockTable";
import { useDetailChainedFocus } from "./useDetailChainedFocus";
import { useRestockPage } from "./useRestockPage";
import type { PurchaseRequest } from "./types";

export default function RestockCRUDPage() {
  const { hasPermission } = usePermission();
  const canApprove = hasPermission("restock:approve");
  const canUpdate = hasPermission("restock:update");
  const canVerify = hasPermission("restock:verify");
  const canDelete = hasPermission("restock:delete");

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
    fetchData,
    receivingPR,
    receivedItems,
    setReceivedItems,
    receivedSubstitutions,
    setReceivedSubstitutions,
    receivedCancellations,
    setReceivedCancellations,
    receivedOverReceipts,
    setReceivedOverReceipts,
    receivedPhotos,
    setReceivedPhotos,
    isFinishingOrder,
    setIsFinishingOrder,
    receiveCloseReason,
    setReceiveCloseReason,
    submitting,
    photoUploadRef,
    openCreate,
    openEdit,
    closeForm,
    saveRequest,
    deleteRequest,
    approval,
    closeUnpurchased,
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
  const { rememberDetailTrigger, markOpenedFromDetail } = useDetailChainedFocus(
    !!receivingPR || !!closeUnpurchased.request,
  );
  const [isFocusingPurchaseLink, setIsFocusingPurchaseLink] = useState(false);

  const openDetail = (request: PurchaseRequest, focusPurchaseLink: boolean) => {
    rememberDetailTrigger();
    setIsFocusingPurchaseLink(focusPurchaseLink);
    setViewingPR(request);
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
        onOpenDetail={(request) => openDetail(request, false)}
        onOpenApproval={approval.open}
        onOpenReceive={openReceive}
        onOpenPurchaseLink={(request) => openDetail(request, true)}
        onOpenCloseUnpurchased={closeUnpurchased.open}
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
        onOpenReceive={(request) => {
          markOpenedFromDetail();
          setViewingPR(null);
          openReceive(request);
        }}
        isFocusingPurchaseLink={isFocusingPurchaseLink}
        onPurchaseVoided={fetchData}
        onOpenCloseUnpurchased={(request) => {
          markOpenedFromDetail();
          setViewingPR(null);
          closeUnpurchased.open(request);
        }}
      />

      <RestockCloseUnpurchasedModal state={closeUnpurchased} />

      <RestockReceiveModal
        key={receivingPR?.id ?? "no-receipt"}
        request={receivingPR}
        receivedItems={receivedItems}
        onReceivedItemsChange={setReceivedItems}
        barangs={allBarangs}
        substitutions={receivedSubstitutions}
        onSubstitutionsChange={setReceivedSubstitutions}
        cancellations={receivedCancellations}
        onCancellationsChange={setReceivedCancellations}
        overReceipts={receivedOverReceipts}
        onOverReceiptsChange={setReceivedOverReceipts}
        receivedPhotos={receivedPhotos}
        onReceivedPhotosChange={setReceivedPhotos}
        isFinishingOrder={isFinishingOrder}
        onIsFinishingOrderChange={setIsFinishingOrder}
        closeReason={receiveCloseReason}
        onCloseReasonChange={setReceiveCloseReason}
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
