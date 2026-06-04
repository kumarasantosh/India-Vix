'use client';

interface SymbolSelectorProps {
  symbols: string[];
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

export default function SymbolSelector({
  symbols,
  activeSymbol,
  onSelect,
}: SymbolSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {symbols.map((symbol) => (
        <button
          key={symbol}
          id={`symbol-pill-${symbol.toLowerCase()}`}
          onClick={() => onSelect(symbol)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
            activeSymbol === symbol 
              ? 'bg-[#0f172a] text-white border-[#0f172a]' 
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100 hover:text-black'
          }`}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
