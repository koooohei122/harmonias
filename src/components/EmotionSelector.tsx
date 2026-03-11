import { EMOTIONS } from '@/types/music';

interface EmotionSelectorProps {
  selected: string | null;
  onChange: (emotion: string | null) => void;
}

export function EmotionSelector({ selected, onChange }: EmotionSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {EMOTIONS.map((emotion) => {
        const active = selected === emotion.id;
        return (
          <button
            key={emotion.id}
            onClick={() => onChange(active ? null : emotion.id)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500/50
              ${active
                ? 'border-pink-500/60 bg-pink-500/15 shadow-[0_0_12px_rgba(236,72,153,0.2)]'
                : 'border-[#1a1a3a] bg-[#0d0d1f] hover:border-[#252550] hover:bg-[#131326]'
              }`}
          >
            <span className="text-xl">{emotion.emoji}</span>
            <span className={`text-xs font-medium text-center leading-tight ${active ? 'text-pink-300' : 'text-slate-400'}`}>
              {emotion.label}
            </span>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />}
          </button>
        );
      })}
    </div>
  );
}
