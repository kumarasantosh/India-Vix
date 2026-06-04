import { supabase } from '@/lib/supabaseClient';
import type { OptionChainSnapshot, OptionStrikeData, VegaMetrics } from './types';

// ──────────────────────────────────────────────
// Black-Scholes Vega Calculation
// ──────────────────────────────────────────────

/**
 * Standard normal probability density function (PDF).
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution function (CDF).
 * Approximation using Abramowitz & Stegun formula 26.2.17.
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate Black-Scholes Vega for a single option.
 *
 * Vega = S * √T * N'(d1)
 *
 * Where:
 *   S = spot price
 *   K = strike price
 *   T = time to expiry in years
 *   σ = implied volatility (as decimal, e.g. 0.15 for 15%)
 *   r = risk-free rate (assumed 0.07 for India)
 *   d1 = [ln(S/K) + (r + σ²/2) * T] / (σ * √T)
 *
 * Vega is the same for both Call and Put options.
 * Returns Vega per 1% change in IV (divided by 100).
 */
function calculateBlackScholesVega(
  spotPrice: number,
  strikePrice: number,
  timeToExpiry: number, // in years
  iv: number, // as percentage (e.g. 15.63)
  riskFreeRate: number = 0.07
): number {
  if (timeToExpiry <= 0 || iv <= 0 || spotPrice <= 0 || strikePrice <= 0) {
    return 0;
  }

  const sigma = iv / 100; // Convert from percentage to decimal
  const sqrtT = Math.sqrt(timeToExpiry);
  const d1 =
    (Math.log(spotPrice / strikePrice) +
      (riskFreeRate + (sigma * sigma) / 2) * timeToExpiry) /
    (sigma * sqrtT);

  // Vega = S * √T * N'(d1) / 100 (per 1% IV change)
  const vega = (spotPrice * sqrtT * normalPDF(d1)) / 100;

  return Math.round(vega * 10000) / 10000; // Round to 4 decimals
}

/**
 * Calculate time to expiry in years from expiry date string.
 */
function calculateTimeToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate + 'T15:30:00+05:30'); // IST market close
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 0.0001; // Minimum to avoid division by zero
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

// ──────────────────────────────────────────────
// ATM Strike
// ──────────────────────────────────────────────

export function findATMStrike(strikes: OptionStrikeData[], spotPrice: number): number {
  if (strikes.length === 0) return 0;

  let closest = strikes[0].strikePrice;
  let minDiff = Math.abs(strikes[0].strikePrice - spotPrice);

  for (const strike of strikes) {
    const diff = Math.abs(strike.strikePrice - spotPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closest = strike.strikePrice;
    }
  }

  return closest;
}

// ──────────────────────────────────────────────
// Main Calculator
// ──────────────────────────────────────────────

/**
 * Parse the raw option_chain_data JSONB and aggregate Vega metrics.
 *
 * NSE format: { data: [{ strikePrice, CE: { impliedVolatility, ... }, PE: { ... } }], underlyingValue }
 *
 * Since NSE doesn't provide Vega directly, we compute it via Black-Scholes
 * from IV, spot price, strike price, and time to expiry.
 */
export function calculateVegaMetrics(
  optionChainData: unknown,
  spotPrice: number,
  expiryDate: string
): VegaMetrics {
  // Normalise: handle array or { data: [] } wrapper
  let strikes: OptionStrikeData[] = [];

  if (Array.isArray(optionChainData)) {
    strikes = optionChainData;
  } else if (optionChainData && typeof optionChainData === 'object') {
    const obj = optionChainData as Record<string, unknown>;
    if (Array.isArray(obj.data)) strikes = obj.data;
    else if (Array.isArray(obj.records)) strikes = obj.records;
    else if (
      obj.records &&
      typeof obj.records === 'object' &&
      Array.isArray((obj.records as Record<string, unknown>).data)
    ) {
      strikes = (obj.records as Record<string, unknown>).data as OptionStrikeData[];
    }
  }

  const atmStrike = findATMStrike(strikes, spotPrice);
  const timeToExpiry = calculateTimeToExpiry(expiryDate);

  let totalCallVega = 0;
  let totalPutVega = 0;

  for (const strike of strikes) {
    // Calculate Call Vega
    if (strike.CE) {
      const ceIV =
        typeof strike.CE.impliedVolatility === 'number'
          ? strike.CE.impliedVolatility
          : typeof strike.CE.vega === 'number'
            ? null // Has direct vega
            : 0;

      if (ceIV !== null && ceIV > 0) {
        // Compute Vega from IV via Black-Scholes
        const vega = calculateBlackScholesVega(
          spotPrice,
          strike.strikePrice,
          timeToExpiry,
          ceIV
        );
        totalCallVega += vega;
      } else if (typeof strike.CE.vega === 'number') {
        // Direct vega available
        totalCallVega += strike.CE.vega;
      }
    }

    // Calculate Put Vega
    if (strike.PE) {
      const peIV =
        typeof strike.PE.impliedVolatility === 'number'
          ? strike.PE.impliedVolatility
          : typeof strike.PE.vega === 'number'
            ? null
            : 0;

      if (peIV !== null && peIV > 0) {
        const vega = calculateBlackScholesVega(
          spotPrice,
          strike.strikePrice,
          timeToExpiry,
          peIV
        );
        totalPutVega += vega;
      } else if (typeof strike.PE.vega === 'number') {
        totalPutVega += strike.PE.vega;
      }
    }
  }

  // Round to 2 decimals
  totalCallVega = Math.round(totalCallVega * 100) / 100;
  totalPutVega = Math.round(totalPutVega * 100) / 100;

  const difference = Math.round((totalPutVega - totalCallVega) * 100) / 100;

  return {
    callVega: totalCallVega,
    putVega: totalPutVega,
    difference,
    spotPrice,
    atmStrike,
  };
}

/**
 * Fetches the most recent option chain snapshot for a given symbol.
 */
export async function fetchLatestOptionChain(
  symbol: string
): Promise<OptionChainSnapshot | null> {
  const { data, error } = await supabase
    .from('option_chain_snapshots')
    .select('*')
    .eq('symbol', symbol)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Failed to fetch option chain snapshot:', error?.message);
    return null;
  }

  return data as OptionChainSnapshot;
}

/**
 * Fetches multiple recent option chain snapshots for historical Vega calculation.
 */
export async function fetchRecentOptionChains(
  symbol: string,
  limit: number = 50
): Promise<OptionChainSnapshot[]> {
  const { data, error } = await supabase
    .from('option_chain_snapshots')
    .select('*')
    .eq('symbol', symbol)
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Failed to fetch option chain snapshots:', error?.message);
    return [];
  }

  return data as OptionChainSnapshot[];
}

/**
 * Main entry: fetch latest option chain + compute Vega metrics.
 */
export async function computeVegaForSymbol(
  symbol: string
): Promise<{ metrics: VegaMetrics; snapshot: OptionChainSnapshot } | null> {
  const snapshot = await fetchLatestOptionChain(symbol);
  if (!snapshot) return null;

  const metrics = calculateVegaMetrics(
    snapshot.option_chain_data,
    snapshot.nifty_spot,
    snapshot.expiry_date
  );

  return { metrics, snapshot };
}
