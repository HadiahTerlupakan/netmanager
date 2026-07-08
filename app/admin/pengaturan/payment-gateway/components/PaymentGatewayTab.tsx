"use client";

import { useState } from "react";
import {
  HiOutlineCog6Tooth,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiCube,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { usePaymentGatewayConfigs } from "../hooks/usePaymentGatewayConfigs";
import { PaymentGatewayConfigModal } from "./PaymentGatewayConfigModal";
import type { GatewayConfig } from "../hooks/usePaymentGatewayConfigs";

const PROVIDERS = [
  { id: "XENDIT", name: "Xendit", icon: HiCube, color: "text-green-500" },
  { id: "MIDTRANS", name: "Midtrans", icon: HiCube, color: "text-blue-500" },
  { id: "DUITKU", name: "Duitku", icon: HiCube, color: "text-yellow-500" },
  { id: "TRIPAY", name: "Tripay", icon: HiCube, color: "text-purple-500" },
  { id: "DANA", name: "DANA", icon: HiCube, color: "text-blue-400" },
  { id: "BRI", name: "BRI API", icon: HiCube, color: "text-blue-600" },
  { id: "BCA", name: "BCA API", icon: HiCube, color: "text-blue-700" },
  { id: "MOOTA", name: "Moota.co", icon: HiCube, color: "text-teal-500" },
] as const;

type Provider = (typeof PROVIDERS)[number];

function getProviderConfig(
  configs: readonly GatewayConfig[],
  providerId: string,
) {
  return configs.find((config) => config.provider === providerId);
}

function ProviderCard({
  provider,
  config,
  onConfigure,
  onToggle,
}: {
  readonly provider: Provider;
  readonly config?: GatewayConfig;
  readonly onConfigure: (providerId: string) => void;
  readonly onToggle: (providerId: string, isEnabled: boolean) => void;
}) {
  const isEnabled = config?.isEnabled ?? false;
  const ProviderIcon = provider.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`text-4xl ${provider.color}`}>
            <ProviderIcon className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {provider.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isEnabled ? "Active" : "Inactive"}
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <span className="sr-only">Toggle {provider.name}</span>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => onToggle(provider.id, event.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600" />
        </label>
      </div>

      {config && isEnabled && (
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Mode:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {config.isProduction ? "Production" : "Sandbox"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Priority:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {config.priority}
            </span>
          </div>
          {config.lastTestedAt && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">
                Last Test:
              </span>
              <div className="flex items-center gap-1">
                {config.testStatus === "SUCCESS" ? (
                  <HiOutlineCheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <HiOutlineXCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-xs">
                  {new Date(config.lastTestedAt).toLocaleDateString("id-ID")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onConfigure(provider.id)}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        <HiOutlineCog6Tooth className="w-5 h-5" />
        Configure
      </button>
    </div>
  );
}

export default function PaymentGatewayTab() {
  const {
    configs,
    loading,
    saving,
    testing,
    toggleProvider,
    saveConfig,
    testConnection,
  } = usePaymentGatewayConfigs();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const selectedProviderConfig = selectedProvider
    ? getProviderConfig(configs, selectedProvider)
    : undefined;
  const selectedProviderName =
    PROVIDERS.find((provider) => provider.id === selectedProvider)?.name ??
    "Provider";

  const handleToggleEnabled = async (
    providerId: string,
    isEnabled: boolean,
  ) => {
    const result = await toggleProvider(providerId, isEnabled);
    if (!result.success) {
      alert(result.message ?? "Gagal mengupdate status provider");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <PageLoader />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            config={getProviderConfig(configs, provider.id)}
            onConfigure={setSelectedProvider}
            onToggle={handleToggleEnabled}
          />
        ))}
      </div>

      <PaymentGatewayConfigModal
        key={selectedProvider ?? "payment-gateway-config"}
        isOpen={selectedProvider !== null}
        providerId={selectedProvider}
        providerName={selectedProviderName}
        config={selectedProviderConfig}
        saving={saving}
        testing={testing}
        onClose={() => setSelectedProvider(null)}
        onSave={saveConfig}
        onTestConnection={testConnection}
      />
    </div>
  );
}
