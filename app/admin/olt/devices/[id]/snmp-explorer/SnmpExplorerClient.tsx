"use client";

import { useState } from "react";
import Link from "next/link";

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

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/olt/devices/${oltId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Kembali
        </Link>
        <h1 className="text-2xl font-bold mt-1">SNMP Explorer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Walk OID tree untuk riset mapping vendor baru
        </p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={baseOid}
          onChange={(e) => setBaseOid(e.target.value)}
          placeholder="Base OID (e.g. 1.3.6.1.2.1.1)"
          className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleWalk}
          disabled={loading || !baseOid}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Walking..." : "Walk"}
        </button>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setBaseOid("1.3.6.1.2.1.1")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          System
        </button>
        <button
          onClick={() => setBaseOid("1.3.6.1.2.1.2")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          Interfaces
        </button>
        <button
          onClick={() => setBaseOid("1.3.6.1.4.1.3902")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          ZTE Enterprise
        </button>
        <button
          onClick={() => setBaseOid("1.3.6.1.4.1")}
          className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >
          All Enterprise
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b text-sm text-gray-600">
            {entries.length} entries found
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    OID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    <td
                      className="px-3 py-2 font-mono text-blue-700 cursor-pointer"
                      onClick={() => setBaseOid(entry.oid)}
                    >
                      {entry.oid}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {snmpTypeLabel(entry.type)}
                    </td>
                    <td className="px-3 py-2 font-mono break-all max-w-md">
                      {entry.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
