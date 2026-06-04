import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import {
  calculateVegaMetrics,
} from '@/lib/vega/vegaCalculator';
import type { OptionChainSnapshot } from '@/lib/vega/types';

/**
 * GET /api/vega/snapshots?symbol=NIFTY&limit=200
 *
 * Computes Vega metrics on-the-fly from option_chain_snapshots.
 * This approach doesn't require writing to vega_snapshots table,
 * making it work regardless of RLS policies.
 *
 * Returns computed vega data ready for charting.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'NIFTY';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // --- ON-DEMAND INGESTION (LAZY FETCH) ---
    try {
      const nseUrl = `https://www.nseindia.com/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=${symbol}&params=expiryDate=09-Jun-2026`;
      const nseRes = await fetch(nseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      if (nseRes.ok) {
        const nseData = await nseRes.json();
        if (nseData && nseData.data) {
          const niftySpot = nseData.underlyingValue || null;
          const now = new Date();
          now.setSeconds(0, 0);
          let capturedAt = now.toISOString();
          
          if (nseData.timestamp) {
            const [datePart, timePart] = nseData.timestamp.split(' ');
            if (datePart && timePart) {
              const [day, month, year] = datePart.split('-');
              const monthMap: Record<string, string> = { 'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12' };
              if (monthMap[month] && day && year) {
                capturedAt = `${year}-${monthMap[month]}-${day}T${timePart.substring(0, 5)}:00+05:30`;
              }
            }
          }

          // Check for redundancy to prevent duplicate timestamps
          const { data: existingData } = await supabase
            .from('option_chain_snapshots')
            .select('id')
            .eq('symbol', symbol)
            .eq('captured_at', capturedAt)
            .limit(1);

          if (!existingData || existingData.length === 0) {
            // Insert new record
            await supabase
              .from('option_chain_snapshots')
              .insert([
                {
                  captured_at: capturedAt,
                  symbol: symbol,
                  expiry_date: '2026-06-09',
                  nifty_spot: niftySpot,
                  option_chain_data: nseData
                }
              ]);
          }
        }
      }
    } catch (ingestErr) {
      console.error('Lazy ingestion failed:', ingestErr);
      // We do not fail the request if ingestion fails, we just serve stale data
    }
    // --- END ON-DEMAND INGESTION ---

    // First try vega_snapshots table
    let query = supabase
      .from('vega_snapshots')
      .select('*')
      .eq('symbol', symbol)
      .order('captured_at', { ascending: true })
      .limit(limit);

    if (from) query = query.gte('captured_at', from);
    if (to) query = query.lte('captured_at', to);

    const { data: vegaData } = await query;

    // If we have data in vega_snapshots, return it
    if (vegaData && vegaData.length > 0) {
      return NextResponse.json({ data: vegaData });
    }

    // Otherwise, compute from option_chain_snapshots on the fly
    let chainQuery = supabase
      .from('option_chain_snapshots')
      .select('id, symbol, captured_at, expiry_date, nifty_spot, option_chain_data')
      .eq('symbol', symbol)
      .order('captured_at', { ascending: true })
      .limit(limit);

    if (from) chainQuery = chainQuery.gte('captured_at', from);
    if (to) chainQuery = chainQuery.lte('captured_at', to);

    const { data: chainData, error } = await chainQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!chainData || chainData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Compute Vega for each snapshot
    const rawSnapshots = chainData as OptionChainSnapshot[];
    const snapshots = [];
    const seenMinutes = new Set();
    
    for (const snap of rawSnapshots) {
      const minuteKey = new Date(snap.captured_at).toISOString().substring(0, 16);
      if (!seenMinutes.has(minuteKey)) {
        seenMinutes.add(minuteKey);
        snapshots.push(snap);
      }
    }

    const computedData = [];

    // Track history for signal generation
    let prevCallVega: number | null = null;
    let prevPutVega: number | null = null;
    let prevDiff: number | null = null;

    // Track consecutive trends for strong signals
    const callVegaHistory: number[] = [];
    const putVegaHistory: number[] = [];
    const diffHistory: number[] = [];

    for (const snap of snapshots) {
      const metrics = calculateVegaMetrics(
        snap.option_chain_data,
        snap.nifty_spot,
        snap.expiry_date
      );

      // Momentum
      const callMomentum =
        prevCallVega !== null
          ? Math.round((metrics.callVega - prevCallVega) * 100) / 100
          : 0;
      const putMomentum =
        prevPutVega !== null
          ? Math.round((metrics.putVega - prevPutVega) * 100) / 100
          : 0;
      const diffMomentum =
        prevDiff !== null
          ? Math.round((metrics.difference - prevDiff) * 100) / 100
          : 0;

      // Track history
      callVegaHistory.push(metrics.callVega);
      putVegaHistory.push(metrics.putVega);
      diffHistory.push(metrics.difference);

      // Signal detection
      let signal = 'Neutral';
      let confidence = 30;

      const last3Call = callVegaHistory.slice(-3);
      const last3Put = putVegaHistory.slice(-3);
      const last3Diff = diffHistory.slice(-3);

      const isRising = (arr: number[]) =>
        arr.length >= 3 && arr[1] > arr[0] && arr[2] > arr[1];
      const isFalling = (arr: number[]) =>
        arr.length >= 3 && arr[1] < arr[0] && arr[2] < arr[1];

      // Zero Line Breakout
      if (
        prevCallVega !== null &&
        prevCallVega <= 0 &&
        metrics.callVega > 0 &&
        diffMomentum < 0
      ) {
        signal = 'Zero Line Breakout';
        confidence = Math.min(98, 60 + Math.abs(diffMomentum) * 2);
      } else if (
        prevPutVega !== null &&
        prevPutVega <= 0 &&
        metrics.putVega > 0 &&
        diffMomentum > 0
      ) {
        signal = 'Zero Line Breakout';
        confidence = Math.min(98, 60 + Math.abs(diffMomentum) * 2);
      }
      // Strong Bullish
      else if (isRising(last3Call) && isFalling(last3Diff)) {
        signal = 'Strong Bullish';
        confidence = Math.min(98, 75 + Math.abs(diffMomentum));
      }
      // Strong Bearish
      else if (isRising(last3Put) && isRising(last3Diff)) {
        signal = 'Strong Bearish';
        confidence = Math.min(98, 75 + Math.abs(diffMomentum));
      }
      // Bullish
      else if (callMomentum > 0 && diffMomentum < 0 && metrics.difference < 0) {
        signal = 'Bullish';
        confidence = Math.min(85, 55 + Math.abs(diffMomentum) * 1.5);
      }
      // Bearish
      else if (putMomentum > 0 && diffMomentum > 0 && metrics.difference > 0) {
        signal = 'Bearish';
        confidence = Math.min(85, 55 + Math.abs(diffMomentum) * 1.5);
      }

      computedData.push({
        id: snap.id,
        captured_at: snap.captured_at,
        symbol: snap.symbol,
        expiry_date: snap.expiry_date,
        spot_price: metrics.spotPrice,
        atm_strike: metrics.atmStrike,
        call_vega: metrics.callVega,
        put_vega: metrics.putVega,
        difference: metrics.difference,
        signal,
        confidence_score: Math.round(confidence),
      });

      prevCallVega = metrics.callVega;
      prevPutVega = metrics.putVega;
      prevDiff = metrics.difference;
    }

    return NextResponse.json({ data: computedData });
  } catch (err) {
    console.error('Snapshots error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
