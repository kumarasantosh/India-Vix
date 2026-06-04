-- Vega Sentiment Analytics Engine — New Tables
-- Run this in the Supabase SQL Editor

-- ──────────────────────────────────────────────
-- vega_snapshots
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vega_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL,
  symbol varchar NOT NULL,
  expiry_date date NOT NULL,
  spot_price numeric,
  atm_strike numeric,
  call_vega numeric,
  put_vega numeric,
  difference numeric,
  signal varchar,
  confidence_score numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT vega_snapshots_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vega_symbol_captured
  ON public.vega_snapshots (symbol, captured_at);

CREATE INDEX IF NOT EXISTS idx_vega_symbol_expiry_captured
  ON public.vega_snapshots (symbol, expiry_date, captured_at);

-- ──────────────────────────────────────────────
-- signal_events
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.signal_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol varchar NOT NULL,
  expiry_date date NOT NULL,
  signal_type varchar NOT NULL,
  signal_strength varchar,
  signal_reason text,
  spot_price numeric,
  generated_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT signal_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_signal_type_generated
  ON public.signal_events (signal_type, generated_at);

-- ──────────────────────────────────────────────
-- alert_history
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alert_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol varchar NOT NULL,
  alert_type varchar NOT NULL,
  message text,
  status varchar DEFAULT 'pending',
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT alert_history_pkey PRIMARY KEY (id)
);