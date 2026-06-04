'use client';

import { useState, useEffect, useCallback } from 'react';
import type { VegaSnapshot, SignalType } from '@/lib/vega/types';
import SymbolSelector from './components/SymbolSelector';
import VegaCards from './components/VegaCards';
import VegaChart from './components/VegaChart';
import SignalTable from './components/SignalTable';

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY'];
const POLL_INTERVAL = 60_000; // 1 minute

export default function VegaDashboard() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [snapshots, setSnapshots] = useState<VegaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const snapshotsRes = await fetch(`/api/vega/snapshots?symbol=${symbol}&limit=50`);

      if (snapshotsRes.ok) {
        const snapshotsData = await snapshotsRes.json();
        setSnapshots(snapshotsData.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch Vega data:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchData();

    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derive latest metrics from most recent snapshot
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const callVega = latestSnapshot?.call_vega ?? 0;
  const putVega = latestSnapshot?.put_vega ?? 0;
  const difference = latestSnapshot?.difference ?? 0;
  const signal: SignalType = (latestSnapshot?.signal as SignalType) ?? 'Neutral';
  const confidence = latestSnapshot?.confidence_score ?? 0;

  return (
    <div className="ae-dashboard min-h-screen bg-[#f8fafc]">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* Logo placeholder - using text to mimic image */}
          <div className="text-[#16a34a] font-black text-2xl tracking-tighter flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.43 4 16.05 4 12C4 7.95 7.05 4.57 11 4.07V19.93ZM13 4.07C16.95 4.57 20 7.95 20 12C20 16.05 16.95 19.43 13 19.93V4.07Z" fill="currentColor"/>
            </svg>
            Alpha Edge
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-gray-700">
          <a href="#" className="hover:text-black">Chart</a>
          <a href="#" className="hover:text-black">My Account</a>
          <a href="#" className="hover:text-black">Logout</a>
          <a href="#" className="hover:text-black">Contact Us</a>
        </div>
      </nav>

      <div className="p-4 md:p-6 w-full max-w-[1600px] mx-auto">
        {/* Symbol Selection (added this below nav since original design was for 1 symbol) */}
        <div className="mb-6 flex items-center justify-end">
           <SymbolSelector
            symbols={SYMBOLS}
            activeSymbol={symbol}
            onSelect={setSymbol}
          />
        </div>

        {/* 2-Column Main Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Column (70%) */}
          <div className="w-full lg:w-[70%] flex flex-col gap-6">
            {/* Expiry Header */}
            <div>
              <h1 className="text-2xl font-bold text-black m-0">
                Expiry : {latestSnapshot?.expiry_date ?? 'Loading...'}
              </h1>
            </div>

            {/* Metric Cards */}
            <VegaCards
              callVega={callVega}
              putVega={putVega}
              difference={difference}
              signal={signal}
              confidence={confidence}
              loading={loading}
            />

            {/* Chart Area */}
            <div className="mt-2">
              <VegaChart data={snapshots} loading={loading} />
            </div>
          </div>

          {/* Right Column (30%) - Table */}
          <div className="w-full lg:w-[30%]">
            <SignalTable data={snapshots} loading={loading} />
          </div>

        </div>
      </div>
    </div>
  );
}
