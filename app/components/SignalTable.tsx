import React from 'react';
import type { VegaSnapshot, SignalType } from '@/lib/vega/types';

interface SignalTableProps {
  data: VegaSnapshot[];
  loading?: boolean;
}

export default function SignalTable({ data, loading = false }: SignalTableProps) {
  if (loading && data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 h-full flex flex-col overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Time</th>
              <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Call Vega</th>
              <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Put Vega</th>
              <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Difference</th>
              <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Trend</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(15)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td colSpan={5} className="py-3">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const rows = [...data].reverse();

  const getTrendClasses = (signal: SignalType | string) => {
    let bgClass = 'bg-gray-500';
    if (signal.includes('Bullish')) bgClass = 'bg-[#16a34a]';
    if (signal.includes('Bearish')) bgClass = 'bg-[#dc2626]';
    return `inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold text-white ${bgClass}`;
  };

  const getTrendText = (signal: SignalType | string) => {
    if (signal.includes('Bullish')) return 'Bullish';
    if (signal.includes('Bearish')) return 'Bearish';
    if (signal === 'Zero Line Breakout') return 'Breakout';
    return 'Neutral';
  };

  return (
    <div className="bg-white border border-gray-200 h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-black text-white">
            <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap">Time</th>
            <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap text-right">Call Vega</th>
            <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap text-right">Put Vega</th>
            <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap text-right">Difference</th>
            <th className="p-2.5 text-[0.85rem] font-semibold whitespace-nowrap text-center">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-400">
                No history available.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr 
                key={row.id} 
                className={`border-b border-gray-100 hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}
              >
                <td className="p-2 text-[0.85rem] font-mono text-gray-700 whitespace-nowrap">
                  {new Date(row.captured_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </td>
                <td className="p-2 text-[0.85rem] font-mono text-gray-800 text-right">{row.call_vega.toFixed(2)}</td>
                <td className="p-2 text-[0.85rem] font-mono text-gray-800 text-right">{row.put_vega.toFixed(2)}</td>
                <td className="p-2 text-[0.85rem] font-mono text-gray-800 text-right">{row.difference.toFixed(2)}</td>
                <td className="p-2 text-[0.85rem] text-center">
                  <span className={getTrendClasses(row.signal)}>
                    {getTrendText(row.signal)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
