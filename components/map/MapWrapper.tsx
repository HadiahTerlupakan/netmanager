"use client";

import dynamic from "next/dynamic";
import React from "react";

const NetworkMap = dynamic(() => import("./NetworkMap"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center"><p>Loading Map...</p></div>
});

export default function MapWrapper() {
  return <NetworkMap />;
}
