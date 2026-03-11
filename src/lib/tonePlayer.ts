import type { Song, Track, TrackNote, Note, ChordNote } from '@/types/music';

export interface TrackState {
  muted: boolean;
  volume: number; // 0.0 - 1.0
}

function isChordNote(note: TrackNote): note is ChordNote {
  return Array.isArray((note as ChordNote).notes);
}

function beatToTime(beat: number, beatsPerBar: number): string {
  const bar = Math.floor(beat / beatsPerBar);
  const beatInBar = beat % beatsPerBar;
  return `${bar}:${beatInBar}:0`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createSynth(Tone: any, instrument: string, volumeNode: any) {
  switch (instrument.toLowerCase()) {
    case 'piano':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 1.8 },
        volume: -6,
      }).connect(volumeNode);

    case 'guitar':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 10 },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.6 },
        volume: -8,
      }).connect(volumeNode);

    case 'bass':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.4 },
        volume: -4,
      }).connect(volumeNode);

    case 'strings':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.1, sustain: 0.9, release: 2.0 },
        volume: -8,
      }).connect(volumeNode);

    case 'violin':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 3, spread: 5 },
        envelope: { attack: 0.3, decay: 0.05, sustain: 0.95, release: 0.8 },
        volume: -9,
      }).connect(volumeNode);

    case 'cello':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.4, decay: 0.1, sustain: 0.85, release: 1.5 },
        volume: -7,
      }).connect(volumeNode);

    case 'harp':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 1.2, sustain: 0.0, release: 1.0 },
        volume: -9,
      }).connect(volumeNode);

    case 'flute':
      return new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.12, decay: 0.05, sustain: 0.8, release: 0.6 },
        volume: -10,
      }).connect(volumeNode);

    case 'oboe':
      return new Tone.Synth({
        oscillator: { type: 'fatsquare', count: 2, spread: 8 },
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.7, release: 0.5 },
        volume: -11,
      }).connect(volumeNode);

    case 'clarinet':
      return new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.06, decay: 0.05, sustain: 0.75, release: 0.5 },
        volume: -10,
      }).connect(volumeNode);

    case 'saxophone':
      return new Tone.Synth({
        oscillator: { type: 'fatsawtooth', count: 3, spread: 15 },
        envelope: { attack: 0.05, decay: 0.15, sustain: 0.65, release: 0.4 },
        volume: -8,
      }).connect(volumeNode);

    case 'trumpet':
      return new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.4 },
        volume: -8,
      }).connect(volumeNode);

    case 'organ':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.01, sustain: 1.0, release: 0.1 },
        volume: -7,
      }).connect(volumeNode);

    case 'accordion':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 20 },
        envelope: { attack: 0.05, decay: 0.05, sustain: 0.9, release: 0.2 },
        volume: -9,
      }).connect(volumeNode);

    case 'marimba':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.6, sustain: 0.0, release: 0.4 },
        volume: -7,
      }).connect(volumeNode);

    case 'vibraphone':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 1.5, sustain: 0.2, release: 1.0 },
        volume: -8,
      }).connect(volumeNode);

    case 'choir':
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 4, spread: 25 },
        envelope: { attack: 0.4, decay: 0.1, sustain: 0.85, release: 1.5 },
        volume: -8,
      }).connect(volumeNode);

    case 'drums':
      return new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
        volume: -4,
      }).connect(volumeNode);

    case 'synth':
    default:
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 },
        volume: -8,
      }).connect(volumeNode);
  }
}

