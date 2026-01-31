"use client";

import React from "react";
import { HiServer, HiCube, HiSquare3Stack3D, HiCpuChip } from "react-icons/hi2";

interface MapStatisticsProps {
  statistics: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  };
}

export function MapStatistics({ statistics }: MapStatisticsProps) {
  const stats = [
    {
      label: "OLT/Server",
      value: statistics.nodesByType["olt"] || statistics.nodesByType["server"] || 0,
      icon: <HiServer className="h-5 w-5" />,
      color: "bg-red-500",
      description: "Active nodes",
    },
    {
      label: "ODC",
      value: statistics.nodesByType["odc"] || 0,
      icon: <HiCube className="h-5 w-5" />,
      color: "bg-orange-500",
      description: "Distribution",
    },
    {
      label: "ODP",
      value: statistics.nodesByType["odp"] || 0,
      icon: <HiSquare3Stack3D className="h-5 w-5" />,
      color: "bg-blue-500",
      description: "Drop points",
    },
    {
      label: "ONT",
      value: statistics.nodesByType["ont"] || 0,
      icon: <HiCpuChip className="h-5 w-5" />,
      color: "bg-green-500",
      description: "Terminals",
    },
  ];

  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex gap-2 flex-wrap">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[90px] flex items-center gap-2"
        >
          <div className={`${stat.color} text-white p-2 rounded-lg`}>
            {stat.icon}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
