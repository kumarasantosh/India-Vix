import { supabase } from '@/lib/supabaseClient';
import type {
  VegaMetrics,
  VegaMomentum,
  VegaSnapshot,
  SignalEvent,
  SignalAnalysis,
  SignalType,
  SignalStrength,
  PCRData,
} from './types';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function isRising(values: number[]): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) return false;
  }
  return true;
}

function isFalling(values: number[]): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] >= values[i - 1]) return false;
  }
  return true;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ──────────────────────────────────────────────
// Fetch historical Vega snapshots
// ──────────────────────────────────────────────

export async function fetchRecentVegaSnapshots(
  symbol: string,
  limit = 5
): Promise<VegaSnapshot[]> {
  const { data, error } = await supabase
    .from('vega_snapshots')
    .select('*')
    .eq('symbol', symbol)
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch vega snapshots:', error.message);
    return [];
  }

  return (data ?? []) as VegaSnapshot[];
}

// ──────────────────────────────────────────────
// Fetch latest PCR
// ──────────────────────────────────────────────

export async function fetchLatestPCR(symbol: string): Promise<PCRData | null> {
  const { data, error } = await supabase
    .from('pcr_data')
    .select('*')
    .eq('index_name', symbol)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as PCRData;
}

// ──────────────────────────────────────────────
// Momentum calculation
// ──────────────────────────────────────────────

export function calculateMomentum(
  current: VegaMetrics,
  previous: VegaSnapshot | null
): VegaMomentum {
  if (!previous) {
    return { callVegaMomentum: 0, putVegaMomentum: 0, differenceMomentum: 0 };
  }

  return {
    callVegaMomentum:
      Math.round((current.callVega - previous.call_vega) * 100) / 100,
    putVegaMomentum:
      Math.round((current.putVega - previous.put_vega) * 100) / 100,
    differenceMomentum:
      Math.round((current.difference - previous.difference) * 100) / 100,
  };
}

// ──────────────────────────────────────────────
// Signal detection
// ──────────────────────────────────────────────

export function detectSignal(
  current: VegaMetrics,
  history: VegaSnapshot[],
  pcr: PCRData | null,
  momentum: VegaMomentum
): SignalAnalysis {
  // Build value arrays (oldest → newest) for consecutive-sample checks
  const callVegas = [...history.map((h) => h.call_vega).reverse(), current.callVega];
  const putVegas = [...history.map((h) => h.put_vega).reverse(), current.putVega];
  const diffs = [...history.map((h) => h.difference).reverse(), current.difference];

  const last3CallVegas = callVegas.slice(-3);
  const last3PutVegas = putVegas.slice(-3);
  const last3Diffs = diffs.slice(-3);

  const pcrValue = pcr?.pcr_value ?? 1;
  const prevSnapshot = history.length > 0 ? history[0] : null;

  // ── Zero Line Breakout ──
  if (prevSnapshot) {
    // Bullish Zero Line Bounce: Call Vega was ≤ 0, now positive, Difference falling
    if (
      prevSnapshot.call_vega <= 0 &&
      current.callVega > 0 &&
      momentum.differenceMomentum < 0
    ) {
      const confidence = clamp(
        60 + Math.abs(momentum.differenceMomentum) * 2 + (pcrValue > 1 ? 10 : 0),
        50,
        98
      );
      return {
        signal: 'Zero Line Breakout',
        strength: 'strong',
        confidence,
        reason: `Call Vega crossed above zero (${prevSnapshot.call_vega.toFixed(2)} → ${current.callVega.toFixed(2)}). Vega Difference expanded negatively (Δ ${momentum.differenceMomentum.toFixed(2)}).`,
      };
    }

    // Bearish Zero Line Bounce: Put Vega was ≤ 0, now positive, Difference rising
    if (
      prevSnapshot.put_vega <= 0 &&
      current.putVega > 0 &&
      momentum.differenceMomentum > 0
    ) {
      const confidence = clamp(
        60 + Math.abs(momentum.differenceMomentum) * 2 + (pcrValue < 1 ? 10 : 0),
        50,
        98
      );
      return {
        signal: 'Zero Line Breakout',
        strength: 'strong',
        confidence,
        reason: `Put Vega crossed above zero (${prevSnapshot.put_vega.toFixed(2)} → ${current.putVega.toFixed(2)}). Vega Difference expanded positively (Δ +${momentum.differenceMomentum.toFixed(2)}).`,
      };
    }
  }

  // ── Strong Bullish ──
  if (
    last3CallVegas.length >= 3 &&
    isRising(last3CallVegas) &&
    isFalling(last3Diffs) &&
    pcrValue > 1
  ) {
    const confidence = clamp(
      75 + Math.abs(momentum.differenceMomentum) + (pcrValue - 1) * 20,
      70,
      98
    );
    return {
      signal: 'Strong Bullish',
      strength: 'strong',
      confidence,
      reason: `Call Vega rising 3 consecutive samples. Difference falling 3 samples. PCR = ${pcrValue.toFixed(2)} (> 1).`,
    };
  }

  // ── Strong Bearish ──
  if (
    last3PutVegas.length >= 3 &&
    isRising(last3PutVegas) &&
    isRising(last3Diffs) &&
    pcrValue < 1
  ) {
    const confidence = clamp(
      75 + Math.abs(momentum.differenceMomentum) + (1 - pcrValue) * 20,
      70,
      98
    );
    return {
      signal: 'Strong Bearish',
      strength: 'strong',
      confidence,
      reason: `Put Vega rising 3 consecutive samples. Difference rising 3 samples. PCR = ${pcrValue.toFixed(2)} (< 1).`,
    };
  }

  // ── Bullish ──
  if (
    momentum.callVegaMomentum > 0 &&
    momentum.differenceMomentum < 0 &&
    current.difference < 0
  ) {
    const confidence = clamp(
      55 + Math.abs(momentum.differenceMomentum) * 1.5 + (pcrValue > 1 ? 8 : 0),
      45,
      85
    );
    return {
      signal: 'Bullish',
      strength: 'moderate',
      confidence,
      reason: `Call Vega increasing (Δ +${momentum.callVegaMomentum.toFixed(2)}). Difference = ${current.difference.toFixed(2)} (below zero, falling).`,
    };
  }

  // ── Bearish ──
  if (
    momentum.putVegaMomentum > 0 &&
    momentum.differenceMomentum > 0 &&
    current.difference > 0
  ) {
    const confidence = clamp(
      55 + Math.abs(momentum.differenceMomentum) * 1.5 + (pcrValue < 1 ? 8 : 0),
      45,
      85
    );
    return {
      signal: 'Bearish',
      strength: 'moderate',
      confidence,
      reason: `Put Vega increasing (Δ +${momentum.putVegaMomentum.toFixed(2)}). Difference = ${current.difference.toFixed(2)} (above zero, rising).`,
    };
  }

  // ── Neutral ──
  return {
    signal: 'Neutral',
    strength: 'weak',
    confidence: 30,
    reason: 'No clear directional bias detected in Vega flow.',
  };
}

