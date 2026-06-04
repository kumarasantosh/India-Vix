import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/vega/signals?symbol=NIFTY&limit=50
 *
 * Returns signal events. Falls back to computing from snapshots API data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);

    // Try signal_events table first
    let query = supabase
      .from('signal_events')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (symbol) query = query.eq('symbol', symbol);

    const { data } = await query;

    if (data && data.length > 0) {
      return NextResponse.json({ data });
    }

    // Fallback: get computed data from the snapshots endpoint
    const origin = request.nextUrl.origin;
    const snapshotsRes = await fetch(
      `${origin}/api/vega/snapshots?symbol=${symbol || 'NIFTY'}&limit=${limit}`
    );

    if (snapshotsRes.ok) {
      const snapshotsData = await snapshotsRes.json();
      const snapshots = snapshotsData.data || [];

      // Filter only non-neutral signals and transform to signal_event format
      const signals = snapshots
        .filter((s: Record<string, string>) => s.signal && s.signal !== 'Neutral')
        .map((s: Record<string, unknown>) => ({
          id: s.id,
          symbol: s.symbol,
          expiry_date: s.expiry_date,
          signal_type: s.signal,
          signal_strength:
            (s.signal as string).includes('Strong') ? 'strong' : 'moderate',
          signal_reason: `Vega Difference: ${(s.difference as number)?.toFixed?.(2) ?? s.difference}. Call Vega: ${(s.call_vega as number)?.toFixed?.(2) ?? s.call_vega}, Put Vega: ${(s.put_vega as number)?.toFixed?.(2) ?? s.put_vega}`,
          spot_price: s.spot_price,
          generated_at: s.captured_at,
        }))
        .reverse() // Most recent first
        .slice(0, limit);

      return NextResponse.json({ data: signals });
    }

    return NextResponse.json({ data: [] });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
