import { supabase } from '@/lib/supabaseClient';
import type { AlertRecord, SignalAnalysis } from './types';

// ──────────────────────────────────────────────
// Alert message formatting
// ──────────────────────────────────────────────

function formatAlertMessage(
  symbol: string,
  analysis: SignalAnalysis,
  spotPrice: number
): string {
  const emoji =
    analysis.signal.includes('Bullish')
      ? '🟢'
      : analysis.signal.includes('Bearish')
        ? '🔴'
        : '⚡';

  return [
    `${emoji} ${symbol} ${analysis.signal} Alert`,
    '',
    analysis.reason,
    '',
    `Spot: ₹${spotPrice.toLocaleString('en-IN')}`,
    `Confidence: ${Math.round(analysis.confidence)}%`,
    `Strength: ${analysis.strength}`,
  ].join('\n');
}

// ──────────────────────────────────────────────
// Store alert
// ──────────────────────────────────────────────

export async function storeAlert(
  alert: Omit<AlertRecord, 'id' | 'created_at'>
): Promise<AlertRecord | null> {
  const { data, error } = await supabase
    .from('alert_history')
    .insert(alert)
    .select()
    .single();

  if (error) {
    console.error('Failed to store alert:', error.message);
    return null;
  }
  return data as AlertRecord;
}

// ──────────────────────────────────────────────
// Telegram integration (optional)
// ──────────────────────────────────────────────

async function sendTelegramAlert(message: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('Telegram env vars not set — skipping notification.');
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('Telegram send failed:', err);
    return false;
  }
}

// ──────────────────────────────────────────────
// Main alert handler
// ──────────────────────────────────────────────

export async function generateAlert(
  symbol: string,
  analysis: SignalAnalysis,
  spotPrice: number
): Promise<AlertRecord | null> {
  // Only alert on non-Neutral signals
  if (analysis.signal === 'Neutral') return null;

  const message = formatAlertMessage(symbol, analysis, spotPrice);

  // Store in DB
  const alert = await storeAlert({
    symbol,
    alert_type: analysis.signal,
    message,
    status: 'pending',
    sent_at: new Date().toISOString(),
  });

  // Attempt Telegram
  const telegramSent = await sendTelegramAlert(message);

  // Update status
  if (alert) {
    await supabase
      .from('alert_history')
      .update({ status: telegramSent ? 'sent' : 'stored' })
      .eq('id', alert.id);
    alert.status = telegramSent ? 'sent' : 'stored';
  }

  return alert;
}
