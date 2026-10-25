"use client";
import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScriptGeneratorModal from "@/components/mikrotik/ScriptGeneratorModal";
import TestConnectionModal from "@/components/mikrotik/TestConnectionModal";
import VpnScriptModal from "@/components/mikrotik/VpnScriptModal";
import { Button } from "@/components/ui/Button";
import {
  MikrotikRouterForm,
  type MikrotikRouterFormData,
} from "@/app/admin/network/mikrotik/components/mikrotikRouterForm";
import { withIsolirUrlForMode } from "@/app/admin/network/mikrotik/components/IsolirModeField";
import { VpnConnectionSection } from "@/app/admin/network/mikrotik/components/VpnConnectionSection";
import { useMikrotikConnectionTest } from "@/app/admin/network/mikrotik/hooks/useMikrotikConnectionTest";
import { useMikrotikFormSettings } from "@/app/admin/network/mikrotik/hooks/useMikrotikFormSettings";
import { useVpnRouterMode } from "@/app/admin/network/mikrotik/hooks/useVpnRouterMode";
import { useAutoVpnDraft } from "@/app/admin/network/mikrotik/hooks/useAutoVpnDraft";
import { isVpnDraftSpent } from "@/app/admin/network/mikrotik/mikrotikFormShared";

export function ClientComponent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [formData, setFormData] = useState<
    MikrotikRouterFormData & { autoConfigure: boolean }
  >({
    name: "",
    ipAddress: "",
    timezone: "+07:00 Asia/Jakarta",
    apiPort: 8728,
    apiUsername: "",
    apiPassword: "",
    isolirMode: "ROUTER_PAGE",
    isolirUrl: "",
    description: "",
    autoConfigure: true,
    rosVersion: "V6",
    connectionMode: "PUBLIC",
    vpnServerIds: [],
    vpnProtocol: "WIREGUARD",
  });

  const { pppConnectionMode } = useMikrotikFormSettings();
  const { isTesting, showTestModal, testResult, runTest, closeTestModal } =
    useMikrotikConnectionTest({
      formData,
    });
  const vpn = useVpnRouterMode({
    formData,
    setFormData,
    testResult,
    isTesting,
  });
  const autoDraft = useAutoVpnDraft({
    isVpnMode: vpn.isVpnMode,
    request: vpn.draftRequest,
    currentDraftId: formData.vpnDraftId,
    onDraftReady: vpn.handleDraftReady,
  });
  // Server isolir tidak ditawarkan lagi saat router kembali ke publik; nilainya
  // diturunkan di sini agar tampilan dan kiriman sama dan tidak ditolak server.
  const isolirMode =
    !vpn.isVpnMode && formData.isolirMode === "ISOLIR_SERVICE"
      ? "ROUTER_PAGE"
      : formData.isolirMode;
  const isSubmitAllowed = vpn.isVpnMode ? vpn.isVpnTestPassed : testPassed;
  const openScriptModal = () => setShowScriptModal(true);
  const isVpnScriptPending = vpn.isVpnMode && !autoDraft.draft;
  let vpnScriptPendingTitle: string | undefined;
  if (isVpnScriptPending) {
    vpnScriptPendingTitle = autoDraft.error
      ? "Script VPN gagal disiapkan; tekan Coba lagi"
      : "Script VPN sedang disiapkan";
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!isSubmitAllowed) {
      alert(
        "Silakan test koneksi terlebih dahulu dan pastikan test berhasil sebelum menyimpan router.",
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/mikrotik-routers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withIsolirUrlForMode({ ...formData, isolirMode })),
      });

      if (!res.ok) {
        const error = await res.json();
        if (vpn.isVpnMode && isVpnDraftSpent(res.status)) vpn.discardDraft();
        alert(error.error || "Gagal menambahkan router");
        return;
      }

      router.push("/admin/network/mikrotik");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      clientLogger.error("Error creating router:", error);
      alert("Terjadi kesalahan saat menambahkan router: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    // Mode VPN dinilai lewat vpn.apiCheck (syarat RouterOS v7), bukan testPassed.
    if (vpn.isVpnMode) {
      vpn.markTestStarted();
      await runTest();
      return;
    }
    const success = await runTest();
    setTestPassed(success);
  };

  const handleRosVersionChange = (isV7: boolean) => {
    setTestPassed(false);
    vpn.handleRosVersionChange(isV7);
  };

  const handleConnectionModeChange = (isVpn: boolean, serverIds: string[]) => {
    setTestPassed(false);
    vpn.handleConnectionModeChange(isVpn, serverIds);
  };

  const handleFormChange = (
    field: keyof MikrotikRouterFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tambah Router {pppConnectionMode === "RADIUS" && "[NAS]"}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="success">Panduan Dasar</Button>
          <Button
            type="button"
            onClick={openScriptModal}
            // Mode VPN membuka script draft otomatis; selama disiapkan belum ada script.
            disabled={isVpnScriptPending}
            title={vpnScriptPendingTitle}
          >
            &lt;/&gt; SCRIPT GENERATOR
          </Button>
        </div>
      </div>

      <MikrotikRouterForm
        title="Tambah Router"
        pppConnectionMode={pppConnectionMode}
        formData={{ ...formData, isolirMode }}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onTestClick={() => {
          void handleTestConnection();
        }}
        isSubmitting={loading}
        submitLabel="Tambahkan Router"
        submitDisabled={!isSubmitAllowed}
        submitDisabledTitle={
          !isSubmitAllowed
            ? "Silakan test koneksi terlebih dahulu dan pastikan test berhasil"
            : undefined
        }
        cancelHref="/admin/network/mikrotik"
        isConnectionLocked={vpn.isVpnMode}
        connectionMode={vpn.isVpnMode ? "VPN" : "PUBLIC"}
        connectionPlaceholder={
          autoDraft.isPreparing ? "Sedang disiapkan…" : undefined
        }
        connectionSection={
          <VpnConnectionSection
            rosVersion={formData.rosVersion ?? "V6"}
            connectionMode={formData.connectionMode ?? "PUBLIC"}
            selectedServerIds={formData.vpnServerIds ?? []}
            isDraftOutdated={vpn.isDraftOutdated}
            onRosVersionChange={handleRosVersionChange}
            onConnectionModeChange={handleConnectionModeChange}
            protocol={formData.vpnProtocol ?? "WIREGUARD"}
            onServerIdsChange={vpn.handleServerIdsChange}
            onProtocolChange={vpn.handleProtocolChange}
            draftStatus={{
              isReady: Boolean(autoDraft.draft),
              error: autoDraft.error,
              onRetry: autoDraft.retry,
              onViewScript: openScriptModal,
            }}
          />
        }
      />

      <TestConnectionModal
        // Saat modal VPN terbuka, hasil test (termasuk syarat v7) tampil di sana.
        open={showTestModal && !(vpn.isVpnMode && showScriptModal)}
        onClose={closeTestModal}
        result={testResult}
        isLoading={isTesting}
      />

      {vpn.isVpnMode && showScriptModal && autoDraft.draft && (
        <VpnScriptModal
          key={autoDraft.draft.draftId}
          draft={autoDraft.draft}
          request={vpn.draftRequest}
          apiCheck={vpn.apiCheck}
          onClose={() => setShowScriptModal(false)}
          onDraftReady={vpn.handleDraftReady}
          onTunnelUp={() => {
            void handleTestConnection();
          }}
        />
      )}

      <ScriptGeneratorModal
        open={showScriptModal && !vpn.isVpnMode}
        onClose={() => setShowScriptModal(false)}
      />
    </div>
  );
}
