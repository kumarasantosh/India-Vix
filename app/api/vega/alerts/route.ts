import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/vega/alerts?symbol=NIFTY&limit=20
 *
 * Returns alert history. Falls back to generating alerts from computed signals.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 200);

    // Try alert_history table first
    let query = supabase
      .from('alert_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (symbol) query = query.eq('symbol', symbol);

    const { data } = await query;

    if (data && data.length > 0) {
      return NextResponse.json({ data });
    }

    // Fallback: generate alerts from computed snapshots
    const origin = request.nextUrl.origin;
    const snapshotsRes = await fetch(
      `${origin}/api/vega/snapshots?symbol=${symbol || 'NIFTY'}&limit=100`
    );

    if (snapshotsRes.ok) {
      const snapshotsData = await snapshotsRes.json();
      const snapshots = snapshotsData.data || [];

      const alerts = snapshots
        .filter((s: Record<string, string>) => s.signal && s.signal !== 'Neutral')
        .map((s: Record<string, unknown>) => {
          const sig = s.signal as string;
          const emoji = sig.includes('Bullish')
            ? '🟢'
            : sig.includes('Bearish')
              ? '🔴'
              : '⚡';

          return {
            id: s.id,
            symbol: s.symbol,
            alert_type: sig,
            message: [
              `${emoji} ${s.symbol} ${sig} Alert`,
              '',
              `Call Vega: ${(s.call_vega as number)?.toFixed?.(2) ?? s.call_vega}`,
              `Put Vega: ${(s.put_vega as number)?.toFixed?.(2) ?? s.put_vega}`,
              `Difference: ${(s.difference as number)?.toFixed?.(2) ?? s.difference}`,
              '',
              `Spot: ₹${Number(s.spot_price).toLocaleString('en-IN')}`,
              `Confidence: ${s.confidence_score}%`,
            ].join('\n'),
            status: 'stored',
            sent_at: s.captured_at,
            created_at: s.captured_at,
          };
        })
        .reverse()
        .slice(0, limit);

      return NextResponse.json({ data: alerts });
    }

    return NextResponse.json({ data: [] });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
