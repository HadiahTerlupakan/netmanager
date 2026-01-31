"use client";

import dynamic from "next/dynamic";
import React from "react";

const NetworkMapInteractive = dynamic(() => import("./NetworkMapInteractive"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  ),
});

export default function MapWrapper() {
  return <NetworkMapInteractive />;
}
