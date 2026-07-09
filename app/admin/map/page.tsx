import React from "react";
import MapWrapper from "@/components/map/MapWrapper";
import type { Metadata } from "next";
import { ensurePermission } from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Network Map | NetManager",
  description: "Optical Network Mapping",
};

export default async function MapPage() {
  await ensurePermission("map:read");
  return (
    <div className="h-full w-full">
      <MapWrapper />
    </div>
  );
}
