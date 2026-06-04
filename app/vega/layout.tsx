import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vega Sentiment Engine — Real-Time Options Analytics',
  description:
    'Live Vega analytics and sentiment detection for Indian index options. Track Call/Put Vega, momentum, and directional signals for NIFTY, BANKNIFTY, SENSEX, FINNIFTY.',
  keywords: [
    'Vega',
    'Options Analytics',
    'NIFTY',
    'BANKNIFTY',
    'SENSEX',
    'Sentiment',
    'Options Greeks',
    'Indian Markets',
  ],
};

export default function VegaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
