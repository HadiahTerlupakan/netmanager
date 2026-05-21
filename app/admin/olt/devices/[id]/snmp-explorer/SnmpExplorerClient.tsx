"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface OidEntry {
  oid: string;
  type: number;
  value: string;
}

export default function SnmpExplorerClient({ oltId }: { oltId: string }) {
  const [baseOid, setBaseOid] = useState("1.3.6.1.2.1.1");
  const [entries, setEntries] = useState<OidEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleWalk = async () => {
    setLoading(true);
    setError("");
    setEntries([]);
    try {
      const res = await fetch(`/api/olt/devices/${oltId}/snmp-walk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: baseOid }),
      });
      const json = await res.json();
      if (json.success) {
        setEntries(json.data.entries);
        if (json.data.error) setError(json.data.error);
      }
    } catch {
      setError("Request gagal");
    } finally {
      setLoading(false);
    }
  };

  const snmpTypeLabel = (type: number) => {
    const types: Record<number, string> = {
      2: "INTEGER",
      4: "OCTET STRING",
      6: "OID",
      64: "IpAddress",
      65: "Counter32",
      66: "Gauge32",
      67: "TimeTicks",
      70: "Counter64",
    };
    return types[type] ?? `Type(${type})`;
  };

  const quickAccessOids = [
    { label: "System", oid: "1.3.6.1.2.1.1" },
    { label: "Interfaces", oid: "1.3.6.1.2.1.2" },
    { label: "ZTE Enterprise", oid: "1.3.6.1.4.1.3902" },
    { label: "All Enterprise", oid: "1.3.6.1.4.1" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/admin/olt/devices/${oltId}`}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          &larr; Kembali
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          SNMP Explorer
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Walk OID tree untuk riset mapping vendor baru
        </p>
      </div>

      {/* Walk Input */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={baseOid}
              onChange={(e) => setBaseOid(e.target.value)}
              placeholder="Base OID (e.g. 1.3.6.1.2.1.1)"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              onClick={handleWalk}
              disabled={!baseOid}
              loading={loading}
              variant="default"
            >
              Walk
            </Button>
          </div>

          {/* Quick Access Buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            {quickAccessOids.map((item) => (
              <Button
                key={item.oid}
                variant="ghost"
                size="sm"
                onClick={() => setBaseOid(item.oid)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hasil Walk ({entries.length} entries)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                      OID
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-24">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {entries.map((entry, i) => (
                    <tr
                      key={i}
                      className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10"
                    >
                      <td
                        className="px-3 py-2 font-mono text-indigo-700 dark:text-indigo-400 cursor-pointer hover:underline"
                        onClick={() => setBaseOid(entry.oid)}
                      >
                        {entry.oid}
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                        {snmpTypeLabel(entry.type)}
                      </td>
                      <td className="px-3 py-2 font-mono break-all max-w-md text-gray-900 dark:text-white">
                        {entry.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
