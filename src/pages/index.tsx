import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { MelodyRecorder } from '@/components/MelodyRecorder';
import { StyleSelector } from '@/components/StyleSelector';
import { InstrumentSelector } from '@/components/InstrumentSelector';
import { EmotionSelector } from '@/components/EmotionSelector';
import { MusicPlayer } from '@/components/MusicPlayer';
import { SongLibrary } from '@/components/SongLibrary';
import { VoiceModeEditor } from '@/components/VoiceModeEditor';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { composeSong, recomposeSong, generateLyrics } from '@/lib/claudeCompose';
import { saveSong } from '@/lib/songLibrary';
import type { DetectedNote, Song, Note } from '@/types/music';
import { STYLES, INSTRUMENTS } from '@/types/music';

type AppState = 'idle' | 'generating' | 'done' | 'error';
type InputMode = 'hum' | 'voice-mode';

const STORAGE_KEY = 'harmonias_api_key';

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all
        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-violet-500 text-white' : 'bg-[#1a1a3a] text-slate-500'}`}
    >
      {done ? '✓' : n}
    </span>
  );
}

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [notes, setNotes] = useState<DetectedNote[]>([]);
  const [style, setStyle] = useState('pop');
  const [instruments, setInstruments] = useState<string[]>(['piano', 'guitar', 'bass']);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [song, setSong] = useState<Song | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('hum');
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [showStyleConvert, setShowStyleConvert] = useState(false);
  const [convertStyle, setConvertStyle] = useState('jazz');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setApiKey(saved);
  }, []);

  const handleSaveKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  }, []);

  const handleNotesChange = useCallback((n: DetectedNote[]) => {
    setNotes(n);
  }, []);

  const handleGenerate = async () => {
    if (notes.length === 0 || !apiKey) return;
    setAppState('generating');
    setErrorMsg('');
    try {
      const songData = await composeSong(
        apiKey, notes, style, instruments,
        emotion ?? undefined,
        userPrompt.trim() || undefined,
      );
      setSong(songData);
      setAppState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setAppState('error');
    }
  };

  const handleVoiceModeCompose = useCallback(async (voiceNotes: Note[]) => {
    if (!apiKey) return;
    // Convert Note[] to DetectedNote[] for composeSong
    const detectedNotes: DetectedNote[] = voiceNotes.map((n) => ({
      note: n.note,
      frequency: 0,
      timestamp: n.startBeat * 500,
      duration: n.duration === '1n' ? 2 : n.duration === '2n' ? 1 : n.duration === '4n' ? 0.5 : 0.25,
    }));
    setNotes(detectedNotes);
    setAppState('generating');
    setErrorMsg('');
    try {
      const songData = await composeSong(
        apiKey, detectedNotes, style, instruments,
        emotion ?? undefined,
        userPrompt.trim() || undefined,
      );
      setSong(songData);
      setAppState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setAppState('error');
    }
  }, [apiKey, style, instruments, emotion, userPrompt]);

  const handleGenerateLyrics = useCallback(async () => {
    if (!song || !apiKey) return;
    setIsGeneratingLyrics(true);
    try {
      const lyrics = await generateLyrics(apiKey, song);
      setSong((prev) => prev ? { ...prev, lyrics } : prev);
    } catch (err) {
      console.error('歌詞生成エラー:', err);
    } finally {
      setIsGeneratingLyrics(false);
    }
  }, [song, apiKey]);

  const handleConvertStyle = async () => {
    if (!song || !apiKey) return;
    setShowStyleConvert(false);
    setAppState('generating');
    setErrorMsg('');
    try {
      const newSong = await recomposeSong(apiKey, song, convertStyle, instruments, emotion ?? undefined);
      setSong(newSong);
      setAppState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setAppState('error');
    }
  };

  const handleSaveToLibrary = useCallback(() => {
    if (song) saveSong(song);
  }, [song]);

  const step1Done = notes.length > 0;
  const step2Active = step1Done || inputMode === 'voice-mode';
  const step3Active = (step1Done || inputMode === 'voice-mode') && !!apiKey;
  const isGenerating = appState === 'generating';
  const canGenerate = notes.length > 0 && !!apiKey && !isGenerating;

  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? style;
  const instrLabels = instruments
    .map((id) => INSTRUMENTS.find((i) => i.id === id)?.label ?? id)
    .join('、');

  return (
    <>
      <Head>
        <title>harmonias — 口ずさんだら曲になる</title>
        <meta name="description" content="ハミングしたメロディをAIが完全な曲に編曲するアプリ" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {showLibrary && (
        <SongLibrary
          onLoad={(loadedSong) => { setSong(loadedSong); setAppState('done'); }}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {showStyleConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#252550] bg-[#0d0d1f] p-6 space-y-4">
            <h3 className="font-semibold text-slate-200">スタイル変換</h3>
            <p className="text-sm text-slate-400">同じメロディを別のスタイルで再編曲します</p>
            <StyleSelector selected={convertStyle} onChange={setConvertStyle} />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowStyleConvert(false)}
                className="flex-1 rounded-xl border border-[#252550] py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConvertStyle}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-2.5 text-sm font-medium text-white"
              >
                変換する
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen px-4 py-10 md:py-16">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mb-3 text-5xl animate-float">🎵</div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                harmonias
              </span>
            </h1>
            <p className="text-slate-400 text-sm">口ずさんだメロディをAIが完全な曲に編曲</p>
            <button
              onClick={() => setShowLibrary(true)}
              className="mt-3 rounded-full border border-[#252550] bg-[#0d0d1f] px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:border-[#3a3a70] transition-all"
            >
              📚 保存した曲
            </button>
          </div>

          <ApiKeyBanner apiKey={apiKey} onSave={handleSaveKey} />

          {/* Step 1: Input mode */}
          <Section step={1} title="メロディを入力" active={true} done={step1Done}>
            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setInputMode('hum')}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all ${
                  inputMode === 'hum'
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-300'
                    : 'border-[#1a1a3a] bg-[#080812] text-slate-500 hover:text-slate-300'
                }`}
              >
                🎤 ハミング録音
              </button>
              <button
                onClick={() => setInputMode('voice-mode')}
                className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-all ${
                  inputMode === 'voice-mode'
                    ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                    : 'border-[#1a1a3a] bg-[#080812] text-slate-500 hover:text-slate-300'
                }`}
              >
                🎹 声モディモード
              </button>
            </div>

            {inputMode === 'hum' ? (
              <MelodyRecorder onNotesChange={handleNotesChange} />
            ) : (
              <VoiceModeEditor
                apiKey={apiKey}
                style={style}
                onCompose={handleVoiceModeCompose}
              />
            )}
          </Section>

          {/* Step 2: Style & Instruments */}
          <Section step={2} title="スタイルと楽器を選択" active={step2Active} done={false}>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  音楽スタイル
                </label>
                <StyleSelector selected={style} onChange={setStyle} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  楽器 (複数選択可 · {instruments.length}個選択中)
                </label>
                <InstrumentSelector selected={instruments} onChange={setInstruments} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  ムード・感情 (任意)
                </label>
                <EmotionSelector selected={emotion} onChange={setEmotion} />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  アレンジ指示 (任意)
                </label>
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="例: ドラムを激しめに、イントロはピアノソロで..."
                  className="w-full rounded-xl border border-[#1a1a3a] bg-[#080812] px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>
          </Section>

          {/* Step 3: Generate */}
          <Section step={3} title="曲を生成" active={step3Active} done={appState === 'done'}>
            <div className="space-y-4">
              {!apiKey && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400/80">
                  ⬆ 上でAPIキーを設定してください
                </div>
              )}
              {notes.length === 0 && apiKey && inputMode === 'hum' && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400/80">
                  ⬆ ステップ1でメロディを録音してください
                </div>
              )}
              {notes.length > 0 && apiKey && appState !== 'generating' && (
                <div className="rounded-lg border border-[#1a1a3a] bg-[#0d0d1f] px-4 py-3 text-sm text-slate-400">
                  <span className="text-violet-300">{notes.length}個の音符</span>を
                  <span className="text-cyan-300"> {styleLabel}</span>スタイルで、
                  <span className="text-violet-300"> {instrLabels}</span>
                  {emotion && <><span className="text-pink-300"> / {emotion}気分</span></>}
                  で作曲します
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || inputMode === 'voice-mode'}
                className={`w-full rounded-xl py-4 text-base font-semibold transition-all duration-300 focus:outline-none focus:ring-4
                  ${isGenerating
                    ? 'cursor-wait bg-gradient-to-r from-violet-600 to-purple-700 text-white'
                    : (!canGenerate || inputMode === 'voice-mode')
                      ? 'cursor-not-allowed bg-[#0d0d1f] text-slate-600 border border-[#1a1a3a]'
                      : 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:scale-[1.02] focus:ring-violet-500/30'
                  }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />AIが作曲中...
                  </span>
                ) : inputMode === 'voice-mode' ? '← 声モディモードで「編曲する」を押してください' : '✨ 曲を生成する'}
              </button>
              {appState === 'error' && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>
          </Section>

        </div>

        {/* Step 4: Result — full-width DAW, outside the narrow container */}
        {appState === 'done' && song && (
          <div className="mx-auto max-w-5xl px-4 mt-[-1.5rem]">
            <Section step={4} title="生成された曲" active={true} done={false} highlight>
              <MusicPlayer
                song={song}
                apiKey={apiKey}
                onSongChange={setSong}
                onGenerateLyrics={handleGenerateLyrics}
                isGeneratingLyrics={isGeneratingLyrics}
                onConvertStyle={() => setShowStyleConvert(true)}
                onSaveToLibrary={handleSaveToLibrary}
              />
            </Section>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-slate-700">
          powered by Claude claude-opus-4-6 + Tone.js
        </p>
      </main>
    </>
  );
}

function Section({ step, title, active, done, highlight, children }: {
  step: number; title: string; active: boolean; done: boolean; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`mb-6 rounded-2xl border p-6 transition-all duration-300
      ${highlight
        ? 'border-violet-500/40 bg-gradient-to-b from-violet-500/8 to-[#0d0d1f] shadow-[0_0_30px_rgba(139,92,246,0.1)]'
        : active ? 'border-[#1a1a3a] bg-[#0d0d1f]' : 'border-[#111128] bg-[#090915] opacity-60'}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <StepBadge n={step} active={active} done={done} />
        <h2 className={`font-semibold ${active ? 'text-slate-200' : 'text-slate-600'}`}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
