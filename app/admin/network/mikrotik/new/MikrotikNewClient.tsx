"use client";
import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ScriptGeneratorModal from "@/components/mikrotik/ScriptGeneratorModal";
import TestConnectionModal from "@/components/mikrotik/TestConnectionModal";
import { Button } from "@/components/ui/Button";
import {
  MikrotikRouterForm,
  type MikrotikRouterFormData,
} from "@/app/admin/network/mikrotik/components/mikrotikRouterForm";
import { useMikrotikConnectionTest } from "@/app/admin/network/mikrotik/hooks/useMikrotikConnectionTest";
import { useMikrotikFormSettings } from "@/app/admin/network/mikrotik/hooks/useMikrotikFormSettings";

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
  });

  const { pppConnectionMode, radiusDefaults } = useMikrotikFormSettings();
  const { isTesting, showTestModal, testResult, runTest, closeTestModal } =
    useMikrotikConnectionTest({
      formData,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testPassed) {
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
    const success = await runTest();
    setTestPassed(success);
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
        submitDisabled={!testPassed}
        submitDisabledTitle={
          !testPassed
            ? "Silakan test koneksi terlebih dahulu dan pastikan test berhasil"
            : undefined
        }
        cancelHref="/admin/network/mikrotik"
      />

      <TestConnectionModal
        open={showTestModal}
        onClose={closeTestModal}
        result={testResult}
        isLoading={isTesting}
      />

      <ScriptGeneratorModal
        open={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        secret={radiusDefaults.radiusSecret}
      />
    </div>
  );
}
