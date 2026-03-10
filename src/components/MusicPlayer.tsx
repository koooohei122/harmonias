import { useState, useEffect, useRef } from 'react';
import { TonePlayer } from '@/lib/tonePlayer';
import type { Song } from '@/types/music';
import { STYLES } from '@/types/music';

interface MusicPlayerProps {
  song: Song;
}

type PlayState = 'stopped' | 'playing' | 'paused';

export function MusicPlayer({ song }: MusicPlayerProps) {
  const [playState, setPlayState] = useState<PlayState>('stopped');
  const playerRef = useRef<TonePlayer | null>(null);

  useEffect(() => {
    playerRef.current = new TonePlayer();
    return () => {
      playerRef.current?.stop();
    };
  }, []);

  // Reset when song changes
  useEffect(() => {
    playerRef.current?.stop();
    setPlayState('stopped');
  }, [song]);

  const handlePlay = async () => {
    if (!playerRef.current) return;

    if (playState === 'stopped') {
      setPlayState('playing');
      await playerRef.current.playSong(song, () => {
        setPlayState('stopped');
      });
    } else if (playState === 'playing') {
      await playerRef.current.pause();
      setPlayState('paused');
    } else if (playState === 'paused') {
      await playerRef.current.pause();
      setPlayState('playing');
    }
  };

  const handleStop = async () => {
    if (!playerRef.current) return;
    await playerRef.current.stop();
    setPlayState('stopped');
  };

  const styleInfo = STYLES.find((s) => s.id === song.analysis.style.toLowerCase()) ?? STYLES[0];
  const { analysis } = song;

  return (
    <div className="space-y-5">
      {/* Song info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'キー', value: analysis.detectedKey },
          { label: 'テンポ', value: `${analysis.tempo} BPM` },
          { label: '拍子', value: `${analysis.timeSignature[0]}/${analysis.timeSignature[1]}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4 text-center"
          >
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Analysis */}
      <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">{styleInfo?.emoji ?? '🎵'}</span>
          <span className="text-sm font-medium text-violet-300">
            {styleInfo?.label ?? analysis.style} スタイル
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">{analysis.correctionsSummary}</p>
      </div>

      {/* Track list */}
      <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
        <div className="text-xs font-medium text-slate-500 mb-3">トラック構成</div>
        <div className="space-y-2">
          {song.tracks.map((track, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm text-slate-300 capitalize">{track.instrument}</span>
              <span className="text-xs text-slate-500 bg-[#131326] px-2 py-0.5 rounded-full">
                {roleLabel(track.role)} · {track.notes.length}音符
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleStop}
          disabled={playState === 'stopped'}
          className="h-12 w-12 rounded-full border border-[#252550] bg-[#131326] flex items-center justify-center text-slate-400 hover:text-white hover:border-[#3a3a70] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ⏹
        </button>

        <button
          onClick={handlePlay}
          className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl transition-all duration-300 shadow-lg focus:outline-none focus:ring-4
            ${playState === 'playing'
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_20px_rgba(245,158,11,0.4)] focus:ring-amber-500/30 animate-pulse-ring'
              : 'bg-gradient-to-br from-violet-500 to-purple-700 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:scale-105 focus:ring-violet-500/30'
            }`}
        >
          {playState === 'playing' ? '⏸' : playState === 'paused' ? '▶️' : '▶'}
        </button>

        <div className="h-12 w-12 flex items-center justify-center">
          {playState === 'playing' && (
            <PlayingIndicator />
          )}
        </div>
      </div>

      {playState !== 'stopped' && (
        <p className="text-center text-xs text-slate-600">
          {playState === 'playing' ? '演奏中...' : '一時停止中'}
        </p>
      )}
    </div>
  );
}

function PlayingIndicator() {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-1 bg-violet-400 rounded-full"
          style={{
            animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
            height: `${50 + i * 15}%`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bounce {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    melody: 'メロディ',
    chords: 'コード',
    bass: 'ベース',
    rhythm: 'リズム',
    harmony: 'ハーモニー',
    percussion: 'パーカッション',
  };
  return map[role] ?? role;
}
