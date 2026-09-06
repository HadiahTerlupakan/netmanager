"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import type {
  GatewayConfig,
  PaymentActionResult,
  PaymentGatewayFormPayload,
  PaymentGatewayTestPayload,
} from "../hooks/usePaymentGatewayConfigs";
import { getPublicSiteUrl } from "@/lib/utils/portal-url";

/** Dipakai hanya bila domain publik tidak bisa ditentukan sama sekali. */
const PLACEHOLDER_SITE_URL = "https://yourdomain.com";

const INPUT_CLASS =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

function getInitialFormData(
  config: GatewayConfig | undefined,
): PaymentGatewayFormPayload {
  return {
    isProduction: config?.isProduction ?? false,
    priority: config?.priority ?? 1,
    apiKey: "",
    apiSecret: "",
    clientKey: config?.clientKey ?? "",
    merchantId: config?.merchantId ?? "",
  };
}

function getMerchantProviderName(providerId: string) {
  if (providerId === "TRIPAY") return "Tripay";
  if (providerId === "DANA") return "DANA";
  return "Duitku";
}

function canUseMerchantCode(providerId: string | null) {
  return (
    providerId === "DUITKU" || providerId === "TRIPAY" || providerId === "DANA"
  );
}

interface PaymentGatewayConfigModalProps {
  readonly isOpen: boolean;
  readonly providerId: string | null;
  readonly providerName: string;
  readonly config?: GatewayConfig;
  readonly saving: boolean;
  readonly testing: boolean;
  readonly onClose: () => void;
  readonly onSave: (
    providerId: string,
    payload: PaymentGatewayFormPayload,
  ) => Promise<PaymentActionResult>;
  readonly onTestConnection: (
    payload: PaymentGatewayTestPayload,
  ) => Promise<PaymentActionResult>;
}

export function PaymentGatewayConfigModal({
  isOpen,
  providerId,
  providerName,
  config,
  saving,
  testing,
  onClose,
  onSave,
  onTestConnection,
}: PaymentGatewayConfigModalProps) {
  const [formData, setFormData] = useState<PaymentGatewayFormPayload>(() =>
    getInitialFormData(config),
  );
  // `NEXT_PUBLIC_APP_URL` tidak dilewatkan sebagai build arg, jadi di browser
  // nilainya undefined dan URL webhook yang disalin admin ke dashboard
  // penyedia pembayaran berisi domain contoh, bukan domain sungguhan.
  const publicSiteUrl = getPublicSiteUrl();
  const webhookBaseUrl = publicSiteUrl.startsWith("http")
    ? publicSiteUrl
    : PLACEHOLDER_SITE_URL;
  const webhookUrl = providerId
    ? `${webhookBaseUrl}/api/payment/webhook/${providerId.toLowerCase()}`
    : "";

  const updateForm = (values: Partial<PaymentGatewayFormPayload>) => {
    setFormData((current) => ({ ...current, ...values }));
  };

  const handleTestConnection = async () => {
    if (!providerId) return;
    const result = await onTestConnection({
      provider: providerId,
      ...formData,
    });
    alert(
      result.success
        ? `Koneksi berhasil!\n\n${result.message ?? "Tidak ada detail tambahan."}`
        : `Koneksi gagal!\n\n${result.message ?? "Tidak ada detail tambahan."}`,
    );
  };

  const handleSave = async () => {
    if (!providerId) return;
    const result = await onSave(providerId, formData);
    if (result.success) {
      alert("Konfigurasi berhasil disimpan!");
      onClose();
      return;
    }
    alert(`Gagal menyimpan: ${result.message ?? "Tidak ada detail tambahan."}`);
  };

  return (
    <Modal
      isOpen={isOpen && providerId !== null}
      onClose={onClose}
      title={`Configure ${providerName}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              Environment
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Choose sandbox for testing, production for live payments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm ${!formData.isProduction ? "font-bold text-orange-600" : "text-gray-500"}`}
            >
              Sandbox
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <span className="sr-only">Toggle production mode</span>
              <input
                type="checkbox"
                checked={formData.isProduction}
                onChange={(event) =>
                  updateForm({ isProduction: event.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600" />
            </label>
            <span
              className={`text-sm ${formData.isProduction ? "font-bold text-green-600" : "text-gray-500"}`}
            >
              Production
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key / Server Key *
          </label>
          <input
            type="password"
            value={formData.apiKey}
            onChange={(event) => updateForm({ apiKey: event.target.value })}
            placeholder="Enter API key"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Secret (if applicable)
          </label>
          <input
            type="password"
            value={formData.apiSecret}
            onChange={(event) => updateForm({ apiSecret: event.target.value })}
            placeholder="Enter API secret"
            className={INPUT_CLASS}
          />
        </div>

        {providerId === "MIDTRANS" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Client Key
            </label>
            <input
              type="text"
              value={formData.clientKey}
              onChange={(event) =>
                updateForm({ clientKey: event.target.value })
              }
              placeholder="Enter client key"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {providerId && canUseMerchantCode(providerId) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Merchant Code *
            </label>
            <input
              type="text"
              value={formData.merchantId}
              onChange={(event) =>
                updateForm({ merchantId: event.target.value })
              }
              placeholder="Enter merchant code"
              className={INPUT_CLASS}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your unique merchant code from{" "}
              {getMerchantProviderName(providerId)} dashboard
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Priority: {formData.priority}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={formData.priority}
            onChange={(event) =>
              updateForm({ priority: Number.parseInt(event.target.value, 10) })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Higher priority = preferred for payments (1-10)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Webhook URL (Copy this to provider dashboard)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing || !formData.apiKey}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !formData.apiKey}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
