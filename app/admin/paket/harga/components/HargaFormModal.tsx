import Modal from "@/components/common/Modal";

import { PricingSummary } from "@/app/admin/paket/harga/components/PricingSummary";
import type {
  Bandwidth,
  DurationUnit,
  HargaFormData,
  HargaStatus,
  ProfilePPP,
  Site,
} from "@/app/admin/paket/harga/lib/hargaTypes";

type HargaFormModalProps = {
  open: boolean;
  editingPaketName: string | null;
  formData: HargaFormData;
  profilePPPs: ProfilePPP[];
  sites: Site[];
  bandwidths: Bandwidth[];
  pppConnectionMode: "RADIUS" | "MIKROTIK_API";
  onClose: () => void;
  onSubmit: (event: React.SubmitEvent) => void;
  onFieldChange: <K extends keyof HargaFormData>(
    field: K,
    value: HargaFormData[K],
  ) => void;
};

const DURATION_OPTIONS: DurationUnit[] = ["JAM", "HARI", "BULAN", "TAHUN"];
const STATUS_OPTIONS: HargaStatus[] = ["AKTIF", "NONAKTIF", "MAINTENANCE"];

export function HargaFormModal({
  open,
  editingPaketName,
  formData,
  profilePPPs,
  sites,
  bandwidths,
  pppConnectionMode,
  onClose,
  onSubmit,
  onFieldChange,
}: HargaFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingPaketName ? "Edit Paket" : "Tambah Paket"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Paket <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(event) => onFieldChange("name", event.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            placeholder="Contoh: Paket 10 Mbps"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Profile PPP <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.profilePPPId}
            onChange={(event) =>
              onFieldChange("profilePPPId", event.target.value)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="">-- Pilih Profile PPP --</option>
            {(profilePPPs || [])
              .filter((profile) => profile.status === "AKTIF")
              .map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
          </select>
        </div>

        {pppConnectionMode === "RADIUS" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bandwidth
            </label>
            <select
              value={formData.bandwidthId || ""}
              onChange={(event) =>
                onFieldChange("bandwidthId", event.target.value || null)
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
              Jika dipilih, rate limit akan mengikuti bandwidth ini. Jika
              kosong, akan menggunakan setting di Profile PPP.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Site
          </label>
          <select
            value={formData.siteId || ""}
            onChange={(event) =>
              onFieldChange("siteId", event.target.value || null)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            <option value="">-- Pilih Site (Opsional) --</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.code})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Harga (Rp) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.harga}
              onChange={(event) =>
                onFieldChange(
                  "harga",
                  event.target.value ? parseInt(event.target.value, 10) : 0,
                )
              }
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="300000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Durasi <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="1"
                value={formData.durasi}
                onChange={(event) => {
                  const value = parseInt(event.target.value, 10);
                  onFieldChange("durasi", Number.isNaN(value) ? 0 : value);
                }}
                className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="30"
              />
              <select
                required
                value={formData.durasiUnit}
                onChange={(event) =>
                  onFieldChange(
                    "durasiUnit",
                    event.target.value as DurationUnit,
                  )
                }
                className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                {DURATION_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit === "JAM"
                      ? "Jam"
                      : unit === "HARI"
                        ? "Hari"
                        : unit === "BULAN"
                          ? "Bulan"
                          : "Tahun"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="harga-use-ppn"
              checked={formData.usePPN}
              onChange={(event) =>
                onFieldChange("usePPN", event.target.checked)
              }
              className="rounded border-gray-300 dark:border-gray-700"
            />
            <label
              htmlFor="harga-use-ppn"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Gunakan PPN
            </label>
          </div>
          {formData.usePPN && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Persentase PPN (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required={formData.usePPN}
                min="0"
                max="100"
                step="0.01"
                value={formData.ppnPercentage || ""}
                onChange={(event) =>
                  onFieldChange(
                    "ppnPercentage",
                    event.target.value ? parseFloat(event.target.value) : null,
                  )
                }
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="11"
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="harga-use-discount"
              checked={formData.useDiscount}
              onChange={(event) =>
                onFieldChange("useDiscount", event.target.checked)
              }
              className="rounded border-gray-300 dark:border-gray-700"
            />
            <label
              htmlFor="harga-use-discount"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Gunakan Diskon
            </label>
          </div>
          {formData.useDiscount && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Jenis Diskon <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      value="FIXED"
                      checked={formData.discountType === "FIXED"}
                      onChange={(event) =>
                        onFieldChange(
                          "discountType",
                          event.target.value as "FIXED" | "PERCENT",
                        )
                      }
                      className="border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Fixed (Nominal Tetap)
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="discountType"
                      value="PERCENT"
                      checked={formData.discountType === "PERCENT"}
                      onChange={(event) =>
                        onFieldChange(
                          "discountType",
                          event.target.value as "FIXED" | "PERCENT",
                        )
                      }
                      className="border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Persen (%)
                    </span>
                  </label>
                </div>
              </div>
              {formData.discountType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nilai Diskon{" "}
                    {formData.discountType === "FIXED" ? "(Rp)" : "(%)"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required={formData.useDiscount}
                    min="0"
                    max={formData.discountType === "PERCENT" ? 100 : undefined}
                    step={formData.discountType === "PERCENT" ? "0.01" : "1"}
                    value={formData.discountValue || ""}
                    onChange={(event) =>
                      onFieldChange(
                        "discountValue",
                        event.target.value
                          ? parseFloat(event.target.value)
                          : null,
                      )
                    }
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder={
                      formData.discountType === "FIXED" ? "50000" : "10"
                    }
                  />
                </div>
              )}
              {formData.useDiscount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Durasi Diskon <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required={formData.useDiscount}
                      min="1"
                      value={formData.discountDuration || ""}
                      onChange={(event) =>
                        onFieldChange(
                          "discountDuration",
                          event.target.value
                            ? parseInt(event.target.value, 10)
                            : null,
                        )
                      }
                      className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      placeholder="30"
                    />
                    <select
                      required={formData.useDiscount}
                      value={formData.discountDurationUnit || ""}
                      onChange={(event) =>
                        onFieldChange(
                          "discountDurationUnit",
                          event.target.value as DurationUnit | null,
                        )
                      }
                      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="">-- Pilih Unit --</option>
                      {DURATION_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit === "JAM"
                            ? "Jam"
                            : unit === "HARI"
                              ? "Hari"
                              : unit === "BULAN"
                                ? "Bulan"
                                : "Tahun"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <PricingSummary mode="form" formData={formData} />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deskripsi
          </label>
          <textarea
            value={formData.description}
            onChange={(event) =>
              onFieldChange("description", event.target.value)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            rows={3}
            placeholder="Deskripsi paket"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="harga-featured"
            checked={formData.featured}
            onChange={(event) =>
              onFieldChange("featured", event.target.checked)
            }
            className="rounded border-gray-300 dark:border-gray-700"
          />
          <label
            htmlFor="harga-featured"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            Paket Unggulan
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(event) =>
              onFieldChange("status", event.target.value as HargaStatus)
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
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
            {editingPaketName ? "Update" : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
