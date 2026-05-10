"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface AutoRejectSettings {
  autoRejectInsufficientQuota: boolean;
  autoRejectBackdate: boolean;
  autoRejectOverlap: boolean;
  autoRejectTooLong: boolean;
  autoRejectSakitNoDocument: boolean;
  autoRejectCutiNoAdvance: boolean;
  autoRejectTukarLiburNoDate: boolean;
  autoRejectBlackoutPeriod: boolean;
  maxDaysPerRequest: number;
  minAdvanceNoticeDays: number;
  sakitDocumentRequiredDays: number;
  blackoutPeriods: Array<{ start: string; end: string; reason: string }>;
  enableTimelineAutoReject: boolean;
  mendadakDeadlineHours: number;
  mendadakReminder1Hours: number;
  mendadakReminder2Hours: number;
  normalDeadlineDays: number;
  normalReminder1Days: number;
  normalReminder2Days: number;
  advanceDeadlineDays: number;
  advanceReminder1Days: number;
  advanceReminder2Days: number;
  advanceReminder3Days: number;
}

export default function AttendanceSettingsPage() {
  const [settings, setSettings] = useState<AutoRejectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/admin/attendance/settings");
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (_error) {
      toast.error("Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Pengaturan berhasil disimpan");
      } else {
        toast.error(result.error || "Gagal menyimpan pengaturan");
      }
    } catch (_error) {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Memuat pengaturan...</div>;
  }

  if (!settings) {
    return <div className="p-6">Gagal memuat pengaturan</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pengaturan Auto-Reject Izin</h1>

      {/* Validation Rules Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Aturan Validasi</h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectInsufficientQuota}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectInsufficientQuota: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject jika quota tidak cukup</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectBackdate}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectBackdate: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject jika tanggal sudah lewat (backdate)</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectOverlap}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectOverlap: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject jika overlap dengan izin lain</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectTooLong}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectTooLong: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject jika durasi terlalu panjang</span>
          </label>

          <div className="ml-7">
            <label className="block text-sm mb-1">
              Maksimal hari per pengajuan:
            </label>
            <input
              type="number"
              value={settings.maxDaysPerRequest}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxDaysPerRequest: parseInt(e.target.value),
                })
              }
              className="border rounded px-3 py-2 w-32"
              min="1"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectSakitNoDocument}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectSakitNoDocument: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject sakit tanpa surat dokter</span>
          </label>

          <div className="ml-7">
            <label className="block text-sm mb-1">
              Wajib surat dokter jika sakit lebih dari (hari):
            </label>
            <input
              type="number"
              value={settings.sakitDocumentRequiredDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  sakitDocumentRequiredDays: parseInt(e.target.value),
                })
              }
              className="border rounded px-3 py-2 w-32"
              min="1"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectCutiNoAdvance}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectCutiNoAdvance: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject cuti tanpa advance notice</span>
          </label>

          <div className="ml-7">
            <label className="block text-sm mb-1">
              Minimal advance notice (hari):
            </label>
            <input
              type="number"
              value={settings.minAdvanceNoticeDays}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minAdvanceNoticeDays: parseInt(e.target.value),
                })
              }
              className="border rounded px-3 py-2 w-32"
              min="1"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectTukarLiburNoDate}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectTukarLiburNoDate: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject tukar libur tanpa tanggal pengganti</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoRejectBlackoutPeriod}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoRejectBlackoutPeriod: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <span>Auto-reject pada periode blackout</span>
          </label>
        </div>
      </div>

      {/* Timeline Auto-Reject Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Timeline Auto-Reject</h2>

        <label className="flex items-center gap-3 mb-6">
          <input
            type="checkbox"
            checked={settings.enableTimelineAutoReject}
            onChange={(e) =>
              setSettings({
                ...settings,
                enableTimelineAutoReject: e.target.checked,
              })
            }
            className="w-4 h-4"
          />
          <span className="font-medium">Aktifkan Timeline Auto-Reject</span>
        </label>

        {settings.enableTimelineAutoReject && (
          <div className="space-y-6">
            {/* Mendadak */}
            <div className="border-l-4 border-red-500 pl-4">
              <h3 className="font-semibold mb-3">Mendadak (&lt; 24 jam)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Deadline (jam):</label>
                  <input
                    type="number"
                    value={settings.mendadakDeadlineHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mendadakDeadlineHours: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 1 (jam):
                  </label>
                  <input
                    type="number"
                    value={settings.mendadakReminder1Hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mendadakReminder1Hours: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 2 (jam):
                  </label>
                  <input
                    type="number"
                    value={settings.mendadakReminder2Hours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        mendadakReminder2Hours: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Normal */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold mb-3">Normal (1-7 hari)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Deadline (H-X):</label>
                  <input
                    type="number"
                    value={settings.normalDeadlineDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        normalDeadlineDays: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 1 (H-X):
                  </label>
                  <input
                    type="number"
                    value={settings.normalReminder1Days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        normalReminder1Days: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 2 (H-X):
                  </label>
                  <input
                    type="number"
                    value={settings.normalReminder2Days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        normalReminder2Days: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Advance */}
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold mb-3">Advance (&gt; 7 hari)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Deadline (H-X):</label>
                  <input
                    type="number"
                    value={settings.advanceDeadlineDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        advanceDeadlineDays: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 1 (H-X):
                  </label>
                  <input
                    type="number"
                    value={settings.advanceReminder1Days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        advanceReminder1Days: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 2 (H-X):
                  </label>
                  <input
                    type="number"
                    value={settings.advanceReminder2Days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        advanceReminder2Days: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Reminder 3 (H-X):
                  </label>
                  <input
                    type="number"
                    value={settings.advanceReminder3Days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        advanceReminder3Days: parseInt(e.target.value),
                      })
                    }
                    className="border rounded px-3 py-2 w-full"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
    </div>
  );
}
