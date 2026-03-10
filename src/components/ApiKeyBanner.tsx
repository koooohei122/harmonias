import { useState } from 'react';

interface ApiKeyBannerProps {
  apiKey: string;
  onSave: (key: string) => void;
}

export function ApiKeyBanner({ apiKey, onSave }: ApiKeyBannerProps) {
  const [editing, setEditing] = useState(!apiKey);
  const [input, setInput] = useState('');

  if (!editing && apiKey) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm">
        <span className="text-emerald-400">✓ APIキー設定済み</span>
        <button
          onClick={() => { setInput(''); setEditing(true); }}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          変更
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
      <p className="mb-3 text-sm text-amber-300 font-medium">
        🔑 Anthropic APIキーを入力してください
      </p>
      <p className="mb-3 text-xs text-slate-500">
        キーはブラウザにのみ保存されます。
        <a
          href="https://console.anthropic.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-amber-400/80 underline hover:text-amber-400"
        >
          console.anthropic.com で取得
        </a>
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.startsWith('sk-')) {
              onSave(input);
              setEditing(false);
            }
          }}
          placeholder="sk-ant-..."
          className="flex-1 rounded-lg border border-[#252550] bg-[#080812] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-amber-500/50 focus:outline-none"
        />
        <button
          onClick={() => {
            if (input.startsWith('sk-')) {
              onSave(input);
              setEditing(false);
            }
          }}
          disabled={!input.startsWith('sk-')}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-all hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          保存
        </button>
      </div>
    </div>
  );
}
