"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/hooks/useApi";

import { DeviceDetailModals } from "@/app/admin/network/acs/devices/components/DeviceDetailModals";
import { DeviceDetailPanels } from "@/app/admin/network/acs/devices/components/DeviceDetailPanels";
import type { DeviceDetail } from "@/app/admin/network/acs/devices/lib/acsDeviceTypes";

const REFRESH_DELAY_MS = 3000;

type ParamModalState = {
  isOpen: boolean;
  type: string;
  parameter: string;
  currentValue: string;
  title: string;
};

type ConfirmModalState = {
  isOpen: boolean;
  action: string;
  title: string;
  message: string;
};

type WanModalState = {
  isOpen: boolean;
  type: string;
  name: string;
  vlan: string;
  user: string;
  pass: string;
};

type SsidModalState = {
  isOpen: boolean;
  index: number;
  name: string;
  security: string;
  password: string;
  enabled: boolean;
};

export function DeviceDetailClient({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paramModal, setParamModal] = useState<ParamModalState>({
    isOpen: false,
    type: "",
    parameter: "",
    currentValue: "",
    title: "",
  });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    action: "",
    title: "",
    message: "",
  });
  const [wanModal, setWanModal] = useState<WanModalState>({
    isOpen: false,
    type: "pppoe",
    name: "",
    vlan: "",
    user: "",
    pass: "",
  });
  const [ssidModal, setSsidModal] = useState<SsidModalState>({
    isOpen: false,
    index: 1,
    name: "",
    security: "WPA/WPA2",
    password: "",
    enabled: true,
  });

  const {
    data: device,
    isLoading: loading,
    mutate: fetchDeviceDetail,
  } = useApi<DeviceDetail>(`/api/acs/devices/${encodeURIComponent(deviceId)}`, {
    onError: (err) => {
      showToast("error", err.message || "Gagal memuat detail perangkat");
      router.push("/admin/network/acs/devices");
    },
  });

  const executeTask = async (
    taskName: string,
    payload: Record<string, unknown> = {},
  ) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/acs/devices/${encodeURIComponent(deviceId)}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskName, ...payload }),
        },
      );
      const result = await res.json();
      if (result.success) {
        showToast("success", "Perintah berhasil dikirim ke perangkat!");
        setParamModal((prev) => ({ ...prev, isOpen: false }));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setWanModal((prev) => ({ ...prev, isOpen: false }));
        setSsidModal((prev) => ({ ...prev, isOpen: false }));
        setTimeout(() => {
          void fetchDeviceDetail();
        }, REFRESH_DELAY_MS);
      } else {
        showToast("error", result.error || "Gagal mengeksekusi perintah");
      }
    } catch (_e) {
      showToast("error", "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat Data Perangkat...</p>
        <p className="text-sm text-gray-400 mt-2">
          Mengambil data realtime dari GenieACS
        </p>
      </div>
    );
  }

  if (!device) return null;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12 relative z-0">
      <DeviceDetailModals
        isSubmitting={isSubmitting}
        wanModal={wanModal}
        ssidModal={ssidModal}
        paramModal={paramModal}
        confirmModal={confirmModal}
        setWanModal={setWanModal}
        setSsidModal={setSsidModal}
        setParamModal={setParamModal}
        setConfirmModal={setConfirmModal}
        onExecuteTask={(taskName, payload) => {
          void executeTask(taskName, payload);
        }}
        pppoeUsername={device.virtualParameters.pppoeUsername}
      />

      <DeviceDetailPanels
        device={device}
        onBack={() => router.back()}
        onRefresh={() => {
          void fetchDeviceDetail();
        }}
        onOpenRebootConfirm={() =>
          setConfirmModal({
            isOpen: true,
            action: "reboot",
            title: "Reboot Device",
            message:
              "Apakah Anda yakin ingin me-restart perangkat ini dari jarak jauh? Perangkat akan offline selama 1-3 menit.",
          })
        }
        onOpenFactoryResetConfirm={() =>
          setConfirmModal({
            isOpen: true,
            action: "factoryReset",
            title: "Factory Reset",
            message:
              "PERINGATAN BAHAYA: Apakah Anda yakin ingin mereset perangkat ini ke pengaturan pabrik? Semua konfigurasi pelanggan (termasuk PPPoE) akan terhapus dan perangkat harus dikonfigurasi ulang.",
          })
        }
        onOpenSsidModal={(index: number) => {
          const wlanData =
            index === 5 ? device.wifiInfo.wlan5 : device.wifiInfo.wlan1;
          setSsidModal({
            isOpen: true,
            index,
            name: wlanData.ssid || "",
            security: "WPA/WPA2",
            password: "",
            enabled: !!wlanData.enabled,
          });
        }}
        onOpenWanModal={() =>
          setWanModal({
            isOpen: true,
            type: "pppoe",
            name: "",
            vlan: "",
            user: device.virtualParameters.pppoeUsername || "",
            pass: "",
          })
        }
        onOpenAdminPasswordModal={() =>
          setParamModal({
            isOpen: true,
            type: "admin-pass",
            title: "Ganti Password Admin",
            parameter: "InternetGatewayDevice.UserInterface.Password",
            currentValue: "",
          })
        }
      />
    </div>
  );
}