export class TonePlayer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parts: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private synthMap: Map<number, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private volumeMap: Map<number, any> = new Map();
  private trackStates: Map<number, TrackState> = new Map();
  private initialized = false;
  private playing = false;
  private looping = false;
  private currentSong: Song | null = null;
  private onCompleteCallback?: () => void;

  async initialize() {
    if (this.initialized) return;
    const Tone = await import('tone');
    await Tone.start();
    this.initialized = true;
  }

  setLoop(enabled: boolean) {
    this.looping = enabled;
  }

  setTrackMute(trackIndex: number, muted: boolean) {
    const state = this.trackStates.get(trackIndex);
    if (state) {
      state.muted = muted;
      this.applyTrackVolume(trackIndex);
    }
  }

  setTrackVolume(trackIndex: number, volume: number) {
    const state = this.trackStates.get(trackIndex);
    if (state) {
      state.volume = Math.max(0, Math.min(1, volume));
      this.applyTrackVolume(trackIndex);
    }
  }

  getTrackStates(): Map<number, TrackState> {
    return new Map(this.trackStates);
  }

  private applyTrackVolume(trackIndex: number) {
    const volNode = this.volumeMap.get(trackIndex);
    const state = this.trackStates.get(trackIndex);
    if (!volNode || !state) return;
    if (state.muted) {
      volNode.mute = true;
    } else {
      volNode.mute = false;
      // Map 0-1 to -30dB to 0dB
      volNode.volume.value = state.volume < 0.01 ? -Infinity : 20 * Math.log10(state.volume);
    }
  }

  async playSong(song: Song, onComplete?: () => void) {
    const Tone = await import('tone');
    await this.initialize();
    await this.stop();

    this.currentSong = song;
    this.onCompleteCallback = onComplete;

    Tone.Transport.cancel();
    Tone.Transport.bpm.value = song.analysis.tempo;
    Tone.Transport.loop = this.looping;

    const beatsPerBar = song.analysis.timeSignature[0];
    const totalBars = Math.ceil(song.totalBeats / beatsPerBar) + 1;

    if (this.looping) {
      Tone.Transport.setLoopPoints(0, `${totalBars}:0:0`);
    }

    this.parts = [];
    this.synthMap.clear();
    this.volumeMap.clear();
    this.trackStates.clear();

    song.tracks.forEach((track: Track, i: number) => {
      const reverb = new Tone.Freeverb({ roomSize: 0.4, dampening: 3000, wet: 0.2 }).toDestination();
      const vol = new Tone.Volume(0).connect(reverb);

      this.volumeMap.set(i, vol);
      this.trackStates.set(i, { muted: false, volume: 1.0 });

      const synth = createSynth(Tone, track.instrument, vol);
      this.synthMap.set(i, synth);

      const events = track.notes.map((n) => ({
        time: beatToTime(n.startBeat, beatsPerBar),
        note: isChordNote(n) ? n.notes : (n as Note).note,
        duration: n.duration,
        velocity: n.velocity ?? 0.7,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const part = new Tone.Part((time: number, value: any) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (synth as any).triggerAttackRelease(value.note, value.duration, time, value.velocity);
        } catch {
          // skip invalid notes
        }
      }, events);

      part.start(0);
      this.parts.push(part);
    });

    if (!this.looping) {
      Tone.Transport.scheduleOnce(() => {
        this.playing = false;
        onComplete?.();
      }, `${totalBars}:0:0`);
    }

    Tone.Transport.start();
    this.playing = true;
  }

  async setTempo(bpm: number) {
    const Tone = await import('tone');
    Tone.Transport.bpm.value = bpm;
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
    Tone.Transport.loop = false;

    for (const part of this.parts) {
      try { part.dispose(); } catch { /* ignore */ }
    }
    this.synthMap.forEach((synth) => {
      try { synth.dispose(); } catch { /* ignore */ }
    });
    this.volumeMap.forEach((vol) => {
      try { vol.dispose(); } catch { /* ignore */ }
    });

    this.parts = [];
    this.synthMap.clear();
    this.volumeMap.clear();
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }

  // Play a single note preview (for voice mode)
  async previewNote(noteName: string, instrument = 'piano', duration = '4n') {
    const Tone = await import('tone');
    await this.initialize();
    const reverb = new Tone.Freeverb({ roomSize: 0.3, wet: 0.15 }).toDestination();
    const synth = createSynth(Tone, instrument, reverb);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (synth as any).triggerAttackRelease(noteName, duration);
      setTimeout(() => {
        try { synth.dispose(); reverb.dispose(); } catch { /* ignore */ }
      }, 3000);
    } catch {
      try { synth.dispose(); reverb.dispose(); } catch { /* ignore */ }
    }
  }
}
