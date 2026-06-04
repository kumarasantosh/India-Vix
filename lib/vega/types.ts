// ──────────────────────────────────────────────
// Option Chain data types (NSE-style JSONB)
// ──────────────────────────────────────────────

export interface OptionGreeks {
  vega: number;
  impliedVolatility: number;
  openInterest: number;
  totalTradedVolume: number;
  lastPrice: number;
  change: number;
  pChange: number;
}

export interface OptionStrikeData {
  strikePrice: number;
  expiryDate: string;
  CE?: OptionGreeks;
  PE?: OptionGreeks;
}

export interface OptionChainSnapshot {
  id: string;
  captured_at: string;
  symbol: string;
  expiry_date: string;
  nifty_spot: number;
  option_chain_data: OptionStrikeData[];
}

// ──────────────────────────────────────────────
// Vega computed types
// ──────────────────────────────────────────────

export interface VegaMetrics {
  callVega: number;
  putVega: number;
  difference: number; // putVega - callVega
  spotPrice: number;
  atmStrike: number;
}

export interface VegaMomentum {
  callVegaMomentum: number;
  putVegaMomentum: number;
  differenceMomentum: number;
}

export type SignalType =
  | 'Bullish'
  | 'Strong Bullish'
  | 'Bearish'
  | 'Strong Bearish'
  | 'Zero Line Breakout'
  | 'Neutral';

export type SignalStrength = 'weak' | 'moderate' | 'strong';

export interface VegaSnapshot {
  id?: string;
  captured_at: string;
  symbol: string;
  expiry_date: string;
  spot_price: number;
  atm_strike: number;
  call_vega: number;
  put_vega: number;
  difference: number;
  signal: SignalType;
  confidence_score: number;
  created_at?: string;
}

export interface SignalEvent {
  id?: string;
  symbol: string;
  expiry_date: string;
  signal_type: SignalType;
  signal_strength: SignalStrength;
  signal_reason: string;
  spot_price: number;
  generated_at: string;
  created_at?: string;
}

export interface AlertRecord {
  id?: string;
  symbol: string;
  alert_type: string;
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'stored';
  sent_at?: string;
  created_at?: string;
}

// ──────────────────────────────────────────────
// PCR data type (from existing table)
// ──────────────────────────────────────────────

export interface PCRData {
  id: string;
  index_name: string;
  total_put_oi: number;
  total_call_oi: number;
  pcr_value: number;
  sentiment: string;
  spot_price: number;
  atm_strike: number;
  captured_at: string;
}

// ──────────────────────────────────────────────
// Signal analysis intermediate types
// ──────────────────────────────────────────────

export interface SignalAnalysis {
  signal: SignalType;
  strength: SignalStrength;
  confidence: number;
  reason: string;
}
