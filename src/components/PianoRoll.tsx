import { useEffect, useRef } from 'react';
import type { Song, TrackNote, Note, ChordNote } from '@/types/music';

interface PianoRollProps {
  song: Song;
}

const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

const DURATION_BEATS: Record<string, number> = {
  '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
};

function noteToMidi(name: string): number | null {
  const m = name.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!m) return null;
  const idx = NOTE_MAP[m[1]];
  if (idx === undefined) return null;
  return 12 + (parseInt(m[2]) + 1) * 12 + idx;
}

function isChordNote(n: TrackNote): n is ChordNote {
  return Array.isArray((n as ChordNote).notes);
}

function durationToBeats(dur: string): number {
  if (dur.endsWith('.')) return (DURATION_BEATS[dur.slice(0, -1)] ?? 1) * 1.5;
  return DURATION_BEATS[dur] ?? 1;
}

const TRACK_COLORS = [
  '#8b5cf6', '#22d3ee', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16',
];

export function PianoRoll({ song }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Collect all note events
    const allNotes: { midi: number; startBeat: number; durationBeats: number; trackIdx: number }[] = [];

    song.tracks.forEach((track, trackIdx) => {
      track.notes.forEach((n) => {
        const dur = durationToBeats(n.duration);
        if (isChordNote(n)) {
          n.notes.forEach((noteName) => {
            const midi = noteToMidi(noteName);
            if (midi !== null) allNotes.push({ midi, startBeat: n.startBeat, durationBeats: dur, trackIdx });
          });
        } else {
          const midi = noteToMidi((n as Note).note);
          if (midi !== null) allNotes.push({ midi, startBeat: n.startBeat, durationBeats: dur, trackIdx });
        }
      });
    });

    if (allNotes.length === 0) return;

    const midiValues = allNotes.map((n) => n.midi);
    const minMidi = Math.max(0, Math.min(...midiValues) - 2);
    const maxMidi = Math.min(127, Math.max(...midiValues) + 2);
    const pitchRange = maxMidi - minMidi + 1;

    const totalBeats = song.totalBeats;
    const PIXELS_PER_BEAT = 32;
    const PIXELS_PER_PITCH = 8;
    const PADDING_LEFT = 40;

    const W = PADDING_LEFT + totalBeats * PIXELS_PER_BEAT;
    const H = pitchRange * PIXELS_PER_PITCH;

    canvas.width = W;
    canvas.height = H;
    container.scrollLeft = 0;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Horizontal grid lines + note names
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const y = H - (midi - minMidi + 1) * PIXELS_PER_PITCH;
      const noteIdx = midi % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(noteIdx);

      if (isBlack) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, y, W, PIXELS_PER_PITCH);
      }

      // C notes get a line
      if (noteIdx === 0) {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();

        // Note label
        const octave = Math.floor(midi / 12) - 1;
        ctx.fillStyle = 'rgba(139, 92, 246, 0.6)';
        ctx.font = '9px monospace';
        ctx.fillText(`C${octave}`, 2, y + PIXELS_PER_PITCH - 1);
      }
    }

    // Beat grid
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = PADDING_LEFT + beat * PIXELS_PER_BEAT;
      ctx.strokeStyle = beat % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      if (beat % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px monospace';
        ctx.fillText(`${beat / 4 + 1}`, x + 2, 10);
      }
    }

    // Draw notes
    allNotes.forEach(({ midi, startBeat, durationBeats, trackIdx }) => {
      const x = PADDING_LEFT + startBeat * PIXELS_PER_BEAT;
      const y = H - (midi - minMidi + 1) * PIXELS_PER_PITCH;
      const w = Math.max(2, durationBeats * PIXELS_PER_BEAT - 1);
      const h = PIXELS_PER_PITCH - 1;

      const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length];

      ctx.fillStyle = color + 'cc';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);
    });
  }, [song]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-3 flex-wrap">
        {song.tracks.map((track, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length] }}
            />
            {track.instrument}
          </div>
        ))}
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-xl border border-[#1a1a3a]"
        style={{ maxWidth: '100%' }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
}
