'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Note } from '@/types/music';
import { TonePlayer } from '@/lib/tonePlayer';
import { correctMelodyNotes } from '@/lib/claudeCompose';

interface VoiceModeEditorProps {
  apiKey: string;
  style: string;
  onCompose: (notes: Note[]) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DURATION_OPTIONS = ['16n', '8n', '4n', '2n', '1n'];
const DURATION_LABELS: Record<string, string> = {
  '16n': '16分', '8n': '8分', '4n': '4分', '2n': '2分', '1n': '全音',
};
const DURATION_BEATS: Record<string, number> = {
  '16n': 0.25, '8n': 0.5, '4n': 1, '2n': 2, '1n': 4,
};

const VISIBLE_OCTAVES = [3, 4, 5];
const BEATS_PER_SCREEN = 16;
const CELL_W = 60;
const CELL_H = 28;

function noteToMidiSimple(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

function pitchRowLabel(noteName: string, octave: number): string {
  return `${noteName}${octave}`;
}

// Build piano key rows top→bottom (high to low)
const PITCH_ROWS: { noteName: string; octave: number; isBlack: boolean }[] = [];
for (let oct = Math.max(...VISIBLE_OCTAVES); oct >= Math.min(...VISIBLE_OCTAVES); oct--) {
  for (let i = 11; i >= 0; i--) {
    PITCH_ROWS.push({
      noteName: NOTE_NAMES[i],
      octave: oct,
      isBlack: [1, 3, 6, 8, 10].includes(i),
    });
  }
}

export function VoiceModeEditor({ apiKey, style, onCompose }: VoiceModeEditorProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>('4n');
  const [scrollBeat, setScrollBeat] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState('');
  const [instrument, setInstrument] = useState('piano');
  const playerRef = useRef<TonePlayer>(new TonePlayer());
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalBeats = Math.max(BEATS_PER_SCREEN, ...notes.map((n) => n.startBeat + DURATION_BEATS[n.duration])) + 4;
  const visibleBeats = Math.ceil(totalBeats);

  // Play a note preview on tap
  const previewNote = useCallback(async (noteName: string, octave: number) => {
    await playerRef.current.previewNote(`${noteName}${octave}`, instrument, selectedDuration);
  }, [instrument, selectedDuration]);

  // Add note at beat position
  const addNote = useCallback((noteName: string, octave: number, startBeat: number) => {
    const noteStr = `${noteName}${octave}`;
    // Remove if already exists at same position
    const existing = notes.find((n) => n.note === noteStr && n.startBeat === startBeat);
    if (existing) {
      setNotes((prev) => prev.filter((n) => !(n.note === noteStr && n.startBeat === startBeat)));
    } else {
      const newNote: Note = {
        note: noteStr,
        duration: selectedDuration,
        startBeat,
        velocity: 0.8,
      };
      setNotes((prev) => [...prev, newNote].sort((a, b) => a.startBeat - b.startBeat));
    }
    previewNote(noteName, octave);
  }, [notes, selectedDuration, previewNote]);

  const handleCellClick = useCallback((noteName: string, octave: number, beatCol: number) => {
    const startBeat = scrollBeat + beatCol;
    addNote(noteName, octave, startBeat);
  }, [scrollBeat, addNote]);

  const handlePlay = async () => {
    if (notes.length === 0) return;
    setIsPlaying(true);
    const fakeSong = {
      analysis: {
        detectedKey: 'C major',
        timeSignature: [4, 4] as [number, number],
        tempo: 120,
        correctionsSummary: '',
        style,
      },
      correctedMelody: notes,
      tracks: [{ instrument, role: 'melody' as const, notes }],
      totalBeats: Math.max(...notes.map((n) => n.startBeat + DURATION_BEATS[n.duration])) + 2,
    };
    await playerRef.current.playSong(fakeSong, () => setIsPlaying(false));
  };

  const handleStop = async () => {
    await playerRef.current.stop();
    setIsPlaying(false);
  };

  const handleClear = () => {
    playerRef.current.stop();
    setNotes([]);
    setIsPlaying(false);
  };

  const handleAiCorrect = async () => {
    if (notes.length === 0 || !apiKey) return;
    setIsCorrecting(true);
    setCorrectionError('');
    try {
      const corrected = await correctMelodyNotes(apiKey, notes, style);
      setNotes(corrected);
    } catch (e) {
      setCorrectionError(e instanceof Error ? e.message : '補正に失敗しました');
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleCompose = () => {
    if (notes.length > 0) onCompose(notes);
  };

  // Scroll beat columns
  const scrollLeft = () => setScrollBeat((b) => Math.max(0, b - 4));
  const scrollRight = () => setScrollBeat((b) => b + 4);

  // Check if a note exists at a given cell
  const getNoteAt = useCallback((noteName: string, octave: number, beatCol: number) => {
    const startBeat = scrollBeat + beatCol;
    return notes.find((n) => n.note === `${noteName}${octave}` && n.startBeat === startBeat);
  }, [notes, scrollBeat]);

  const VISIBLE_COLS = 8;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-slate-200 text-sm">声モディモード</h3>
        <div className="flex items-center gap-2">
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="rounded-lg border border-[#252550] bg-[#0d0d1f] px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            {['piano', 'violin', 'flute', 'choir', 'synth', 'guitar'].map((inst) => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Duration selector */}
      <div className="flex gap-1">
        {DURATION_OPTIONS.map((dur) => (
          <button
            key={dur}
            onClick={() => setSelectedDuration(dur)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
              selectedDuration === dur
                ? 'bg-violet-500/25 border border-violet-500/50 text-violet-300'
                : 'bg-[#0d0d1f] border border-[#1a1a3a] text-slate-500 hover:text-slate-300'
            }`}
          >
            {DURATION_LABELS[dur]}
          </button>
        ))}
      </div>

      {/* Piano roll editor */}
      <div className="rounded-xl border border-[#1a1a3a] overflow-hidden">
        {/* Beat header */}
        <div className="flex bg-[#080812] border-b border-[#1a1a3a]">
          <div className="w-12 shrink-0 text-[10px] text-slate-600 flex items-center justify-center border-r border-[#1a1a3a]">
            音
          </div>
          {Array.from({ length: VISIBLE_COLS }, (_, col) => {
            const beat = scrollBeat + col;
            const isBar = beat % 4 === 0;
            return (
              <div
                key={col}
                className={`flex-1 text-center text-[10px] py-1.5 border-r border-[#1a1a3a] ${
                  isBar ? 'text-violet-400 font-medium' : 'text-slate-600'
                }`}
              >
                {isBar ? `${Math.floor(beat / 4) + 1}小` : '·'}
              </div>
            );
          })}
        </div>

        {/* Note grid */}
        <div className="max-h-64 overflow-y-auto bg-[#0a0a18]">
          {PITCH_ROWS.map(({ noteName, octave, isBlack }) => (
            <div
              key={`${noteName}${octave}`}
              className={`flex border-b border-[#111128] ${isBlack ? 'bg-[#0a0a15]' : 'bg-[#0d0d1f]'}`}
            >
              {/* Note label */}
              <div className={`w-12 shrink-0 flex items-center justify-center text-[10px] border-r border-[#1a1a3a] ${
                isBlack ? 'text-slate-600' : noteName === 'C' ? 'text-violet-400 font-medium' : 'text-slate-500'
              }`}>
                {noteName === 'C' || !isBlack ? pitchRowLabel(noteName, octave) : ''}
              </div>
              {/* Beat cells */}
              {Array.from({ length: VISIBLE_COLS }, (_, col) => {
                const existing = getNoteAt(noteName, octave, col);
                const isBarStart = (scrollBeat + col) % 4 === 0;
                return (
                  <button
                    key={col}
                    onClick={() => handleCellClick(noteName, octave, col)}
                    className={`flex-1 border-r border-[#111128] transition-all py-1 ${
                      existing
                        ? 'bg-violet-500/70 hover:bg-violet-500/90'
                        : isBarStart
                          ? 'bg-violet-500/5 hover:bg-violet-500/20'
                          : 'hover:bg-violet-500/15'
                    }`}
                    style={{ height: CELL_H }}
                    title={`${noteName}${octave} beat ${scrollBeat + col}`}
                  >
                    {existing && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white/60" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Scroll controls */}
        <div className="flex items-center justify-between bg-[#080812] border-t border-[#1a1a3a] px-3 py-2">
          <button
            onClick={scrollLeft}
            disabled={scrollBeat === 0}
            className="text-slate-500 hover:text-slate-300 disabled:opacity-30 text-sm px-2"
          >
            ← 前へ
          </button>
          <span className="text-[10px] text-slate-600">
            ビート {scrollBeat + 1}〜{scrollBeat + VISIBLE_COLS}
          </span>
          <button
            onClick={scrollRight}
            className="text-slate-500 hover:text-slate-300 text-sm px-2"
          >
            次へ →
          </button>
        </div>
      </div>

      {/* Notes count */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{notes.length}個の音符</span>
        {notes.length > 0 && (
          <button onClick={handleClear} className="text-red-400/70 hover:text-red-400 transition-colors">
            全消去
          </button>
        )}
      </div>

      {correctionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          ⚠️ {correctionError}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={isPlaying ? handleStop : handlePlay}
          disabled={notes.length === 0}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            isPlaying
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : 'bg-[#0d0d1f] border border-[#252550] text-slate-300 hover:text-white'
          }`}
        >
          {isPlaying ? '⏹ 停止' : '▶ プレビュー'}
        </button>

        {apiKey && (
          <button
            onClick={handleAiCorrect}
            disabled={notes.length === 0 || isCorrecting}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isCorrecting ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI補正中...
              </span>
            ) : '✨ AI補正'}
          </button>
        )}

        <button
          onClick={handleCompose}
          disabled={notes.length === 0}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          🎵 編曲する
        </button>
      </div>

      <p className="text-xs text-slate-600 text-center">
        マス目をタップして音符を追加。押した音がすぐに鳴ります。AI補正で自然なメロディに仕上げてから編曲できます。
      </p>
    </div>
  );
}
