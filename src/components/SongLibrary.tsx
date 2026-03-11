import { useState, useEffect, useCallback } from 'react';
import { loadLibrary, deleteSong, renameSong } from '@/lib/songLibrary';
import type { LibrarySong, Song } from '@/types/music';
import { STYLES } from '@/types/music';

interface SongLibraryProps {
  onLoad: (song: Song) => void;
  onClose: () => void;
}

export function SongLibrary({ onLoad, onClose }: SongLibraryProps) {
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const refresh = useCallback(() => setSongs(loadLibrary()), []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = (id: string) => {
    deleteSong(id);
    refresh();
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) {
      renameSong(id, editingName.trim());
      refresh();
    }
    setEditingId(null);
  };

  const styleEmoji = (styleId: string) =>
    STYLES.find((s) => s.id === styleId.toLowerCase())?.emoji ?? '🎵';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#252550] bg-[#0d0d1f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1a1a3a] px-6 py-4">
          <h2 className="font-semibold text-slate-200">保存した曲</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {songs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              保存した曲はまだありません
            </div>
          ) : (
            <ul className="divide-y divide-[#1a1a3a]">
              {songs.map((entry) => (
                <li key={entry.id} className="px-6 py-4 hover:bg-[#131326] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{styleEmoji(entry.song.analysis.style)}</span>
                    <div className="flex-1 min-w-0">
                      {editingId === entry.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(entry.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => handleRename(entry.id)}
                          className="w-full rounded border border-violet-500/50 bg-[#080812] px-2 py-1 text-sm text-slate-200 focus:outline-none"
                        />
                      ) : (
                        <div
                          className="truncate text-sm font-medium text-slate-200 cursor-pointer hover:text-violet-300"
                          onClick={() => { setEditingId(entry.id); setEditingName(entry.name); }}
                          title="クリックで名前変更"
                        >
                          {entry.name}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-slate-500">
                        {entry.song.analysis.detectedKey} · {entry.song.analysis.tempo} BPM ·{' '}
                        {new Date(entry.createdAt).toLocaleString('ja-JP', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { onLoad(entry.song); onClose(); }}
                        className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/30 transition-colors"
                      >
                        読み込む
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#1a1a3a] px-6 py-3">
          <p className="text-xs text-slate-600">最大30曲まで保存できます（ブラウザのローカルストレージ）</p>
        </div>
      </div>
    </div>
  );
}
