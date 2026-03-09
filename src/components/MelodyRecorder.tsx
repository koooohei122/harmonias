'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import type { DetectedNote } from '@/types/music';

interface MelodyRecorderProps {
  onNotesChange: (notes: DetectedNote[]) => void;
}

const NOTE_COLORS: Record<string, string> = {
  C: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'C#': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  D: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'D#': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  E: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  F: 'bg-green-500/20 text-green-300 border-green-500/30',
  'F#': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  G: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'G#': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  A: 'bg-red-500/20 text-red-300 border-red-500/30',
  'A#': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  B: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

function getNoteColor(note: string) {
  const noteName = note.replace(/[0-9]/g, '');
  return NOTE_COLORS[noteName] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

function durationToStr(duration: number): string {
  if (duration < 0.3) return '短';
  if (duration < 0.6) return '中';
  return '長';
}

export function MelodyRecorder({ onNotesChange }: MelodyRecorderProps) {
  const {
    isRecording,
    currentNote,
    detectedNotes,
    error,
    analyserRef,
    startRecording,
    stopRecording,
    clearNotes,
  } = usePitchDetection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  // Notify parent when notes change
  useEffect(() => {
    onNotesChange(detectedNotes);
  }, [detectedNotes, onNotesChange]);

  // Waveform drawing
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(data);

    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, 'rgba(139, 92, 246, 0.0)');
    bg.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
    bg.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Waveform
    ctx.lineWidth = 2;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#8b5cf6');
    grad.addColorStop(0.5, '#22d3ee');
    grad.addColorStop(1, '#8b5cf6');
    ctx.strokeStyle = grad;
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 8;

    ctx.beginPath();
    const sliceW = W / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * H) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    animRef.current = requestAnimationFrame(drawWaveform);
  }, [analyserRef]);

  // Idle waveform animation
  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const t = Date.now() / 800;

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const y = H / 2 + Math.sin((x / W) * Math.PI * 4 + t) * 6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    animRef.current = requestAnimationFrame(drawIdle);
  }, []);

  useEffect(() => {
    if (isRecording) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      drawWaveform();
    } else {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      drawIdle();
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRecording, drawWaveform, drawIdle]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Visualizer + record button */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={600}
          height={120}
          className="absolute inset-0 h-full w-full rounded-xl"
        />

        <div className="relative z-10 flex flex-col items-center gap-4 py-6">
          {/* Current note display */}
          <div className="h-14 flex items-center justify-center">
            {isRecording && currentNote ? (
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold text-white tracking-wide drop-shadow-lg">
                  {currentNote.replace(/[0-9]/g, '')}
                </span>
                <span className="text-xs text-slate-400">{currentNote}</span>
              </div>
            ) : isRecording ? (
              <span className="text-slate-500 text-sm">音を出してください...</span>
            ) : (
              <span className="text-slate-600 text-sm">
                {detectedNotes.length > 0 ? `${detectedNotes.length}個の音符を検出` : '録音ボタンを押して開始'}
              </span>
            )}
          </div>

          {/* Record button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative h-20 w-20 rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-violet-500/50
              ${isRecording
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse-ring'
                : 'bg-gradient-to-br from-violet-500 to-purple-700 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:scale-105'
              }`}
          >
            {isRecording ? (
              <span className="flex items-center justify-center">
                <span className="block h-7 w-7 rounded-sm bg-white" />
              </span>
            ) : (
              <span className="text-3xl flex items-center justify-center">🎤</span>
            )}
          </button>

          <span className="text-xs text-slate-500">
            {isRecording ? '停止するにはもう一度クリック' : 'クリックして録音開始'}
          </span>
        </div>
      </div>

      {/* Detected notes */}
      {detectedNotes.length > 0 && (
        <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              検出された音符 ({detectedNotes.length}個)
            </span>
            <button
              onClick={clearNotes}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              クリア
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {detectedNotes.map((n, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${getNoteColor(n.note)}`}
                title={`${(n.duration * 1000).toFixed(0)}ms`}
              >
                {n.note}
                <span className="opacity-50 text-[10px]">{durationToStr(n.duration)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
