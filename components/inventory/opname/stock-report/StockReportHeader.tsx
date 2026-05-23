"use client";

import {
  FiCheckCircle,
  FiAlertTriangle,
  FiMapPin,
  FiMinusCircle,
  FiXCircle,
} from "react-icons/fi";

import type { GudangStock } from "./useStockReport";

type StockReportHeaderProps = {
  gudangData: GudangStock;
};

export function StockReportHeader({ gudangData }: StockReportHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow p-6 text-white">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-white/20 rounded-lg">
          <FiMapPin className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold">
            {gudangData.gudangKode} - {gudangData.gudangNama}
          </h3>
          <p className="text-blue-100">
            {gudangData.gudangLokasi || "Lokasi tidak diset"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Jenis Barang" value={gudangData.totalBarang} />
        <SummaryCard label="Total Stok" value={gudangData.totalStok} />
        <SummaryCard
          label="Stok Baru"
          value={gudangData.totalStokBaru}
          icon={<FiCheckCircle className="mr-1" />}
          valueClass="text-green-300"
        />
        <SummaryCard
          label="Stok Bekas"
          value={gudangData.totalStokBekas}
          icon={<FiAlertTriangle className="mr-1" />}
          valueClass="text-yellow-300"
        />
        <SummaryCard
          label="Stok Rusak"
          value={gudangData.totalStokRusak}
          icon={<FiXCircle className="mr-1" />}
          valueClass="text-red-300"
        />
        <SummaryCard
          label="Barang Hilang"
          value={gudangData.totalHilang}
          icon={<FiMinusCircle className="mr-1" />}
          valueClass="text-purple-300"
        />
      </div>
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: number;
  icon?: React.ReactNode;
  valueClass?: string;
};

function SummaryCard({ label, value, icon, valueClass }: SummaryCardProps) {
  return (
    <div className="bg-white/10 rounded-lg p-4">
      <p className="text-blue-100 text-sm flex items-center">
        {icon}
        {label}
      </p>
      <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}
