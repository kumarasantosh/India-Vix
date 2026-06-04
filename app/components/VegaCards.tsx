import React from 'react';
import type { SignalType } from '@/lib/vega/types';

interface VegaCardsProps {
  callVega: number;
  putVega: number;
  difference: number;
  signal: SignalType;
  confidence: number;
  callMomentum?: number;
  putMomentum?: number;
  loading?: boolean;
}

export default function VegaCards({
  callVega,
  putVega,
  difference,
  loading = false,
}: VegaCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse bg-white border border-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Call Vega */}
      <div className="flex flex-col bg-white border border-gray-200 shadow-sm">
        <div className="px-3 py-2 text-white font-bold text-sm bg-[#16a34a]">Call Vega</div>
        <div className="p-3 text-lg text-gray-700">{callVega.toFixed(2)}</div>
      </div>

      {/* Put Vega */}
      <div className="flex flex-col bg-white border border-gray-200 shadow-sm">
        <div className="px-3 py-2 text-white font-bold text-sm bg-[#dc2626]">Put Vega</div>
        <div className="p-3 text-lg text-gray-700">{putVega.toFixed(2)}</div>
      </div>

      {/* Difference */}
      <div className="flex flex-col bg-white border border-gray-200 shadow-sm">
        <div className="px-3 py-2 text-white font-bold text-sm bg-black">Difference</div>
        <div className="p-3 text-lg text-gray-700">{difference.toFixed(2)}</div>
      </div>
    </div>
  );
}
