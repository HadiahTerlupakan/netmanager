"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface OltCardItem {
  id: string;
  slotFrame: number;
  slot: number;
  cardType: string | null;
  ponCount: number;
  status: string;
  onuCount: number;
}

interface EditForm {
  cardType: string;
  ponCount: number;
  status: string;
}

export default function OltCardSection({
  oltId,
  vendor,
}: {
  oltId: string;
  vendor: string;
}) {
  const [cards, setCards] = useState<OltCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    cardType: "",
    ponCount: 8,
    status: "ACTIVE",
  });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/olt/devices/${oltId}/cards`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) {
          setCards(json.data);
        }
      } catch {
        if (!cancelled) setError("Gagal memuat data card");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [oltId, refreshKey]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/olt/devices/${oltId}/cards/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(
          `Berhasil sync ${json.data.synced} card (${json.data.mode})`,
        );
        setRefreshKey((k) => k + 1);
      } else {
        setError(json.error?.message ?? "Sync gagal");
      }
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (card: OltCardItem) => {
    setEditingId(card.id);
    setEditForm({
      cardType: card.cardType ?? "",
      ponCount: card.ponCount,
      status: card.status,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/olt/devices/${oltId}/cards/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardType: editForm.cardType || null,
          ponCount: editForm.ponCount,
          status: editForm.status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingId(null);
        setRefreshKey((k) => k + 1);
      } else {
        setError(json.error?.message ?? "Gagal update card");
      }
    } catch {
      setError("Gagal menghubungi server");
    }
  };

  const vendorSubtitle =
    vendor === "ZTE"
      ? "Sync via SNMP card table"
      : "Pizza-box, 1 card BUILTIN otomatis";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cards</CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {vendorSubtitle}
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync Cards"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
            {successMsg}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Memuat data card...</p>
        ) : cards.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Belum ada data card. Klik &quot;Sync Cards&quot; untuk mulai.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Frame
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Slot
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    PON Count
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Status
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    ONU
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr
                    key={card.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    {editingId === card.id ? (
                      <>
                        <td className="py-2 px-3 font-mono">
                          {card.slotFrame}
                        </td>
                        <td className="py-2 px-3 font-mono">{card.slot}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={editForm.cardType}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                cardType: e.target.value,
                              })
                            }
                            className="w-24 px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={editForm.ponCount}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                ponCount: parseInt(e.target.value) || 1,
                              })
                            }
                            min={1}
                            max={64}
                            className="w-16 px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                status: e.target.value,
                              })
                            }
                            className="px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="MAINTENANCE">MAINTENANCE</option>
                            <option value="OFFLINE">OFFLINE</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">{card.onuCount}</td>
                        <td className="py-2 px-3 space-x-1">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveEdit}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Batal
                          </Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 font-mono">
                          {card.slotFrame}
                        </td>
                        <td className="py-2 px-3 font-mono">{card.slot}</td>
                        <td className="py-2 px-3">{card.cardType ?? "-"}</td>
                        <td className="py-2 px-3">{card.ponCount}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              card.status === "ACTIVE"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : card.status === "MAINTENANCE"
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {card.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">{card.onuCount}</td>
                        <td className="py-2 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(card)}
                          >
                            Edit
                          </Button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
