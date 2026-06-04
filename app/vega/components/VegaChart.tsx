import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { VegaSnapshot } from '@/lib/vega/types';

interface VegaChartProps {
  data: VegaSnapshot[];
  loading?: boolean;
}

export default function VegaChart({ data, loading = false }: VegaChartProps) {
  if (loading && data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center border border-gray-200 bg-white">
        <span className="text-gray-400">Loading chart data...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center border border-gray-200 bg-white">
        <span className="text-gray-400">
          No Vega data available yet. Waiting for first calculation...
        </span>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = data.map((d) => {
    const time = new Date(d.captured_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return {
      time,
      CallVega: d.call_vega,
      PutVega: d.put_vega,
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-sm text-sm">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          <div className="flex flex-col gap-1">
            <p className="text-[#16a34a]">
              Call Vega: <span className="font-mono">{payload[0]?.value?.toFixed(2)}</span>
            </p>
            <p className="text-[#dc2626]">
              Put Vega: <span className="font-mono">{payload[1]?.value?.toFixed(2)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[500px] bg-white border border-gray-200 p-2">
      <div className="flex gap-2 mb-2 px-4 pt-2">
        <div className="bg-[#16a34a] text-white px-2 py-0.5 text-sm font-bold">Call Vega</div>
        <div className="bg-[#dc2626] text-white px-2 py-0.5 text-sm font-bold">Put Vega</div>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="CallVega"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#16a34a' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="PutVega"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#dc2626' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
