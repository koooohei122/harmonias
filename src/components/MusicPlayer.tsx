import { useState, useEffect, useRef, useCallback } from 'react';
import { TonePlayer, type TrackState } from '@/lib/tonePlayer';
import { downloadMidi } from '@/lib/midiExport';
import { PianoRoll } from '@/components/PianoRoll';
import { ScoreEditor } from '@/components/ScoreEditor';
import type { Song, TrackNote, Note, ChordNote } from '@/types/music';
import { STYLES } from '@/types/music';

// ── Layout constants ──────────────────────────────────────────────────────────
const TRACK_H  = 46;   // px per track row in arrangement
const RULER_H  = 18;   // px for timeline ruler
const NOTE_PAD = 5;    // inner vertical padding for note bars
const NOTE_H   = TRACK_H - NOTE_PAD * 2;
const BEAT_PX  = 22;   // pixels per beat in arrangement

const DURATION_BEATS: Record<string, number> = {
  '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
};
function durToBeats(dur: string): number {
  if (dur.endsWith('.')) return (DURATION_BEATS[dur.slice(0, -1)] ?? 1) * 1.5;
  return DURATION_BEATS[dur] ?? 1;
}
function isChordNote(n: TrackNote): n is ChordNote {
  return Array.isArray((n as ChordNote).notes);
}

