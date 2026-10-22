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
import { VpnConnectionSection } from "@/app/admin/network/mikrotik/components/VpnConnectionSection";
import { useMikrotikConnectionTest } from "@/app/admin/network/mikrotik/hooks/useMikrotikConnectionTest";
import { useMikrotikFormSettings } from "@/app/admin/network/mikrotik/hooks/useMikrotikFormSettings";
import { useVpnRouterMode } from "@/app/admin/network/mikrotik/hooks/useVpnRouterMode";
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
    isolirUrl: "",
    description: "",
    autoConfigure: true,
    rosVersion: "V6",
    connectionMode: "PUBLIC",
    vpnServerIds: [],
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
  const isSubmitAllowed = vpn.isVpnMode ? vpn.isVpnTestPassed : testPassed;

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
        body: JSON.stringify(formData),
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
          <Button type="button" onClick={() => setShowScriptModal(true)}>
            &lt;/&gt; SCRIPT GENERATOR
          </Button>
        </div>
      </div>

      <MikrotikRouterForm
        title="Tambah Router"
        pppConnectionMode={pppConnectionMode}
        formData={formData}
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
        connectionSection={
          <VpnConnectionSection
            rosVersion={formData.rosVersion ?? "V6"}
            connectionMode={formData.connectionMode ?? "PUBLIC"}
            selectedServerIds={formData.vpnServerIds ?? []}
            isDraftOutdated={vpn.isDraftOutdated}
            onRosVersionChange={handleRosVersionChange}
            onConnectionModeChange={handleConnectionModeChange}
            onServerIdsChange={vpn.handleServerIdsChange}
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

      {vpn.isVpnMode && showScriptModal && (
        <VpnScriptModal
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
