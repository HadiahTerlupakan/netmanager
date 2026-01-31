import React from 'react';
import MapWrapper from '@/components/map/MapWrapper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Network Map | NetManager',
  description: 'Optical Network Mapping',
};

export default function MapPage() {
  return (
    <div className="h-full w-full">
      <MapWrapper />
    </div>
  );
}