const TRACK_COLORS = [
  '#8b5cf6', '#22d3ee', '#f59e0b', '#10b981',
  '#ef4444', '#ec4899', '#3b82f6', '#84cc16',
];
const INSTR_EMOJI: Record<string, string> = {
  piano: '🎹', guitar: '🎸', bass: '🎵', drums: '🥁',
  strings: '🎻', violin: '🎻', cello: '🎻', harp: '🪕',
  flute: '🎵', oboe: '🎵', clarinet: '🎵', saxophone: '🎷',
  trumpet: '🎺', organ: '🎹', accordion: '🪗', marimba: '🎵',
  vibraphone: '✨', choir: '🎤', synth: '🎛',
};
function roleLabel(role: string): string {
  return ({ melody: 'MELODY', chords: 'CHORD', bass: 'BASS', rhythm: 'RHYTHM', harmony: 'HARM', percussion: 'PERC' }[role] ?? role).toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface MusicPlayerProps {
  song: Song;
  apiKey?: string;
  onSongChange?: (song: Song) => void;
  onGenerateLyrics?: () => Promise<void>;
  isGeneratingLyrics?: boolean;
  onConvertStyle?: () => void;
  onSaveToLibrary?: () => void;
}
type PlayState = 'stopped' | 'playing' | 'paused';

// ── Component ─────────────────────────────────────────────────────────────────
export function MusicPlayer({
  song, apiKey, onSongChange,
  onGenerateLyrics, isGeneratingLyrics,
  onConvertStyle, onSaveToLibrary,
}: MusicPlayerProps) {
  const [playState, setPlayState]       = useState<PlayState>('stopped');
  const [loop, setLoop]                 = useState(false);
  const [tempo, setTempo]               = useState(song.analysis.tempo);
  const [trackStates, setTrackStates]   = useState<Map<number, TrackState>>(new Map());
  const [currentBeat, setCurrentBeat]   = useState(0);
  const [saved, setSaved]               = useState(false);
  const [editMode, setEditMode]         = useState<'score' | 'view'>('score');
  const [showLyrics, setShowLyrics]     = useState(false);
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempTempoVal, setTempTempoVal] = useState('');

  const playerRef         = useRef<TonePlayer | null>(null);
  const arrangementRef    = useRef<HTMLCanvasElement>(null);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const rafRef            = useRef<number>(0);

  // Init player
  useEffect(() => {
    playerRef.current = new TonePlayer();
    return () => { playerRef.current?.stop(); };
  }, []);

  // Reset on song change
  useEffect(() => {
    playerRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    setPlayState('stopped');
    setTempo(song.analysis.tempo);
    setTrackStates(new Map());
    setSaved(false);
    setCurrentBeat(0);
  }, [song]);

  useEffect(() => { playerRef.current?.setLoop(loop); }, [loop]);

  // Playhead animation via requestAnimationFrame
  useEffect(() => {
    if (playState === 'playing') {
      const tick = () => {
        setCurrentBeat(playerRef.current?.getCurrentBeat() ?? 0);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    } else {
      cancelAnimationFrame(rafRef.current);
      if (playState === 'stopped') setCurrentBeat(0);
    }
  }, [playState]);

  // ── Draw arrangement canvas ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = arrangementRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalBeats = song.totalBeats;
    const W = Math.max(480, totalBeats * BEAT_PX + 32);
    const H = RULER_H + song.tracks.length * TRACK_H;
    canvas.width  = W;
    canvas.height = H;

    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, W, H);

    // Ruler background
    ctx.fillStyle = '#0c0c1e';
    ctx.fillRect(0, 0, W, RULER_H);

    // Grid lines + bar numbers
    const bpb = song.analysis.timeSignature[0];
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = beat * BEAT_PX;
      const isBar = beat % bpb === 0;
      ctx.strokeStyle = isBar ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.035)';
      ctx.lineWidth   = isBar ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, H); ctx.stroke();
      if (isBar) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER_H); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = '9px monospace';
        ctx.fillText(`${beat / bpb + 1}`, x + 2, RULER_H - 4);
      }
    }

    // Track rows + note blocks
    song.tracks.forEach((track, ti) => {
      const rowY  = RULER_H + ti * TRACK_H;
      const color = TRACK_COLORS[ti % TRACK_COLORS.length];
      const state = trackStates.get(ti);
      const muted = state?.muted ?? false;

      // Alternating row shade
      if (ti % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.008)';
        ctx.fillRect(0, rowY, W, TRACK_H);
      }
      // Row divider
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, rowY + TRACK_H - 0.5);
      ctx.lineTo(W, rowY + TRACK_H - 0.5);
      ctx.stroke();

      // Note blocks
      track.notes.forEach((n) => {
        const dur = durToBeats(n.duration);
        const x   = n.startBeat * BEAT_PX;
        const w   = Math.max(2, dur * BEAT_PX - 1);
        const vel = (isChordNote(n) ? (n.velocity ?? 0.6) : ((n as Note).velocity ?? 0.7));
        ctx.globalAlpha = muted ? 0.18 : vel * 0.88 + 0.12;
        ctx.fillStyle   = color;
        ctx.fillRect(x, rowY + NOTE_PAD, w, NOTE_H);
      });
      ctx.globalAlpha = 1;
    });

    // Playhead
    const phX = currentBeat * BEAT_PX;
    if (phX >= 0) {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(phX, 0); ctx.lineTo(phX, H); ctx.stroke();
      // Triangle tip
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(phX - 4, 0);
      ctx.lineTo(phX + 4, 0);
      ctx.lineTo(phX, 7);
      ctx.fill();
    }
  }, [song, currentBeat, trackStates]);

  // ── Playback handlers ──────────────────────────────────────────────────────
  const handlePlay = async () => {
    if (!playerRef.current) return;
    if (playState === 'stopped') {
      playerRef.current.setLoop(loop);
      setPlayState('playing');
      await playerRef.current.playSong(
        { ...song, analysis: { ...song.analysis, tempo } },
        () => { if (!loop) setPlayState('stopped'); },
      );
      setTrackStates(playerRef.current.getTrackStates());
    } else if (playState === 'playing') {
      await playerRef.current.pause();
      setPlayState('paused');
    } else {
      await playerRef.current.pause();
      setPlayState('playing');
    }
  };

  const handleStop = async () => {
    await playerRef.current?.stop();
    setPlayState('stopped');
  };

  const handleTempoChange = useCallback(async (v: number) => {
    const clamped = Math.max(40, Math.min(220, v));
    setTempo(clamped);
    await playerRef.current?.setTempo(clamped);
  }, []);

  const handleMuteToggle = useCallback((i: number) => {
    const state = trackStates.get(i);
    if (!state) return;
    const muted = !state.muted;
    playerRef.current?.setTrackMute(i, muted);
    setTrackStates((prev) => {
      const next = new Map(prev);
      const s = next.get(i);
      if (s) next.set(i, { ...s, muted });
      return next;
    });
  }, [trackStates]);

  const handleVolumeChange = useCallback((i: number, volume: number) => {
    playerRef.current?.setTrackVolume(i, volume);
    setTrackStates((prev) => {
      const next = new Map(prev);
      const s = next.get(i);
      if (s) next.set(i, { ...s, volume });
      return next;
    });
  }, []);

  const handleSave = () => { onSaveToLibrary?.(); setSaved(true); };

  // ── Derived values ─────────────────────────────────────────────────────────
  const styleInfo = STYLES.find((s) => s.id === song.analysis.style.toLowerCase()) ?? STYLES[0];
  const bpb       = song.analysis.timeSignature[0];
  const bar       = Math.floor(currentBeat / bpb) + 1;
  const beat      = Math.floor(currentBeat % bpb) + 1;
  const posLabel  = `${bar}:${beat}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-[#1a1a3a] bg-[#060610] overflow-hidden text-sm">

      {/* ── TRANSPORT BAR ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a3a] bg-[#0a0a1a] flex-wrap">

        {/* Transport buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleStop} disabled={playState === 'stopped'}
            className="h-7 w-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all text-xs"
            title="停止"
          >⏹</button>
          <button
            onClick={handlePlay}
            className={`h-8 w-8 rounded-lg flex items-center justify-center text-base font-bold transition-all ${
              playState === 'playing'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                : 'bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
            }`}
          >
            {playState === 'playing' ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => setLoop(!loop)}
            className={`h-7 w-7 rounded flex items-center justify-center text-xs transition-all ${
              loop ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="ループ"
          >🔁</button>
        </div>

        {/* Position counter */}
        <span className="font-mono text-[11px] text-rose-400 tabular-nums w-8 select-none">
          {playState !== 'stopped' ? posLabel : ''}
        </span>

        {/* Tempo */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => handleTempoChange(tempo - 1)} className="h-5 w-5 rounded text-[10px] text-slate-500 hover:text-white hover:bg-white/5 transition-all">−</button>
          {editingTempo ? (
            <input
              autoFocus
              type="number" min={40} max={220}
              value={tempTempoVal}
              onChange={(e) => setTempTempoVal(e.target.value)}
              onBlur={() => { handleTempoChange(Number(tempTempoVal)); setEditingTempo(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { handleTempoChange(Number(tempTempoVal)); setEditingTempo(false); } if (e.key === 'Escape') setEditingTempo(false); }}
              className="w-14 text-center font-mono text-xs bg-[#1a1a3a] border border-violet-500/40 rounded px-1 py-0.5 text-white outline-none"
            />
          ) : (
            <button
              onClick={() => { setTempTempoVal(String(tempo)); setEditingTempo(true); }}
              className="font-mono text-xs text-white hover:text-violet-300 transition-colors w-14 text-center"
              title="クリックで直接入力"
            >{tempo} BPM</button>
          )}
          <button onClick={() => handleTempoChange(tempo + 1)} className="h-5 w-5 rounded text-[10px] text-slate-500 hover:text-white hover:bg-white/5 transition-all">+</button>
        </div>

        {/* Key / time sig / style */}
        <div className="flex items-center gap-2">
          <span className="text-violet-300 font-medium text-xs">{song.analysis.detectedKey}</span>
          <span className="text-slate-500 text-xs">{bpb}/4</span>
          <span className="text-slate-600 text-xs hidden sm:inline">{styleInfo?.emoji} {styleInfo?.label}</span>
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <TBtn onClick={() => downloadMidi(song)} title="MIDI書き出し">⬇ MIDI</TBtn>
          {onConvertStyle && <TBtn onClick={onConvertStyle} title="スタイルを変換">🔄</TBtn>}
          {onGenerateLyrics && (
            <TBtn onClick={onGenerateLyrics} disabled={isGeneratingLyrics} title="歌詞を生成">
              {isGeneratingLyrics ? <SmSpin /> : '✍️'}
            </TBtn>
          )}
          {onSaveToLibrary && (
            <TBtn onClick={handleSave} disabled={saved} title={saved ? '保存済み' : 'ライブラリに保存'}>
              {saved ? <span className="text-emerald-400">✓</span> : '💾'}
            </TBtn>
          )}
        </div>
      </div>

      {/* ── TRACK PANEL + ARRANGEMENT ─────────────────────────────────────── */}
      <div className="flex" style={{ height: RULER_H + song.tracks.length * TRACK_H }}>

        {/* Left: track headers */}
        <div className="flex-none border-r border-[#1a1a3a]" style={{ width: 178 }}>
          {/* Ruler spacer */}
          <div
            className="border-b border-[#1a1a3a] flex items-end px-2 pb-0.5"
            style={{ height: RULER_H, background: '#0c0c1e' }}
          >
            <span className="text-[9px] text-slate-700 font-mono">TRACKS</span>
          </div>

          {/* Track rows */}
          {song.tracks.map((track, i) => {
            const state  = trackStates.get(i);
            const muted  = state?.muted ?? false;
            const volume = state?.volume ?? 1.0;
            const color  = TRACK_COLORS[i % TRACK_COLORS.length];
            return (
              <div
                key={i}
                className={`flex items-center border-b border-[#1a1a3a] ${i % 2 === 0 ? 'bg-[#080814]' : 'bg-[#060610]'}`}
                style={{ height: TRACK_H }}
              >
                {/* Color stripe */}
                <div style={{ width: 3, height: '100%', backgroundColor: muted ? '#333' : color, flexShrink: 0 }} />

                {/* Instrument info */}
                <div className="flex-1 min-w-0 px-1.5 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">{INSTR_EMOJI[track.instrument.toLowerCase()] ?? '🎵'}</span>
                    <span className={`text-[11px] truncate capitalize font-medium ${muted ? 'text-slate-600' : 'text-slate-300'}`}>
                      {track.instrument}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-slate-700 font-mono">{roleLabel(track.role)}</span>
                    <span className="text-[9px] text-slate-700">· {track.notes.length}n</span>
                  </div>
                </div>

                {/* Mute button */}
                <button
                  onClick={() => handleMuteToggle(i)}
                  className={`h-5 w-5 rounded text-[10px] font-bold flex-none transition-all mr-1 ${
                    muted
                      ? 'bg-red-500/25 text-red-400 border border-red-500/40'
                      : state
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-600 border border-white/10'
                  }`}
                  title={muted ? 'ミュート解除' : 'ミュート'}
                >M</button>

                {/* Volume fader */}
                <input
                  type="range" min={0} max={1} step={0.02} value={volume}
                  onChange={(e) => handleVolumeChange(i, Number(e.target.value))}
                  disabled={!state || muted}
                  className="flex-none mr-1.5 disabled:opacity-30 accent-violet-500"
                  style={{ width: 40, height: 4 }}
                  title={`音量 ${Math.round(volume * 100)}%`}
                />
              </div>
            );
          })}
        </div>

        {/* Right: arrangement canvas */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <canvas ref={arrangementRef} style={{ display: 'block' }} />
        </div>
      </div>

      {/* ── LYRICS PANEL (collapsible) ─────────────────────────────────────── */}
      {showLyrics && song.lyrics && (
        <div className="border-t border-[#1a1a3a] bg-[#080814] max-h-44 overflow-y-auto p-3">
          <pre className="whitespace-pre-wrap text-xs text-slate-300 leading-relaxed font-sans">
            {song.lyrics}
          </pre>
        </div>
      )}

      {/* ── SCORE EDITOR / PIANO ROLL ──────────────────────────────────────── */}
      <div className="border-t border-[#1a1a3a]">
        {/* Sub-toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a1a] border-b border-[#1a1a3a] flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg bg-[#060610] border border-[#1a1a3a] p-0.5 gap-0.5">
            <button
              onClick={() => setEditMode('score')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${editMode === 'score' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-600 hover:text-slate-400'}`}
            >✎ 楽譜編集</button>
            <button
              onClick={() => setEditMode('view')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${editMode === 'view' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-600 hover:text-slate-400'}`}
            >👁 表示</button>
          </div>

          {/* Song summary */}
          <p className="text-[10px] text-slate-600 flex-1 min-w-0 truncate hidden sm:block">
            {song.analysis.correctionsSummary}
          </p>

          {/* Lyrics toggle */}
          {song.lyrics && (
            <button
              onClick={() => setShowLyrics((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >{showLyrics ? '▾ 歌詞を閉じる' : '▸ 歌詞を表示'}</button>
          )}
        </div>

        {/* Editor area */}
        <div className="p-3">
          {editMode === 'score' ? (
            apiKey && onSongChange ? (
              <ScoreEditor song={song} apiKey={apiKey} onSongChange={onSongChange} />
            ) : (
              <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-6 text-center text-xs text-slate-500">
                楽譜編集にはAPIキーが必要です
              </div>
            )
          ) : (
            <PianoRoll song={song} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small reusable pieces ─────────────────────────────────────────────────────
function TBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[#252550] bg-[#10101e] text-xs text-slate-400 hover:text-white hover:border-[#3a3a70] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      {children}
    </button>
  );
}

function SmSpin() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
