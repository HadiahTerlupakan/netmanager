"use client";
import { clientLogger } from "@/lib/client-logger";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiArrowPath } from "react-icons/hi2";
import ScriptGeneratorModal from "@/components/mikrotik/ScriptGeneratorModal";
import TestConnectionModal from "@/components/mikrotik/TestConnectionModal";
import { Button } from "@/components/ui/Button";
import {
  MikrotikRouterForm,
  type MikrotikRouterFormData,
} from "@/app/admin/network/mikrotik/components/mikrotikRouterForm";
import { withIsolirUrlForMode } from "@/app/admin/network/mikrotik/components/IsolirModeField";
import { useMikrotikConnectionTest } from "@/app/admin/network/mikrotik/hooks/useMikrotikConnectionTest";
import { RouterVpnPanel } from "@/app/admin/network/mikrotik/[id]/edit/RouterVpnPanel";
import { RouterVpnProtocolPanel } from "@/app/admin/network/mikrotik/[id]/edit/RouterVpnProtocolPanel";
import { RouterVpnEnablePanel } from "@/app/admin/network/mikrotik/[id]/edit/RouterVpnEnablePanel";
import { Toggle } from "@/app/admin/network/mikrotik/components/VpnConnectionSection";
import {
  evaluateVpnConnectionTest,
  type RouterOsVersion,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";
import { useMikrotikFormSettings } from "@/app/admin/network/mikrotik/hooks/useMikrotikFormSettings";

export function ClientComponent() {
  const router = useRouter();
  const params = useParams();
  const routerId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [isVpnRouter, setIsVpnRouter] = useState(false);
  const [savedRosVersion, setSavedRosVersion] = useState<RouterOsVersion>("V6");
  const [publicIpAddress, setPublicIpAddress] = useState<string | null>(null);
  const [formData, setFormData] = useState<MikrotikRouterFormData>({
    name: "",
    ipAddress: "",
    timezone: "+07:00 Asia/Jakarta",
    apiPort: 8728,
    apiUsername: "",
    apiPassword: "",
    isolirMode: "ROUTER_PAGE",
    isolirUrl: "",
    description: "",
  });

  const { pppConnectionMode } = useMikrotikFormSettings();

  const loadRouter = useCallback(async () => {
    try {
      const res = await fetch(`/api/mikrotik-routers/${routerId}`);
      if (!res.ok) {
        alert("Router tidak ditemukan");
        router.push("/admin/network/mikrotik");
        return;
      }

      const responseData = await res.json();
      const routerData = responseData.data?.router;
      setIsVpnRouter(routerData.connectionMode === "VPN");
      setSavedRosVersion(routerData.rosVersion);
      setPublicIpAddress(routerData.publicIpAddress ?? null);
      setFormData({
        name: routerData.name,
        ipAddress: routerData.ipAddress,
        timezone: routerData.timezone,
        apiPort: routerData.apiPort,
        apiUsername: routerData.apiUsername,
        apiPassword: routerData.apiPassword,
        isolirMode: routerData.isolirMode,
        isolirUrl: routerData.isolirUrl || "",
        description: routerData.description || "",
        rosVersion: routerData.rosVersion,
      });
    } catch (error) {
      clientLogger.error("Error loading router:", error);
      alert("Gagal memuat data router");
      router.push("/admin/network/mikrotik");
    } finally {
      setLoading(false);
    }
  }, [router, routerId]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadRouter();
  }, [loadRouter]);

  const { isTesting, showTestModal, testResult, runTest, closeTestModal } =
    useMikrotikConnectionTest({
      formData,
      routerId,
      onSuccess: async (result) => {
        if (!result.success) return;
        await loadRouter();
        // Test yang membuktikan RouterOS v7 menyalakan toggle; tetap perlu disimpan.
        if (evaluateVpnConnectionTest(result).status === "passed") {
          setFormData((prev) => ({ ...prev, rosVersion: "V7" }));
        }
      },
    });

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/mikrotik-routers/${routerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withIsolirUrlForMode(formData)),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Gagal mengupdate router");
        return;
      }

      router.push("/admin/network/mikrotik");
    } catch (error) {
      clientLogger.error("Error updating router:", error);
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      alert("Terjadi kesalahan saat mengupdate router: " + message);
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <HiArrowPath className="mb-4 w-12 h-12 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Memuat data router...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Router {pppConnectionMode === "RADIUS" && "[NAS]"}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="success">Panduan Dasar</Button>
          <Button type="button" onClick={() => setShowScriptModal(true)}>
            &lt;/&gt; SCRIPT GENERATOR
          </Button>
        </div>
      </div>

      <MikrotikRouterForm
        title="Edit Router"
        pppConnectionMode={pppConnectionMode}
        formData={formData}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onTestClick={() => {
          void runTest();
        }}
        isSubmitting={saving}
        submitLabel="Update Router"
        cancelHref="/admin/network/mikrotik"
        isConnectionLocked={isVpnRouter}
        showIsolirReconfigureHint
        connectionSection={
          !isVpnRouter && (
            <Toggle
              id="mikrotik-ros-v7"
              label="RouterOS v7"
              isChecked={formData.rosVersion === "V7"}
              onChange={(isV7) =>
                setFormData((prev) => ({
                  ...prev,
                  rosVersion: isV7 ? "V7" : "V6",
                }))
              }
            />
          )
        }
      />

      {isVpnRouter && (
        <>
          <RouterVpnPanel
            routerId={routerId}
            publicIpAddress={publicIpAddress}
            onReverted={loadRouter}
          />
          <RouterVpnProtocolPanel routerId={routerId} />
        </>
      )}
      {!isVpnRouter && savedRosVersion === "V7" && (
        <RouterVpnEnablePanel routerId={routerId} onMigrated={loadRouter} />
      )}
      {!isVpnRouter &&
        savedRosVersion !== "V7" &&
        formData.rosVersion === "V7" && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Simpan router sebagai RouterOS v7 untuk mengaktifkan VPN.
          </p>
        )}

      <TestConnectionModal
        open={showTestModal}
        onClose={closeTestModal}
        result={testResult}
        isLoading={isTesting}
      />

      <ScriptGeneratorModal
        open={showScriptModal}
        onClose={() => setShowScriptModal(false)}
      />
    </div>
  );
}