// ──────────────────────────────────────────────
// Persist results
// ──────────────────────────────────────────────

export async function storeVegaSnapshot(
  snapshot: Omit<VegaSnapshot, 'id' | 'created_at'>
): Promise<VegaSnapshot | null> {
  const { data, error } = await supabase
    .from('vega_snapshots')
    .insert(snapshot)
    .select()
    .single();

  if (error) {
    console.error('Failed to store vega snapshot:', error.message);
    return null;
  }
  return data as VegaSnapshot;
}

export async function storeSignalEvent(
  event: Omit<SignalEvent, 'id' | 'created_at'>
): Promise<SignalEvent | null> {
  const { data, error } = await supabase
    .from('signal_events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error('Failed to store signal event:', error.message);
    return null;
  }
  return data as SignalEvent;
}

// ──────────────────────────────────────────────
// Main orchestrator
// ──────────────────────────────────────────────

export async function runSignalEngine(
  symbol: string,
  expiryDate: string,
  metrics: VegaMetrics,
  capturedAt: string
): Promise<{
  snapshot: VegaSnapshot | null;
  signal: SignalEvent | null;
  analysis: SignalAnalysis;
}> {
  // 1. Fetch history
  const history = await fetchRecentVegaSnapshots(symbol, 5);
  const prevSnapshot = history.length > 0 ? history[0] : null;

  // 2. Momentum
  const momentum = calculateMomentum(metrics, prevSnapshot);

  // 3. PCR
  const pcr = await fetchLatestPCR(symbol);

  // 4. Signal detection
  const analysis = detectSignal(metrics, history, pcr, momentum);

  // 5. Store vega snapshot
  const vegaSnapshotRow: Omit<VegaSnapshot, 'id' | 'created_at'> = {
    captured_at: capturedAt,
    symbol,
    expiry_date: expiryDate,
    spot_price: metrics.spotPrice,
    atm_strike: metrics.atmStrike,
    call_vega: metrics.callVega,
    put_vega: metrics.putVega,
    difference: metrics.difference,
    signal: analysis.signal,
    confidence_score: Math.round(analysis.confidence),
  };

  const storedSnapshot = await storeVegaSnapshot(vegaSnapshotRow);

  // 6. Store signal event (skip Neutral — not worth logging)
  let storedSignal: SignalEvent | null = null;
  if (analysis.signal !== 'Neutral') {
    const signalRow: Omit<SignalEvent, 'id' | 'created_at'> = {
      symbol,
      expiry_date: expiryDate,
      signal_type: analysis.signal,
      signal_strength: analysis.strength,
      signal_reason: analysis.reason,
      spot_price: metrics.spotPrice,
      generated_at: capturedAt,
    };
    storedSignal = await storeSignalEvent(signalRow);
  }

  return { snapshot: storedSnapshot, signal: storedSignal, analysis };
}
