import { useState, useEffect, useRef, useCallback } from 'react';
import type { Song, Note, ChordNote, TrackNote } from '@/types/music';
import { getTheoryValidPitches, reharmonizeSong as apiReharmonize } from '@/lib/claudeCompose';

// ── Note / MIDI helpers (same logic as PianoRoll) ────────────────────────────
const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};
const MIDI_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DURATION_BEATS: Record<string, number> = {
  '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
};
const TRACK_COLORS = [
  '#8b5cf6', '#22d3ee', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16',
];

// In this codebase: midi = 12 + (octave + 1) * 12 + noteIdx
// So: octave = floor(midi / 12) - 2, noteIdx = midi % 12
function noteToMidi(name: string): number | null {
  const m = name.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!m) return null;
  const idx = NOTE_MAP[m[1]];
  if (idx === undefined) return null;
  return 12 + (parseInt(m[2]) + 1) * 12 + idx;
}

function midiToNote(midi: number): string {
  return `${MIDI_NAMES[midi % 12]}${Math.floor(midi / 12) - 2}`;
}

function isChordNote(n: TrackNote): n is ChordNote {
  return Array.isArray((n as ChordNote).notes);
}

function durationToBeats(dur: string): number {
  if (dur.endsWith('.')) return (DURATION_BEATS[dur.slice(0, -1)] ?? 1) * 1.5;
  return DURATION_BEATS[dur] ?? 1;
}

// ── Canvas constants ──────────────────────────────────────────────────────────
const PPB = 32; // pixels per beat
const PPP = 10; // pixels per pitch (larger than PianoRoll for easier drag)
const PAD = 44; // left padding for pitch labels

// ── Types ─────────────────────────────────────────────────────────────────────
interface RenderNote {
  trackIdx: number;
  noteIdx: number;
  midi: number;
  startBeat: number;
  durationBeats: number;
  draggable: boolean; // false for ChordNote entries
}

interface DragState {
  trackIdx: number;
  noteIdx: number;
  originalMidi: number;
  currentMidi: number;
}

