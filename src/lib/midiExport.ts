import type { Song, Note, ChordNote, TrackNote } from '@/types/music';

const TICKS_PER_BEAT = 480;

const NOTE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

const DURATION_MAP: Record<string, number> = {
  '1n':  TICKS_PER_BEAT * 4,
  '2n':  TICKS_PER_BEAT * 2,
  '4n':  TICKS_PER_BEAT,
  '8n':  TICKS_PER_BEAT / 2,
  '16n': TICKS_PER_BEAT / 4,
  '32n': TICKS_PER_BEAT / 8,
};

const INSTRUMENT_TO_GM: Record<string, number> = {
  piano: 0,
  guitar: 25,
  bass: 33,
  strings: 48,
  violin: 40,
  cello: 42,
  harp: 46,
  flute: 73,
  oboe: 68,
  clarinet: 71,
  saxophone: 65,
  trumpet: 56,
  organ: 19,
  accordion: 21,
  marimba: 12,
  vibraphone: 11,
  choir: 52,
  synth: 80,
  drums: 0,
};

function noteNameToMidi(name: string): number | null {
  const match = name.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) return null;
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const noteIndex = NOTE_MAP[noteName];
  if (noteIndex === undefined) return null;
  return 12 + (octave + 1) * 12 + noteIndex;
}

function durationToTicks(duration: string): number {
  if (duration.endsWith('.')) {
    const base = DURATION_MAP[duration.slice(0, -1)];
    return base ? Math.round(base * 1.5) : TICKS_PER_BEAT;
  }
  return DURATION_MAP[duration] ?? TICKS_PER_BEAT;
}

function isChordNote(n: TrackNote): n is ChordNote {
  return Array.isArray((n as ChordNote).notes);
}

function writeVarLen(value: number): number[] {
  const bytes: number[] = [];
  bytes.unshift(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return bytes;
}

function writeUint32BE(value: number): number[] {
  return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
}

function writeUint16BE(value: number): number[] {
  return [(value >> 8) & 0xFF, value & 0xFF];
}

interface MidiEvent {
  tick: number;
  data: number[];
}

function buildTrackChunk(events: MidiEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick);
  const trackData: number[] = [];
  let currentTick = 0;
  for (const event of events) {
    const delta = event.tick - currentTick;
    currentTick = event.tick;
    trackData.push(...writeVarLen(delta), ...event.data);
  }
  trackData.push(...writeVarLen(0), 0xFF, 0x2F, 0x00);
  return [0x4D, 0x54, 0x72, 0x6B, ...writeUint32BE(trackData.length), ...trackData];
}

function buildTempoTrack(tempo: number): number[] {
  const us = Math.round(60_000_000 / tempo);
  const events: MidiEvent[] = [{
    tick: 0,
    data: [0xFF, 0x51, 0x03, (us >> 16) & 0xFF, (us >> 8) & 0xFF, us & 0xFF],
  }];
  return buildTrackChunk(events);
}

export function exportMidi(song: Song): Uint8Array {
  const trackChunks: number[][] = [buildTempoTrack(song.analysis.tempo)];
  let channel = 0;

  for (const track of song.tracks) {
    const isDrums = track.instrument === 'drums';
    const ch = isDrums ? 9 : (channel % 9 >= 9 ? channel % 9 + 1 : channel % 9);
    if (!isDrums) channel++;

    const gmProgram = INSTRUMENT_TO_GM[track.instrument] ?? 0;
    const events: MidiEvent[] = [];

    if (!isDrums) {
      events.push({ tick: 0, data: [0xC0 | ch, gmProgram] });
    }

    for (const n of track.notes) {
      const tickStart = Math.round(n.startBeat * TICKS_PER_BEAT);
      const tickDur = durationToTicks(n.duration);
      const vel = Math.round((n.velocity ?? 0.7) * 127);
      const noteNames = isChordNote(n) ? n.notes : [(n as Note).note];

      for (const noteName of noteNames) {
        const midiNote = noteNameToMidi(noteName);
        if (midiNote === null || midiNote < 0 || midiNote > 127) continue;
        events.push({ tick: tickStart, data: [0x90 | ch, midiNote, vel] });
        events.push({ tick: tickStart + tickDur - 1, data: [0x80 | ch, midiNote, 0] });
      }
    }

    trackChunks.push(buildTrackChunk(events));
  }

  const numTracks = trackChunks.length;
  const header = [
    0x4D, 0x54, 0x68, 0x64,
    ...writeUint32BE(6),
    ...writeUint16BE(1),
    ...writeUint16BE(numTracks),
    ...writeUint16BE(TICKS_PER_BEAT),
  ];

  return new Uint8Array([...header, ...trackChunks.flat()]);
}

export function downloadMidi(song: Song, filename = 'harmonias.mid'): void {
  const data = exportMidi(song);
  const blob = new Blob([data], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
