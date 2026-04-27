"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkOrderListItem } from "@/modules/work-order/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface EmployeeWorkOrderListProps {
  initialWorkOrders: WorkOrderListItem[];
}

export default function EmployeeWorkOrderList({
  initialWorkOrders,
}: EmployeeWorkOrderListProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
      case "CLOSED":
        return "success";
      case "IN_PROGRESS":
      case "ASSIGNED":
        return "warning";
      case "CANCELLED":
        return "error";
      default:
        return "default";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "URGENT":
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      default:
        return "default";
    }
  };

  if (initialWorkOrders.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-500">
          Tidak ada Work Order yang ditugaskan kepada Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {initialWorkOrders.map((wo) => (
        <Card
          key={wo.id}
          className="overflow-hidden hover:border-blue-300 transition-colors"
        >
          <CardContent className="p-0">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium text-gray-500">
                    {wo.workOrderNumber}
                  </span>
                  <Badge variant={getStatusVariant(wo.status)}>
                    {wo.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={getPriorityVariant(wo.priority)}>
                    {wo.priority}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {wo.scheduledDate
                    ? format(new Date(wo.scheduledDate), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })
                    : format(new Date(wo.createdAt), "dd MMM yyyy HH:mm", {
                        locale: id,
                      })}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {wo.title}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">Tipe:</span>{" "}
                    {wo.type.replace("_", " ")}
                  </div>
                  {wo.site && (
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Site:</span>{" "}
                      {wo.site.name}
                    </div>
                  )}
                  {wo.pelanggan && (
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Pelanggan:</span>{" "}
                      {wo.pelanggan.nama}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <a
                  href={`/karyawan/work-order/${wo.id}`}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Detail Work Order →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
