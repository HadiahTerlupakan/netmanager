"use client";

import { Button } from "@/components/ui/Button";
import type { MappingNode } from "@/components/map/map-types";
import {
  HiMagnifyingGlass,
  HiServer,
  HiCube,
  HiSquare3Stack3D,
  HiCpuChip,
} from "react-icons/hi2";

interface NodeListTabProps {
  searchQuery: string;
  filteredNodes: MappingNode[];
  onSearchQueryChange: (value: string) => void;
  onManualAdd: (type: string) => void;
  onEditNode: (node: MappingNode) => void;
  onDeleteNode: (nodeId: string) => void;
  getNodeColor: (type: string) => string;
}

export function NodeListTab({
  searchQuery,
  filteredNodes,
  onSearchQueryChange,
  onManualAdd,
  onEditNode,
  onDeleteNode,
  getNodeColor,
}: NodeListTabProps) {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Node List
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Button
              onClick={() => onManualAdd("olt")}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
              title="Add Server/OLT"
            >
              <HiServer className="w-4 h-4 text-purple-500" />
              <span className="hidden sm:inline">OLT</span>
            </Button>
            <Button
              onClick={() => onManualAdd("odc")}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
              title="Add ODC"
            >
              <HiCube className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">ODC</span>
            </Button>
            <Button
              onClick={() => onManualAdd("odp")}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 flex items-center gap-1"
              title="Add ODP"
            >
              <HiSquare3Stack3D className="w-4 h-4 text-cyan-500" />
              <span className="hidden sm:inline">ODP</span>
            </Button>
            <Button
              onClick={() => onManualAdd("ont")}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
              title="Add ONT"
            >
              <HiCpuChip className="w-4 h-4 text-orange-500" />
              <span className="hidden sm:inline">ONT</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Capacity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Serial Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNodes.map((node) => (
              <tr
                key={node.nodeId}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {node.name}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  >
                    {node.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {node.capacity} ports
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                  {node.serialNumber || "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditNode(node)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteNode(node.nodeId)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
