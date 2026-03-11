import type { Song, Track, TrackNote, Note, ChordNote } from '@/types/music';

function isChordNote(note: TrackNote): note is ChordNote {
  return Array.isArray((note as ChordNote).notes);
}

function beatToTime(beat: number, beatsPerBar: number): string {
  const bar = Math.floor(beat / beatsPerBar);
  const beatInBar = beat % beatsPerBar;
  return `${bar}:${beatInBar}:0`;
}

function createSynth(Tone: typeof import('tone'), instrument: string) {
  const reverb = new Tone.Freeverb({ roomSize: 0.4, dampening: 3000, wet: 0.2 }).toDestination();

  switch (instrument.toLowerCase()) {
    case 'piano':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 1.8 },
        volume: -6,
      }).connect(reverb);

    case 'guitar':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.6 },
        volume: -8,
      }).connect(reverb);

    case 'bass':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.4 },
        volume: -4,
      }).connect(reverb);

    case 'strings':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.1, sustain: 0.9, release: 2.0 },
        volume: -8,
      }).connect(reverb);

    case 'flute':
      return new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.12, decay: 0.05, sustain: 0.8, release: 0.6 },
        volume: -10,
      }).connect(reverb);

    case 'trumpet':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.4 },
        volume: -8,
      }).connect(reverb);

    case 'drums':
      return new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
        volume: -4,
      }).connect(reverb);

    case 'synth':
    default:
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 },
        volume: -8,
      }).connect(reverb);
  }
}

export class TonePlayer {
  private parts: import('tone').Part[] = [];
  private synths: (import('tone').PolySynth | import('tone').Synth | import('tone').MembraneSynth)[] = [];
  private initialized = false;
  private playing = false;

  async initialize() {
    if (this.initialized) return;
    const Tone = await import('tone');
    await Tone.start();
    this.initialized = true;
  }

  async playSong(song: Song, onComplete?: () => void) {
    const Tone = await import('tone');
    await this.initialize();
    await this.stop();

    Tone.Transport.cancel();
    Tone.Transport.bpm.value = song.analysis.tempo;

    const beatsPerBar = song.analysis.timeSignature[0];
    this.parts = [];
    this.synths = [];

    for (const track of song.tracks) {
      const synth = createSynth(Tone, track.instrument);
      this.synths.push(synth as any);

      const events = track.notes.map((n) => ({
        time: beatToTime(n.startBeat, beatsPerBar),
        note: isChordNote(n) ? n.notes : (n as Note).note,
        duration: n.duration,
        velocity: n.velocity ?? 0.7,
        isChord: isChordNote(n),
      }));

      const part = new Tone.Part((time: number, value: any) => {
        try {
          (synth as any).triggerAttackRelease(value.note, value.duration, time, value.velocity);
        } catch {
          // silently skip invalid notes
        }
      }, events);

      part.start(0);
      this.parts.push(part);
    }

    const totalBars = Math.ceil(song.totalBeats / beatsPerBar) + 1;
    Tone.Transport.scheduleOnce(() => {
      this.playing = false;
      onComplete?.();
    }, `${totalBars}:0:0`);

    Tone.Transport.start();
    this.playing = true;
  }

  async pause() {
    const Tone = await import('tone');
    if (this.playing) {
      Tone.Transport.pause();
      this.playing = false;
    } else {
      Tone.Transport.start();
      this.playing = true;
    }
  }

  async stop() {
    const Tone = await import('tone');
    Tone.Transport.stop();
    Tone.Transport.cancel();

    for (const part of this.parts) {
      try { part.dispose(); } catch { /* ignore */ }
    }
    for (const synth of this.synths) {
      try { synth.dispose(); } catch { /* ignore */ }
    }

    this.parts = [];
    this.synths = [];
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }
}