interface MidiRange {
  minMidi: number;
  maxMidi: number;
  H: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface ScoreEditorProps {
  song: Song;
  apiKey: string;
  onSongChange: (song: Song) => void;
}

export function ScoreEditor({ song, apiKey, onSongChange }: ScoreEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cached data for mouse handlers (avoids recomputing on every move event)
  const renderNotesRef = useRef<RenderNote[]>([]);
  const midiRangeRef = useRef<MidiRange>({ minMidi: 48, maxMidi: 84, H: 360 });

  const [theoryAssist, setTheoryAssist] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [suggestedMidis, setSuggestedMidis] = useState<Set<number>>(new Set());
  const [isLoadingAssist, setIsLoadingAssist] = useState(false);
  const [isReharmonizing, setIsReharmonizing] = useState(false);

  // ── Build render-note list and cache MIDI range ──────────────────────────
  useEffect(() => {
    const notes: RenderNote[] = [];
    song.tracks.forEach((track, trackIdx) => {
      track.notes.forEach((n, noteIdx) => {
        const dur = durationToBeats(n.duration);
        if (isChordNote(n)) {
          n.notes.forEach((noteName) => {
            const midi = noteToMidi(noteName);
            if (midi !== null)
              notes.push({ trackIdx, noteIdx, midi, startBeat: n.startBeat, durationBeats: dur, draggable: false });
          });
        } else {
          const midi = noteToMidi((n as Note).note);
          if (midi !== null)
            notes.push({ trackIdx, noteIdx, midi, startBeat: n.startBeat, durationBeats: dur, draggable: true });
        }
      });
    });
    renderNotesRef.current = notes;

    if (notes.length > 0) {
      const midiVals = notes.map((n) => n.midi);
      const minMidi = Math.max(0, Math.min(...midiVals) - 3);
      const maxMidi = Math.min(127, Math.max(...midiVals) + 3);
      midiRangeRef.current = { minMidi, maxMidi, H: (maxMidi - minMidi + 1) * PPP };
    }
  }, [song]);

  // ── Canvas draw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { minMidi, maxMidi, H } = midiRangeRef.current;
    const W = PAD + song.totalBeats * PPB;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // ── Green row highlights for valid pitches (assist ON + dragging) ──
    if (dragState && theoryAssist && suggestedMidis.size > 0) {
      suggestedMidis.forEach((midi) => {
        if (midi >= minMidi && midi <= maxMidi) {
          const y = H - (midi - minMidi + 1) * PPP;
          ctx.fillStyle = 'rgba(34,197,94,0.12)';
          ctx.fillRect(PAD, y, W - PAD, PPP);
        }
      });
    }

    // ── Pitch rows ──
    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const y = H - (midi - minMidi + 1) * PPP;
      const noteIdx = midi % 12;
      if ([1, 3, 6, 8, 10].includes(noteIdx)) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(0, y, W, PPP);
      }
      if (noteIdx === 0) {
        ctx.strokeStyle = 'rgba(139,92,246,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillStyle = 'rgba(139,92,246,0.65)';
        ctx.font = '9px monospace';
        ctx.fillText(`C${Math.floor(midi / 12) - 2}`, 2, y + PPP - 2);
      }
    }

    // ── Beat grid ──
    for (let beat = 0; beat <= song.totalBeats; beat++) {
      const x = PAD + beat * PPB;
      ctx.strokeStyle = beat % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      if (beat % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '9px monospace';
        ctx.fillText(`${beat / 4 + 1}`, x + 2, 9);
      }
    }

    // ── Notes ──
    const drawnGhost = new Set<string>();

    renderNotesRef.current.forEach(({ trackIdx, noteIdx, midi, startBeat, durationBeats, draggable }) => {
      const isDragged = dragState?.trackIdx === trackIdx && dragState?.noteIdx === noteIdx;
      const displayMidi = isDragged ? dragState.currentMidi : midi;
      const w = Math.max(3, durationBeats * PPB - 1);
      const h = PPP - 1;
      const color = TRACK_COLORS[trackIdx % TRACK_COLORS.length];

      // Ghost at original position when note has moved
      if (isDragged && displayMidi !== midi) {
        const key = `${trackIdx}-${noteIdx}`;
        if (!drawnGhost.has(key)) {
          drawnGhost.add(key);
          const xg = PAD + startBeat * PPB;
          const yg = H - (midi - minMidi + 1) * PPP;
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(xg, yg, w, h);
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(xg, yg, w, h);
        }
      }

      const x = PAD + startBeat * PPB;
      const y = H - (displayMidi - minMidi + 1) * PPP;

      if (isDragged) {
        // Dragged note: green (always valid when assist ON due to snapping)
        const isAssistFree = !theoryAssist || suggestedMidis.size === 0;
        const fillColor = isAssistFree ? 'rgba(56,189,248,0.9)' : 'rgba(34,197,94,0.9)';
        const strokeColor = isAssistFree ? '#38bdf8' : '#22c55e';
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
        // Pitch label on the dragged note
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(midiToNote(displayMidi), x + 2, y + h - 1);
      } else {
        // Normal note
        ctx.fillStyle = draggable ? color + 'cc' : color + '55';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = draggable ? 0.5 : 0.25;
        ctx.strokeRect(x, y, w, h);
      }
    });

    // ── Green dots on left edge marking valid pitches (assist ON + dragging) ──
    if (dragState && theoryAssist && suggestedMidis.size > 0) {
      suggestedMidis.forEach((midi) => {
        if (midi >= minMidi && midi <= maxMidi) {
          const y = H - (midi - minMidi + 1) * PPP;
          const isCurrent = midi === dragState.currentMidi;
          ctx.fillStyle = isCurrent ? '#22c55e' : 'rgba(34,197,94,0.45)';
          ctx.fillRect(PAD - 7, y + 2, 6, PPP - 4);
        }
      });
    }
  }, [song, dragState, suggestedMidis, theoryAssist]);

  // ── Mouse down: hit-test notes, start drag, fetch theory suggestions ──────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReharmonizing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { minMidi, H } = midiRangeRef.current;

    // Find the topmost draggable note at the click position
    let found: RenderNote | null = null;
    for (const rn of renderNotesRef.current) {
      if (!rn.draggable) continue;
      const x = PAD + rn.startBeat * PPB;
      const y = H - (rn.midi - minMidi + 1) * PPP;
      const w = Math.max(3, rn.durationBeats * PPB - 1);
      if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + PPP - 1) {
        found = rn; // keep overwriting to get topmost (last drawn)
      }
    }
    if (!found) return;

    e.preventDefault();
    const { trackIdx, noteIdx, midi } = found;
    setDragState({ trackIdx, noteIdx, originalMidi: midi, currentMidi: midi });

    // Fetch theory-valid pitches in background
    if (theoryAssist && apiKey) {
      const track = song.tracks[trackIdx];
      const note = track?.notes[noteIdx];
      if (note && !isChordNote(note)) {
        const startCtx = Math.max(0, noteIdx - 3);
        const contextNotes = track.notes
          .filter((_, i) => i !== noteIdx && i >= startCtx && i <= noteIdx + 3)
          .map((n) => (isChordNote(n) ? n.notes[0] : (n as Note).note));

        setIsLoadingAssist(true);
        setSuggestedMidis(new Set());
        getTheoryValidPitches(apiKey, (note as Note).note, song.analysis.detectedKey, track.role, song.analysis.style, contextNotes)
          .then((pitches) => {
            const set = new Set(pitches.map(noteToMidi).filter((m): m is number => m !== null));
            setSuggestedMidis(set);
          })
          .catch(() => setSuggestedMidis(new Set()))
          .finally(() => setIsLoadingAssist(false));
      }
    }
  }, [isReharmonizing, theoryAssist, apiKey, song]);

  // ── Mouse move: update drag position (snap to valid pitches if assist ON) ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasY = e.clientY - rect.top;
    const { minMidi, maxMidi } = midiRangeRef.current;

    // Y → MIDI: row at y=0 is maxMidi, each PPP pixels = 1 semitone downward
    let targetMidi = maxMidi - Math.floor(canvasY / PPP);
    targetMidi = Math.max(minMidi, Math.min(maxMidi, targetMidi));

    // When assist ON: always snap to nearest valid pitch
    if (theoryAssist && suggestedMidis.size > 0) {
      let nearest = targetMidi;
      let minDist = Infinity;
      suggestedMidis.forEach((m) => {
        const d = Math.abs(m - targetMidi);
        if (d < minDist) { minDist = d; nearest = m; }
      });
      targetMidi = nearest;
    }

    if (targetMidi !== dragState.currentMidi) {
      setDragState((prev) => prev ? { ...prev, currentMidi: targetMidi } : null);
    }
  }, [dragState, theoryAssist, suggestedMidis]);

  // ── Mouse up: commit note change, reharmonize full song ──────────────────
  const handleMouseUp = useCallback(async () => {
    if (!dragState) return;
    const { trackIdx, noteIdx, originalMidi, currentMidi } = dragState;
    setDragState(null);
    setSuggestedMidis(new Set());

    if (currentMidi === originalMidi) return; // no change

    const newNoteName = midiToNote(currentMidi);

    // Apply the local note change immediately
    const updatedSong: Song = {
      ...song,
      tracks: song.tracks.map((track, ti) => {
        if (ti !== trackIdx) return track;
        return {
          ...track,
          notes: track.notes.map((n, ni) => {
            if (ni !== noteIdx || isChordNote(n)) return n;
            return { ...(n as Note), note: newNoteName };
          }),
        };
      }),
    };

    // Also update correctedMelody if this is the melody track
    const changedTrack = song.tracks[trackIdx];
    if (changedTrack?.role === 'melody') {
      const changedNote = song.tracks[trackIdx].notes[noteIdx];
      if (!isChordNote(changedNote)) {
        updatedSong.correctedMelody = song.correctedMelody.map((n) =>
          n.note === (changedNote as Note).note && n.startBeat === (changedNote as Note).startBeat
            ? { ...n, note: newNoteName }
            : n,
        );
      }
    }

    // Re-harmonize the rest of the arrangement via AI
    setIsReharmonizing(true);
    try {
      const reharmonized = await apiReharmonize(apiKey, updatedSong, trackIdx, noteIdx, newNoteName);
      onSongChange(reharmonized);
    } catch {
      // Fallback: use the locally-changed song without full reharmonization
      onSongChange(updatedSong);
    } finally {
      setIsReharmonizing(false);
    }
  }, [dragState, song, apiKey, onSongChange]);

  const handleMouseLeave = useCallback(() => {
    if (dragState) {
      setDragState(null);
      setSuggestedMidis(new Set());
    }
  }, [dragState]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400">
          単音ノート (✎) をドラッグして音程を変更
        </p>
        <button
          onClick={() => setTheoryAssist((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            theoryAssist
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-[#1a1a3a] text-slate-400 border border-[#2a2a5a] hover:text-slate-300'
          }`}
        >
          {theoryAssist ? '🎯' : '🔓'}
          音楽理論AI補助&nbsp;{theoryAssist ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Status messages */}
      {isLoadingAssist && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <SmallSpinner />AI補助音程を計算中...
        </div>
      )}
      {isReharmonizing && (
        <div className="flex items-center gap-2 text-xs text-violet-400">
          <SmallSpinner />AIが全体を再調整中...（他のトラックを整合させています）
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-500">
        {theoryAssist && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/70" />
              推奨音程（緑）
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-4 rounded-sm bg-emerald-500/40" style={{ marginLeft: 2 }} />
              選択候補（左端の点）
            </span>
          </>
        )}
        {!theoryAssist && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-sky-400/70" />
            自由移動（青）
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-white/10" />
          元の位置（薄影）
        </span>
      </div>

      {/* Track legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {song.tracks.map((track, i) => {
          const isDraggable = !['chords', 'rhythm', 'percussion'].includes(track.role);
          return (
            <div key={i} className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: TRACK_COLORS[i % TRACK_COLORS.length] }}
              />
              {track.instrument}
              {isDraggable && <span className="text-emerald-500/70 text-[10px] ml-0.5">✎</span>}
            </div>
          );
        })}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`overflow-x-auto rounded-xl border border-[#1a1a3a] transition-opacity ${isReharmonizing ? 'opacity-40 pointer-events-none' : ''}`}
        style={{ maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            cursor: isReharmonizing ? 'wait' : 'crosshair',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      <p className="text-[10px] text-slate-700">
        ※ コード（和音）は一括移動できません。ノート変更後、AIが他の全トラックを自動調整します。
      </p>
    </div>
  );
}

function SmallSpinner() {
  return (
    <svg className="h-3 w-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
