export interface DetectedNote {
  note: string;
  frequency: number;
  timestamp: number;
  duration: number;
}

export interface Note {
  note: string;
  duration: string;
  startBeat: number;
  velocity?: number;
}

export interface ChordNote {
  notes: string[];
  duration: string;
  startBeat: number;
  velocity?: number;
}

export type TrackNote = Note | ChordNote;

export interface Track {
  instrument: string;
  role: 'melody' | 'chords' | 'bass' | 'rhythm' | 'harmony' | 'percussion';
  notes: TrackNote[];
}

export interface SongAnalysis {
  detectedKey: string;
  timeSignature: [number, number];
  tempo: number;
  correctionsSummary: string;
  style: string;
}

export interface Song {
  analysis: SongAnalysis;
  correctedMelody: Note[];
  tracks: Track[];
  totalBeats: number;
  lyrics?: string;
}

export interface LibrarySong {
  id: string;
  name: string;
  createdAt: number;
  song: Song;
}

export const EMOTIONS = [
  { id: 'happy',      label: '楽しい',       emoji: '😊' },
  { id: 'sad',        label: '悲しい',       emoji: '😢' },
  { id: 'excited',    label: '興奮',         emoji: '🔥' },
  { id: 'calm',       label: '穏やか',       emoji: '🌊' },
  { id: 'romantic',   label: 'ロマンチック', emoji: '💕' },
  { id: 'angry',      label: '激しい',       emoji: '⚡' },
  { id: 'nostalgic',  label: '懐かしい',     emoji: '🌅' },
  { id: 'mysterious', label: '神秘的',       emoji: '🌙' },
] as const;

export type EmotionId = typeof EMOTIONS[number]['id'];

export const STYLES = [
  { id: 'pop',        label: 'ポップ',     emoji: '🎵', labelEn: 'Pop' },
  { id: 'jazz',       label: 'ジャズ',     emoji: '🎷', labelEn: 'Jazz' },
  { id: 'classical',  label: 'クラシック', emoji: '🎻', labelEn: 'Classical' },
  { id: 'rock',       label: 'ロック',     emoji: '🎸', labelEn: 'Rock' },
  { id: 'electronic', label: 'エレクトロ', emoji: '🎛', labelEn: 'Electronic' },
  { id: 'bossanova',  label: 'ボサノバ',   emoji: '🌊', labelEn: 'Bossa Nova' },
  { id: 'rnb',        label: 'R&B',        emoji: '🎤', labelEn: 'R&B' },
  { id: 'folk',       label: 'フォーク',   emoji: '🪕', labelEn: 'Folk' },
] as const;

export const INSTRUMENTS = [
  { id: 'piano',      label: 'ピアノ',         emoji: '🎹' },
  { id: 'guitar',     label: 'ギター',         emoji: '🎸' },
  { id: 'bass',       label: 'ベース',         emoji: '🎵' },
  { id: 'drums',      label: 'ドラム',         emoji: '🥁' },
  { id: 'strings',    label: 'ストリングス',   emoji: '🎻' },
  { id: 'violin',     label: 'バイオリン',     emoji: '🎻' },
  { id: 'cello',      label: 'チェロ',         emoji: '🎻' },
  { id: 'harp',       label: 'ハープ',         emoji: '🪕' },
  { id: 'flute',      label: 'フルート',       emoji: '🎵' },
  { id: 'oboe',       label: 'オーボエ',       emoji: '🎵' },
  { id: 'clarinet',   label: 'クラリネット',   emoji: '🎵' },
  { id: 'saxophone',  label: 'サックス',       emoji: '🎷' },
  { id: 'trumpet',    label: 'トランペット',   emoji: '🎺' },
  { id: 'organ',      label: 'オルガン',       emoji: '🎹' },
  { id: 'accordion',  label: 'アコーディオン', emoji: '🪗' },
  { id: 'marimba',    label: 'マリンバ',       emoji: '🎵' },
  { id: 'vibraphone', label: 'ビブラフォン',   emoji: '✨' },
  { id: 'choir',      label: 'コーラス',       emoji: '🎤' },
  { id: 'synth',      label: 'シンセ',         emoji: '🎛' },
] as const;
