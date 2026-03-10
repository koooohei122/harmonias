import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { MelodyRecorder } from '@/components/MelodyRecorder';
import { StyleSelector } from '@/components/StyleSelector';
import { InstrumentSelector } from '@/components/InstrumentSelector';
import { MusicPlayer } from '@/components/MusicPlayer';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { composeSong } from '@/lib/claudeCompose';
import type { DetectedNote, Song } from '@/types/music';
import { STYLES, INSTRUMENTS } from '@/types/music';

type AppState = 'idle' | 'generating' | 'done' | 'error';

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
  const [appState, setAppState] = useState<AppState>('idle');
  const [song, setSong] = useState<Song | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

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
      const songData = await composeSong(apiKey, notes, style, instruments);
      setSong(songData);
      setAppState('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setAppState('error');
    }
  };

  const step1Done = notes.length > 0;
  const step2Active = step1Done;
  const step3Active = step1Done && !!apiKey;
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

      <main className="min-h-screen px-4 py-10 md:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-5xl animate-float">🎵</div>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                harmonias
              </span>
            </h1>
            <p className="text-slate-400 text-sm">口ずさんだメロディをAIが完全な曲に編曲</p>
          </div>

          <ApiKeyBanner apiKey={apiKey} onSave={handleSaveKey} />

          <Section step={1} title="メロディを録音" active={true} done={step1Done}>
            <MelodyRecorder onNotesChange={handleNotesChange} />
          </Section>

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
                  楽器 (複数選択可)
                </label>
                <InstrumentSelector selected={instruments} onChange={setInstruments} />
              </div>
            </div>
          </Section>

          <Section step={3} title="曲を生成" active={step3Active} done={appState === 'done'}>
            <div className="space-y-4">
              {!apiKey && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400/80">
                  ⬆ 上でAPIキーを設定してください
                </div>
              )}
              {notes.length === 0 && apiKey && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400/80">
                  ⬆ ステップ1でメロディを録音してください
                </div>
              )}
              {notes.length > 0 && apiKey && appState !== 'generating' && (
                <div className="rounded-lg border border-[#1a1a3a] bg-[#0d0d1f] px-4 py-3 text-sm text-slate-400">
                  <span className="text-violet-300">{notes.length}個の音符</span>を
                  <span className="text-cyan-300"> {styleLabel}</span>スタイルで、
                  <span className="text-violet-300"> {instrLabels}</span>を使って作曲します
                </div>
              )}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full rounded-xl py-4 text-base font-semibold transition-all duration-300 focus:outline-none focus:ring-4
                  ${isGenerating
                    ? 'cursor-wait bg-gradient-to-r from-violet-600 to-purple-700 text-white'
                    : !canGenerate
                      ? 'cursor-not-allowed bg-[#0d0d1f] text-slate-600 border border-[#1a1a3a]'
                      : 'bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] hover:scale-[1.02] focus:ring-violet-500/30'
                  }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />AIが作曲中...
                  </span>
                ) : '✨ 曲を生成する'}
              </button>
              {appState === 'error' && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>
          </Section>

          {appState === 'done' && song && (
            <Section step={4} title="生成された曲" active={true} done={false} highlight>
              <MusicPlayer song={song} />
            </Section>
          )}

          <p className="mt-12 text-center text-xs text-slate-700">
            powered by Claude claude-opus-4-6 + Tone.js
          </p>
        </div>
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
