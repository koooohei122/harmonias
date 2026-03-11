import { INSTRUMENTS } from '@/types/music';

interface InstrumentSelectorProps {
  selected: string[];
  onChange: (instruments: string[]) => void;
}

export function InstrumentSelector({ selected, onChange }: InstrumentSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-10">
      {INSTRUMENTS.map((inst) => {
        const active = selected.includes(inst.id);
        return (
          <button
            key={inst.id}
            onClick={() => toggle(inst.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50
              ${active
                ? 'border-cyan-500/60 bg-cyan-500/12 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                : 'border-[#1a1a3a] bg-[#0d0d1f] hover:border-[#252550] hover:bg-[#131326]'
              }`}
          >
            <span className="text-lg">{inst.emoji}</span>
            <span className={`text-[10px] font-medium text-center leading-tight ${active ? 'text-cyan-300' : 'text-slate-400'}`}>
              {inst.label}
            </span>
            {active && <span className="h-1 w-1 rounded-full bg-cyan-400" />}
          </button>
        );
      })}
    </div>
  );
}
