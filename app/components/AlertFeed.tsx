'use client';

import type { AlertRecord } from '@/lib/vega/types';

interface AlertFeedProps {
  alerts: AlertRecord[];
  loading?: boolean;
}

function getAlertCardClass(alertType: string): string {
  if (alertType.includes('Bullish')) return 'alert-card--bullish';
  if (alertType.includes('Bearish')) return 'alert-card--bearish';
  return 'alert-card--neutral';
}

function getAlertEmoji(alertType: string): string {
  if (alertType.includes('Strong Bullish')) return '🟢🟢';
  if (alertType.includes('Bullish')) return '🟢';
  if (alertType.includes('Strong Bearish')) return '🔴🔴';
  if (alertType.includes('Bearish')) return '🔴';
  if (alertType.includes('Zero')) return '⚡';
  return '📊';
}

function formatTimeAgo(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function parseAlertMessage(message: string) {
  const lines = message.split('\n').filter(Boolean);
  const title = lines[0] || '';
  const bodyLines = lines.slice(1);

  // Extract confidence if present
  const confidenceLine = bodyLines.find((l) => l.startsWith('Confidence:'));
  const confidence = confidenceLine
    ? parseInt(confidenceLine.replace('Confidence:', '').replace('%', '').trim(), 10)
    : null;

  const details = bodyLines
    .filter((l) => !l.startsWith('Confidence:') && !l.startsWith('Strength:'))
    .join('\n');

  return { title, details, confidence };
}

function SkeletonAlerts() {
  return (
    <div className="flex flex-col gap-3 animate-vega-pulse">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="alert-card"
          style={{
            height: 80,
            background: 'rgba(100,116,139,0.06)',
          }}
        />
      ))}
    </div>
  );
}

export default function AlertFeed({ alerts, loading }: AlertFeedProps) {
  if (loading) return <SkeletonAlerts />;

  return (
    <div className="vega-glass-card p-4 sm:p-6 animate-vega-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            style={{
              color: 'var(--vd-text-primary)',
              fontSize: '1rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Alert Feed
          </h3>
          <p
            style={{
              color: 'var(--vd-text-muted)',
              fontSize: '0.75rem',
              margin: '2px 0 0',
            }}
          >
            Latest generated alerts
          </p>
        </div>
        {alerts.length > 0 && (
          <span
            style={{
              background: 'var(--vd-indigo-glow)',
              color: 'var(--vd-indigo)',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 9999,
              border: '1px solid rgba(99,102,241,0.3)',
            }}
          >
            {alerts.length}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 400,
          overflowY: 'auto',
        }}
      >
        {alerts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--vd-text-muted)',
              padding: '40px 0',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: 8 }}>
              🔔
            </span>
            No alerts yet. Signals will appear here.
          </div>
        ) : (
          alerts.map((alert, idx) => {
            const { title, details, confidence } = parseAlertMessage(
              alert.message || ''
            );

            return (
              <div
                key={alert.id || idx}
                className={`alert-card ${getAlertCardClass(alert.alert_type)} animate-vega-slide-in`}
                style={{
                  animationDelay: `${idx * 60}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span style={{ fontSize: '1.1rem' }}>
                        {getAlertEmoji(alert.alert_type)}
                      </span>
                      <span
                        style={{
                          color: 'var(--vd-text-primary)',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        {alert.symbol} — {alert.alert_type}
                      </span>
                    </div>

                    {details && (
                      <p
                        style={{
                          color: 'var(--vd-text-secondary)',
                          fontSize: '0.78rem',
                          margin: '0 0 8px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {details}
                      </p>
                    )}

                    {confidence !== null && (
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--vd-text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          Confidence
                        </span>
                        <div className="confidence-bar" style={{ width: 80 }}>
                          <div
                            className={`confidence-bar__fill ${
                              confidence >= 70
                                ? 'confidence-bar__fill--high'
                                : confidence >= 50
                                  ? 'confidence-bar__fill--medium'
                                  : 'confidence-bar__fill--low'
                            }`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--vd-text-secondary)',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {confidence}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--vd-text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {formatTimeAgo(alert.created_at || alert.sent_at || '')}
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        background:
                          alert.status === 'sent'
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(100,116,139,0.15)',
                        color:
                          alert.status === 'sent'
                            ? 'var(--vd-green)'
                            : 'var(--vd-text-muted)',
                      }}
                    >
                      {alert.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
