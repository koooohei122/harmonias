import { STYLES } from '@/types/music';

interface StyleSelectorProps {
  selected: string;
  onChange: (style: string) => void;
}

export function StyleSelector({ selected, onChange }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {STYLES.map((style) => (
        <button
          key={style.id}
          onClick={() => onChange(style.id)}
          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50
            ${selected === style.id
              ? 'border-violet-500/60 bg-violet-500/15 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
              : 'border-[#1a1a3a] bg-[#0d0d1f] hover:border-[#252550] hover:bg-[#131326]'
            }`}
        >
          <span className="text-xl">{style.emoji}</span>
          <span className={`text-xs font-medium ${selected === style.id ? 'text-violet-300' : 'text-slate-400'}`}>
            {style.label}
          </span>
        </button>
      ))}
    </div>
  );
}
