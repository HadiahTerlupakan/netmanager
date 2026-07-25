import Modal from "@/components/common/Modal";
import { SiteFilter } from "@/components/common/SiteFilter";

import type {
  Bandwidth,
  MikroTikRouter,
  ProfilePppFormData,
} from "@/app/admin/paket/profileppp/lib/profilePppTypes";

type ProfilePppFormModalProps = {
  open: boolean;
  editingProfileName: string | null;
  formData: ProfilePppFormData;
  mikroTikRouters: MikroTikRouter[];
  bandwidths: Bandwidth[];
  pppConnectionMode: "RADIUS" | "MIKROTIK_API";
  onClose: () => void;
  onSubmit: (event: React.SubmitEvent) => void;
  onFieldChange: <K extends keyof ProfilePppFormData>(
    field: K,
    value: ProfilePppFormData[K],
  ) => void;
};

export function ProfilePppFormModal({
  open,
  editingProfileName,
  formData,
  mikroTikRouters,
  bandwidths,
  pppConnectionMode,
  onClose,
  onSubmit,
  onFieldChange,
}: ProfilePppFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingProfileName ? "Edit Profile PPP" : "Tambah Profile PPP"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="profileppp-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nama Profile <span className="text-red-500">*</span>
          </label>
          <input
            id="profileppp-name"
            type="text"
            required
            value={formData.name}
            onChange={(event) => {
              const newName = event.target.value;
              onFieldChange("name", newName);
              onFieldChange("remoteAddress", newName);
            }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: Profile-10M"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Nama Profile akan digunakan sebagai nama IP Pool di MikroTik
          </p>
        </div>

        <div>
          <SiteFilter
            value={formData.siteId}
            onSiteChange={(id) => onFieldChange("siteId", id || "")}
            isInput
            resource="profileppp"
            className="mb-0"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profileppp-local-address"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Local Address <span className="text-red-500">*</span>
            </label>
            <input
              id="profileppp-local-address"
              type="text"
              required
              value={formData.localAddress}
              onChange={(event) =>
                onFieldChange("localAddress", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="192.168.1.1"
            />
          </div>

          <div>
            <label
              htmlFor="profileppp-remote-address"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {formData.poolMode === "RADIUS"
                ? "Pool Name (RADIUS)"
                : "Remote Address (Nama IP Pool)"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              id="profileppp-remote-address"
              type="text"
              required
              value={formData.remoteAddress}
              readOnly
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm cursor-not-allowed"
              placeholder="Otomatis sama dengan Nama Profile"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.poolMode === "RADIUS"
                ? "Pool Name untuk sqlippool FreeRADIUS (otomatis dari Nama Profile)"
                : "Otomatis sama dengan Nama Profile (IP Pool akan dibuat dengan nama ini di MikroTik)"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profileppp-ip-range-start"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Range IP Awal{" "}
              {formData.poolMode !== "RADIUS" && (
                <span className="text-gray-400">(opsional)</span>
              )}
              {formData.poolMode === "RADIUS" && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              id="profileppp-ip-range-start"
              type="text"
              value={formData.ipRangeStart}
              required={formData.poolMode === "RADIUS"}
              onChange={(event) =>
                onFieldChange("ipRangeStart", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="10.10.10.2"
            />
          </div>

          <div>
            <label
              htmlFor="profileppp-ip-range-end"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Range IP Akhir{" "}
              {formData.poolMode !== "RADIUS" && (
                <span className="text-gray-400">(opsional)</span>
              )}
              {formData.poolMode === "RADIUS" && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              id="profileppp-ip-range-end"
              type="text"
              value={formData.ipRangeEnd}
              required={formData.poolMode === "RADIUS"}
              onChange={(event) =>
                onFieldChange("ipRangeEnd", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="10.10.10.254"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          {formData.poolMode === "RADIUS"
            ? "Range IP untuk pool sqlippool FreeRADIUS. Akan disinkronkan ke tabel radippool."
            : "Range IP untuk pool MikroTik. Jika dikosongkan, IP Pool harus sudah ada di router."}
        </p>

        {pppConnectionMode === "RADIUS" && (
          <div>
            <label
              htmlFor="profileppp-pool-mode"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Mode IP Pool <span className="text-red-500">*</span>
            </label>
            <select
              id="profileppp-pool-mode"
              value={formData.poolMode}
              onChange={(event) =>
                onFieldChange(
                  "poolMode",
                  event.target.value as "MIKROTIK" | "RADIUS",
                )
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="MIKROTIK">MIKROTIK (Pool ada di Router)</option>
              <option value="RADIUS">
                RADIUS (Pool dikelola di Database RADIUS)
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Pilih di mana IP Pool dikelola. Mode RADIUS membutuhkan
              konfigurasi tabel radippool.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="profileppp-dns"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            DNS Server
          </label>
          <input
            id="profileppp-dns"
            type="text"
            value={formData.dnsServer}
            onChange={(event) => onFieldChange("dnsServer", event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="8.8.8.8,8.8.4.4"
          />
        </div>

        <div>
          <label
            htmlFor="profileppp-router"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Target MikroTik Router
          </label>
          <select
            id="profileppp-router"
            value={formData.mikroTikRouterId}
            onChange={(event) =>
              onFieldChange("mikroTikRouterId", event.target.value)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="">-- Pilih Router MikroTik --</option>
            {mikroTikRouters
              .filter(
                (router) =>
                  !formData.siteId ||
                  !router.siteId ||
                  router.siteId === formData.siteId,
              )
              .map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name} ({router.ipAddress})
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Pilih router MikroTik sebagai target untuk profile ini
          </p>
        </div>

        {pppConnectionMode === "MIKROTIK_API" && (
          <div>
            <label
              htmlFor="profileppp-bandwidth"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Bandwidth (untuk Rate Limit)
            </label>
            <select
              id="profileppp-bandwidth"
              value={formData.bandwidthId}
              onChange={(event) =>
                onFieldChange("bandwidthId", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Bandwidth (Opsional) --</option>
              {bandwidths.map((bandwidth) => (
                <option key={bandwidth.id} value={bandwidth.id}>
                  {bandwidth.name} ({bandwidth.maxLimitDownload}/
                  {bandwidth.maxLimitUpload})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Pilih Bandwidth untuk rate limit. Jika tidak dipilih, rate limit
              akan diambil dari HargaPaket yang terkait.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="profileppp-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Deskripsi
          </label>
          <textarea
            id="profileppp-description"
            value={formData.description}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            rows={3}
            placeholder="Deskripsi profile PPP"
          />
        </div>

        <div>
          <label
            htmlFor="profileppp-status"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Status
          </label>
          <select
            id="profileppp-status"
            value={formData.status}
            onChange={(event) =>
              onFieldChange(
                "status",
                event.target.value as "AKTIF" | "NONAKTIF" | "MAINTENANCE",
              )
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="AKTIF">AKTIF</option>
            <option value="NONAKTIF">NONAKTIF</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {editingProfileName ? "Update" : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
