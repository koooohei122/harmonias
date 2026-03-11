import type { Song, LibrarySong } from '@/types/music';

const LIBRARY_KEY = 'harmonias_library';
const MAX_SONGS = 30;

export function loadLibrary(): LibrarySong[] {
  try {
    const data = localStorage.getItem(LIBRARY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSong(song: Song, name?: string): LibrarySong {
  const library = loadLibrary();
  const styleLabel = song.analysis.style;
  const defaultName = `${styleLabel} / ${song.analysis.detectedKey} / ${new Date().toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  const entry: LibrarySong = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name ?? defaultName,
    createdAt: Date.now(),
    song,
  };
  library.unshift(entry);
  if (library.length > MAX_SONGS) library.splice(MAX_SONGS);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  return entry;
}

export function deleteSong(id: string): void {
  const library = loadLibrary().filter((s) => s.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function renameSong(id: string, name: string): void {
  const library = loadLibrary().map((s) => s.id === id ? { ...s, name } : s);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}
