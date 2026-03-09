'use client';

import { useState, useRef, useCallback } from 'react';
import type { DetectedNote } from '@/types/music';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 2048;
const MIN_CLARITY = 0.82;
const MIN_FREQ = 65;   // C2 — lowest practical singing note
const MAX_FREQ = 1200; // D6 — highest practical singing note
const MIN_HOLD_MS = 80;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function hzToNote(hz: number): string | null {
  if (hz <= 0) return null;
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  if (midi < 0 || midi > 127) return null;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export interface PitchDetectionResult {
  isRecording: boolean;
  currentNote: string | null;
  detectedNotes: DetectedNote[];
  error: string | null;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearNotes: () => void;
}

export function usePitchDetection(): PitchDetectionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const lastNoteRef = useRef<string | null>(null);
  const lastNoteStartRef = useRef<number>(0);
  const notesAccRef = useRef<DetectedNote[]>([]);

  const saveLastNote = useCallback((now: number) => {
    const held = now - lastNoteStartRef.current;
    if (lastNoteRef.current && held >= MIN_HOLD_MS) {
      const newNote: DetectedNote = {
        note: lastNoteRef.current,
        frequency: 0,
        timestamp: lastNoteStartRef.current,
        duration: held / 1000,
      };
      notesAccRef.current = [...notesAccRef.current, newNote];
      setDetectedNotes([...notesAccRef.current]);
    }
    lastNoteRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDetectedNotes([]);
      notesAccRef.current = [];
      lastNoteRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = BUFFER_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Dynamic import to avoid SSR issues with ESM-only pitchy
      const { PitchDetector } = await import('pitchy');
      const detector = PitchDetector.forFloat32Array(BUFFER_SIZE);
      const buffer = new Float32Array(BUFFER_SIZE);

      setIsRecording(true);

      const detect = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);

        const [freq, clarity] = detector.findPitch(buffer, SAMPLE_RATE);
        const now = Date.now();

        if (clarity >= MIN_CLARITY && freq >= MIN_FREQ && freq <= MAX_FREQ) {
          const note = hzToNote(freq);
          if (note) {
            setCurrentNote(note);
            if (lastNoteRef.current !== note) {
              saveLastNote(now);
              lastNoteRef.current = note;
              lastNoteStartRef.current = now;
            }
          }
        } else {
          if (lastNoteRef.current) {
            saveLastNote(now);
            setCurrentNote(null);
          }
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      detect();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('Permission')
            ? 'マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。'
            : err.message
          : 'マイクにアクセスできませんでした'
      );
    }
  }, [saveLastNote]);

  const stopRecording = useCallback(() => {
    saveLastNote(Date.now());

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();

    analyserRef.current = null;
    setIsRecording(false);
    setCurrentNote(null);
    lastNoteRef.current = null;
  }, [saveLastNote]);

  const clearNotes = useCallback(() => {
    setDetectedNotes([]);
    notesAccRef.current = [];
  }, []);

  return {
    isRecording,
    currentNote,
    detectedNotes,
    error,
    analyserRef,
    startRecording,
    stopRecording,
    clearNotes,
  };
}
