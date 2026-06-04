import { NextRequest, NextResponse } from 'next/server';
import { computeVegaForSymbol, fetchRecentOptionChains, calculateVegaMetrics } from '@/lib/vega/vegaCalculator';
import { runSignalEngine } from '@/lib/vega/signalEngine';
import { generateAlert } from '@/lib/vega/alertService';

/**
 * POST /api/vega/calculate?symbol=NIFTY&backfill=true
 *
 * Triggers the full Vega pipeline:
 *   1. Fetch latest option chain snapshot
 *   2. Compute aggregate Vega metrics (Black-Scholes from IV)
 *   3. Run signal engine (momentum + signal detection)
 *   4. Generate alerts
 *
 * If backfill=true, processes the last N historical snapshots too.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'NIFTY';
    const backfill = searchParams.get('backfill') === 'true';
    const backfillLimit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      200
    );

    if (backfill) {
      // Process multiple historical snapshots
      const snapshots = await fetchRecentOptionChains(symbol, backfillLimit);

      if (snapshots.length === 0) {
        return NextResponse.json(
          { error: `No option chain data found for ${symbol}` },
          { status: 404 }
        );
      }

      // Process oldest first so momentum calculations work correctly
      const reversed = [...snapshots].reverse();
      const results = [];

      for (const snapshot of reversed) {
        const metrics = calculateVegaMetrics(
          snapshot.option_chain_data,
          snapshot.nifty_spot,
          snapshot.expiry_date
        );

        const { snapshot: vegaSnapshot, signal, analysis } = await runSignalEngine(
          symbol,
          snapshot.expiry_date,
          metrics,
          snapshot.captured_at
        );

        // Generate alert for non-neutral signals
        let alert = null;
        if (analysis.signal !== 'Neutral') {
          alert = await generateAlert(symbol, analysis, metrics.spotPrice);
        }

        results.push({
          captured_at: snapshot.captured_at,
          metrics,
          signal: analysis.signal,
          confidence: analysis.confidence,
          stored: !!vegaSnapshot,
        });
      }

      return NextResponse.json({
        success: true,
        processed: results.length,
        data: results,
      });
    }

    // Single latest snapshot
    const result = await computeVegaForSymbol(symbol);

    if (!result) {
      return NextResponse.json(
        { error: `No option chain data found for ${symbol}` },
        { status: 404 }
      );
    }

    const { metrics, snapshot } = result;

    const { snapshot: vegaSnapshot, signal, analysis } = await runSignalEngine(
      symbol,
      snapshot.expiry_date,
      metrics,
      snapshot.captured_at
    );

    const alert = await generateAlert(symbol, analysis, metrics.spotPrice);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        vegaSnapshot,
        signal,
        analysis,
        alert,
      },
    });
  } catch (err) {
    console.error('Vega calculation failed:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}
