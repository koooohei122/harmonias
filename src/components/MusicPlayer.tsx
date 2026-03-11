import { useState, useEffect, useRef, useCallback } from 'react';
import { TonePlayer, type TrackState } from '@/lib/tonePlayer';
import { downloadMidi } from '@/lib/midiExport';
import { PianoRoll } from '@/components/PianoRoll';
import type { Song } from '@/types/music';
import { STYLES } from '@/types/music';

interface MusicPlayerProps {
  song: Song;
  onGenerateLyrics?: () => Promise<void>;
  isGeneratingLyrics?: boolean;
  onConvertStyle?: () => void;
  onSaveToLibrary?: () => void;
}

type PlayState = 'stopped' | 'playing' | 'paused';
type Tab = 'controls' | 'tracks' | 'piano-roll' | 'lyrics';

export function MusicPlayer({
  song,
  onGenerateLyrics,
  isGeneratingLyrics,
  onConvertStyle,
  onSaveToLibrary,
}: MusicPlayerProps) {
  const [playState, setPlayState] = useState<PlayState>('stopped');
  const [loop, setLoop] = useState(false);
  const [tempo, setTempo] = useState(song.analysis.tempo);
  const [trackStates, setTrackStates] = useState<Map<number, TrackState>>(new Map());
  const [activeTab, setActiveTab] = useState<Tab>('controls');
  const [saved, setSaved] = useState(false);
  const playerRef = useRef<TonePlayer | null>(null);

  useEffect(() => {
    playerRef.current = new TonePlayer();
    return () => { playerRef.current?.stop(); };
  }, []);

  useEffect(() => {
    playerRef.current?.stop();
    setPlayState('stopped');
    setTempo(song.analysis.tempo);
    setTrackStates(new Map());
    setSaved(false);
  }, [song]);

  useEffect(() => {
    playerRef.current?.setLoop(loop);
  }, [loop]);

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

  const handleTempoChange = useCallback(async (newTempo: number) => {
    setTempo(newTempo);
    await playerRef.current?.setTempo(newTempo);
  }, []);

  const handleMuteToggle = useCallback((trackIdx: number) => {
    const state = trackStates.get(trackIdx);
    if (!state) return;
    const newMuted = !state.muted;
    playerRef.current?.setTrackMute(trackIdx, newMuted);
    setTrackStates((prev) => {
      const next = new Map(prev);
      const s = next.get(trackIdx);
      if (s) next.set(trackIdx, { ...s, muted: newMuted });
      return next;
    });
  }, [trackStates]);

  const handleVolumeChange = useCallback((trackIdx: number, volume: number) => {
    playerRef.current?.setTrackVolume(trackIdx, volume);
    setTrackStates((prev) => {
      const next = new Map(prev);
      const s = next.get(trackIdx);
      if (s) next.set(trackIdx, { ...s, volume });
      return next;
    });
  }, []);

  const handleSave = () => {
    onSaveToLibrary?.();
    setSaved(true);
  };

  const styleInfo = STYLES.find((s) => s.id === song.analysis.style.toLowerCase()) ?? STYLES[0];
  const { analysis } = song;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'controls', label: '再生' },
    { id: 'tracks', label: 'トラック' },
    { id: 'piano-roll', label: 'ピアノロール' },
    { id: 'lyrics', label: '歌詞' },
  ];

  return (
    <div className="space-y-4">
      {/* Song info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'キー', value: analysis.detectedKey },
          { label: 'テンポ', value: `${tempo} BPM` },
          { label: '拍子', value: `${analysis.timeSignature[0]}/${analysis.timeSignature[1]}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="font-bold text-white text-sm">{value}</div>
          </div>
        ))}
      </div>

      {/* Analysis */}
      <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-lg">{styleInfo?.emoji ?? '🎵'}</span>
          <span className="text-sm font-medium text-violet-300">
            {styleInfo?.label ?? analysis.style} スタイル
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">{analysis.correctionsSummary}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[#0a0a1a] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-violet-500/20 text-violet-300'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'controls' && (
        <div className="space-y-4">
          {/* Tempo slider */}
          <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">テンポ調整</span>
              <span className="text-xs font-mono text-violet-300">{tempo} BPM</span>
            </div>
            <input
              type="range" min={40} max={220} value={tempo}
              onChange={(e) => handleTempoChange(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>40 (遅い)</span><span>220 (速い)</span>
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

            <button
              onClick={() => setLoop(!loop)}
              className={`h-12 w-12 rounded-full border flex items-center justify-center text-lg transition-all ${
                loop
                  ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                  : 'border-[#252550] bg-[#131326] text-slate-500 hover:text-slate-300'
              }`}
              title={loop ? 'ループ中（クリックで解除）' : 'ループ再生'}
            >
              🔁
            </button>
          </div>

          {playState !== 'stopped' && (
            <p className="text-center text-xs text-slate-600">
              {playState === 'playing' ? (loop ? '演奏中（ループ）...' : '演奏中...') : '一時停止中'}
            </p>
          )}
        </div>
      )}

      {activeTab === 'tracks' && (
        <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4 space-y-3">
          <p className="text-xs text-slate-600 mb-1">
            {trackStates.size === 0 ? '再生を開始するとコントロールが有効になります' : 'ミュート・音量をトラックごとに調整できます'}
          </p>
          {song.tracks.map((track, i) => {
            const state = trackStates.get(i);
            const muted = state?.muted ?? false;
            const volume = state?.volume ?? 1.0;
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMuteToggle(i)}
                      disabled={!state}
                      className={`h-6 w-6 rounded text-xs font-bold transition-all disabled:opacity-30 ${
                        muted
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}
                      title={muted ? 'ミュート解除' : 'ミュート'}
                    >
                      {muted ? 'M' : '♪'}
                    </button>
                    <span className="text-sm text-slate-300 capitalize">{track.instrument}</span>
                  </div>
                  <span className="text-xs text-slate-500 bg-[#131326] px-2 py-0.5 rounded-full">
                    {roleLabel(track.role)} · {track.notes.length}音符
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-8">
                  <span className="text-[10px] text-slate-600">🔉</span>
                  <input
                    type="range" min={0} max={1} step={0.01} value={volume}
                    onChange={(e) => handleVolumeChange(i, Number(e.target.value))}
                    disabled={!state || muted}
                    className="flex-1 accent-cyan-500 disabled:opacity-30"
                  />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'piano-roll' && <PianoRoll song={song} />}

      {activeTab === 'lyrics' && (
        <div className="rounded-xl border border-[#1a1a3a] bg-[#0d0d1f] p-4">
          {song.lyrics ? (
            <pre className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed font-sans">
              {song.lyrics}
            </pre>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-slate-500 text-sm">歌詞がまだ生成されていません</p>
              {onGenerateLyrics && (
                <button
                  onClick={onGenerateLyrics}
                  disabled={isGeneratingLyrics}
                  className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
                >
                  {isGeneratingLyrics ? (
                    <span className="flex items-center gap-2"><Spinner />生成中...</span>
                  ) : '✍️ 歌詞を生成する'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadMidi(song)}
          className="flex-1 rounded-xl border border-[#252550] bg-[#131326] py-2.5 text-sm text-slate-300 hover:text-white hover:border-[#3a3a70] transition-all"
        >
          ⬇ MIDI保存
        </button>
        {onConvertStyle && (
          <button
            onClick={onConvertStyle}
            className="flex-1 rounded-xl border border-[#252550] bg-[#131326] py-2.5 text-sm text-slate-300 hover:text-white hover:border-[#3a3a70] transition-all"
          >
            🔄 スタイル変換
          </button>
        )}
        {onSaveToLibrary && (
          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex-1 rounded-xl border py-2.5 text-sm transition-all ${
              saved
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-[#252550] bg-[#131326] text-slate-300 hover:text-white hover:border-[#3a3a70]'
            }`}
          >
            {saved ? '✓ 保存済み' : '💾 ライブラリに保存'}
          </button>
        )}
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    melody: 'メロディ', chords: 'コード', bass: 'ベース',
    rhythm: 'リズム', harmony: 'ハーモニー', percussion: 'パーカッション',
  };
  return map[role] ?? role;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
