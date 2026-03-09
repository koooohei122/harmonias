export interface DetectedNote {
  note: string;      // e.g., "C4", "D#4"
  frequency: number; // Hz
  timestamp: number; // ms since epoch
  duration: number;  // seconds
}

export interface Note {
  note: string;      // e.g., "C4"
  duration: string;  // Tone.js format: "4n", "8n", "2n", "1n"
  startBeat: number; // beat number (0-indexed)
  velocity?: number; // 0.0 - 1.0
}

export interface ChordNote {
  notes: string[];   // array of notes, e.g., ["C3", "E3", "G3"]
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
}

export const STYLES = [
  { id: 'pop',        label: 'ポップ',         emoji: '🎵', labelEn: 'Pop' },
  { id: 'jazz',       label: 'ジャズ',         emoji: '🎷', labelEn: 'Jazz' },
  { id: 'classical',  label: 'クラシック',     emoji: '🎻', labelEn: 'Classical' },
  { id: 'rock',       label: 'ロック',         emoji: '🎸', labelEn: 'Rock' },
  { id: 'electronic', label: 'エレクトロ',     emoji: '🎛', labelEn: 'Electronic' },
  { id: 'bossanova',  label: 'ボサノバ',       emoji: '🌊', labelEn: 'Bossa Nova' },
  { id: 'rnb',        label: 'R&B',            emoji: '🎤', labelEn: 'R&B' },
  { id: 'folk',       label: 'フォーク',       emoji: '🪕', labelEn: 'Folk' },
] as const;

export const INSTRUMENTS = [
  { id: 'piano',    label: 'ピアノ',       emoji: '🎹' },
  { id: 'guitar',   label: 'ギター',       emoji: '🎸' },
  { id: 'bass',     label: 'ベース',       emoji: '🎸' },
  { id: 'drums',    label: 'ドラム',       emoji: '🥁' },
  { id: 'strings',  label: 'ストリングス', emoji: '🎻' },
  { id: 'flute',    label: 'フルート',     emoji: '🎵' },
  { id: 'trumpet',  label: 'トランペット', emoji: '🎺' },
  { id: 'synth',    label: 'シンセ',       emoji: '🎛' },
] as const;
