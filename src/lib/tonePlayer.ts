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

const NOTE_IDX: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};
function noteToMidi(name: string): number | null {
  const m = name.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!m) return null;
  const idx = NOTE_IDX[m[1]];
  if (idx === undefined) return null;
  return 12 + (parseInt(m[2]) + 1) * 12 + idx;
}

// ─── Drum Kit ────────────────────────────────────────────────────────────────
// Routes C1=kick, D1=snare, F#1=hi-hat, A#1=crash based on MIDI number.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class DrumKit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nodes: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private kick: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private snare: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private hihat: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private crash: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(Tone: any, dest: any) {
    const push = <T>(n: T): T => { this.nodes.push(n); return n; };

    this.kick = push(new Tone.MembraneSynth({
      pitchDecay: 0.06, octaves: 8,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.8 },
      volume: 0,
    }));
    this.kick.connect(dest);

    // snare = noise + bandpass
    const snareFilter = push(new Tone.Filter({ frequency: 2200, type: 'bandpass', Q: 1.2 }));
    snareFilter.connect(dest);
    this.snare = push(new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.07 },
      volume: -6,
    }));
    this.snare.connect(snareFilter);

    // closed hi-hat
    this.hihat = push(new Tone.MetalSynth({
      frequency: 500, envelope: { attack: 0.001, decay: 0.07, release: 0.02 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5,
      volume: -16,
    }));
    this.hihat.connect(dest);

    // crash / open hi-hat
    this.crash = push(new Tone.MetalSynth({
      frequency: 220, envelope: { attack: 0.001, decay: 0.7, release: 0.3 },
      harmonicity: 5.1, modulationIndex: 16, resonance: 3600, octaves: 1.5,
      volume: -18,
    }));
    this.crash.connect(dest);
  }

  triggerAttackRelease(note: string | string[], duration: string, time: number, velocity: number) {
    const names = Array.isArray(note) ? note : [note];
    for (const n of names) {
      const midi = noteToMidi(n);
      if (midi === null) continue;
      try {
        if (midi <= 25)       this.kick.triggerAttackRelease('C1', duration, time, velocity);
        else if (midi <= 29)  this.snare.triggerAttackRelease(duration, time, velocity * 0.85);
        else if (midi <= 33)  this.hihat.triggerAttackRelease('G5', '32n', time, velocity * 0.55);
        else                  this.crash.triggerAttackRelease('C4', duration, time, velocity * 0.45);
      } catch { /* skip invalid */ }
    }
  }

  dispose() {
    for (const n of this.nodes) { try { n.dispose(); } catch { /* */ } }
  }
}

// ─── Instrument factory ───────────────────────────────────────────────────────
// Each case creates: synth → effects chain → comp → reverb → volumeNode
// Returns an object with triggerAttackRelease() and dispose() for cleanup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createInstrument(Tone: any, instrument: string, volumeNode: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extras: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = <T>(n: T): T => { extras.push(n); return n; };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = (...nodes: any[]) => {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes;
  };

  // Base reverb + compressor shared by most instruments
  const reverb = track(new Tone.Freeverb({ roomSize: 0.4, dampening: 3500, wet: 0.18 }));
  reverb.connect(volumeNode);
  const comp = track(new Tone.Compressor({ threshold: -20, ratio: 4, attack: 0.005, release: 0.12 }));
  comp.connect(reverb);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let synth: any;

  switch (instrument.toLowerCase()) {

    // ── Piano: FM electric piano (DX7-ish) + chorus
    case 'piano': {
      const chorus = track(new Tone.Chorus({ frequency: 3.5, delayTime: 2.5, depth: 0.35, wet: 0.45 }));
      chorus.start();
      chain(chorus, comp);
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01, modulationIndex: 14,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.28, sustain: 0.18, release: 1.4 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.002, decay: 0.01, sustain: 0, release: 0.18 },
        volume: -6,
      });
      synth.connect(chorus);
      break;
    }

    // ── Guitar: AM pluck + feedback shimmer
    case 'guitar': {
      const delay = track(new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.07, wet: 0.06 }));
      chain(delay, comp);
      synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2.5,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.002, decay: 0.42, sustain: 0.0, release: 0.75 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.5 },
        volume: -8,
      });
      synth.connect(delay);
      break;
    }

    // ── Bass: sub sawtooth with lowpass
    case 'bass': {
      const filter = track(new Tone.Filter({ frequency: 260, type: 'lowpass', rolloff: -12 }));
      chain(filter, comp);
      synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.015, decay: 0.12, sustain: 0.86, release: 0.28 },
        volume: -4,
      });
      synth.connect(filter);
      break;
    }

    // ── Strings: lush fat-sine + wide chorus + long reverb
    case 'strings': {
      const wideVerb = track(new Tone.Freeverb({ roomSize: 0.75, wet: 0.45 }));
      wideVerb.connect(volumeNode);
      const chorus = track(new Tone.Chorus({ frequency: 1.5, delayTime: 4.5, depth: 0.65, wet: 0.7 }));
      chorus.start();
      chain(chorus, wideVerb);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 6, spread: 45 },
        envelope: { attack: 0.75, decay: 0.1, sustain: 0.92, release: 2.8 },
        volume: -11,
      });
      synth.connect(chorus);
      break;
    }

    // ── Violin: sawtooth + vibrato + chorus
    case 'violin': {
      const vibrato = track(new Tone.Vibrato({ frequency: 5.5, depth: 0.08, wet: 1 }));
      vibrato.start();
      const chorus = track(new Tone.Chorus({ frequency: 3, delayTime: 2, depth: 0.35, wet: 0.3 }));
      chorus.start();
      chain(chorus, vibrato, comp);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 12 },
        envelope: { attack: 0.32, decay: 0.08, sustain: 0.92, release: 1.1 },
        volume: -10,
      });
      synth.connect(chorus);
      break;
    }

    // ── Cello: fat sawtooth + vibrato
    case 'cello': {
      const vibrato = track(new Tone.Vibrato({ frequency: 4, depth: 0.06, wet: 0.85 }));
      vibrato.start();
      chain(vibrato, comp);
      synth = new Tone.Synth({
        oscillator: { type: 'fatsawtooth', count: 2, spread: 22 },
        envelope: { attack: 0.5, decay: 0.1, sustain: 0.88, release: 1.9 },
        volume: -7,
      });
      synth.connect(vibrato);
      break;
    }

    // ── Harp: FM with fast decay
    case 'harp': {
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2, modulationIndex: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.003, decay: 1.6, sustain: 0.0, release: 1.1 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.003, decay: 0.5, sustain: 0, release: 0.5 },
        volume: -9,
      });
      synth.connect(comp);
      break;
    }

    // ── Flute: sine + tremolo
    case 'flute': {
      const tremolo = track(new Tone.Tremolo({ frequency: 5, depth: 0.09, wet: 0.5 }));
      tremolo.start();
      chain(tremolo, comp);
      synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.04, sustain: 0.84, release: 0.75 },
        volume: -10,
      });
      synth.connect(tremolo);
      break;
    }

    // ── Oboe: fat square
    case 'oboe': {
      synth = new Tone.Synth({
        oscillator: { type: 'fatsquare', count: 2, spread: 5 },
        envelope: { attack: 0.055, decay: 0.12, sustain: 0.72, release: 0.5 },
        volume: -11,
      });
      synth.connect(comp);
      break;
    }

    // ── Clarinet: square wave
    case 'clarinet': {
      synth = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.045, decay: 0.07, sustain: 0.78, release: 0.5 },
        volume: -10,
      });
      synth.connect(comp);
      break;
    }

    // ── Saxophone: fat sawtooth + vibrato
    case 'saxophone': {
      const vibrato = track(new Tone.Vibrato({ frequency: 4.5, depth: 0.07, wet: 0.75 }));
      vibrato.start();
      chain(vibrato, comp);
      synth = new Tone.Synth({
        oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
        envelope: { attack: 0.04, decay: 0.18, sustain: 0.68, release: 0.45 },
        volume: -8,
      });
      synth.connect(vibrato);
      break;
    }

    // ── Trumpet: sawtooth + subtle distortion
    case 'trumpet': {
      const dist = track(new Tone.Distortion({ distortion: 0.05, wet: 0.25 }));
      chain(dist, comp);
      synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.04, decay: 0.08, sustain: 0.75, release: 0.4 },
        volume: -8,
      });
      synth.connect(dist);
      break;
    }

    // ── Organ: AM synthesis + rotary (chorus)
    case 'organ': {
      const rotary = track(new Tone.Chorus({ frequency: 3.5, delayTime: 3.5, depth: 0.85, wet: 0.7 }));
      rotary.start();
      chain(rotary, comp);
      synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.008, decay: 0.01, sustain: 1.0, release: 0.12 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.008, decay: 0.01, sustain: 1, release: 0.1 },
        volume: -7,
      });
      synth.connect(rotary);
      break;
    }

    // ── Accordion: detuned sawtooth + tremolo
    case 'accordion': {
      const tremolo = track(new Tone.Tremolo({ frequency: 7, depth: 0.2, wet: 0.4 }));
      tremolo.start();
      chain(tremolo, comp);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 2, spread: 28 },
        envelope: { attack: 0.04, decay: 0.04, sustain: 0.92, release: 0.22 },
        volume: -9,
      });
      synth.connect(tremolo);
      break;
    }

    // ── Marimba: FM with quick decay
    case 'marimba': {
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2, modulationIndex: 1,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.52, sustain: 0.0, release: 0.4 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.18 },
        volume: -7,
      });
      synth.connect(comp);
      break;
    }

    // ── Vibraphone: FM + tremolo (motor)
    case 'vibraphone': {
      const tremolo = track(new Tone.Tremolo({ frequency: 4, depth: 0.32, wet: 0.85 }));
      tremolo.start();
      chain(tremolo, comp);
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3, modulationIndex: 2,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 1.9, sustain: 0.12, release: 1.3 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.5 },
        volume: -8,
      });
      synth.connect(tremolo);
      break;
    }

    // ── Choir: fat-sine + heavy chorus + long reverb
    case 'choir': {
      const wideVerb = track(new Tone.Freeverb({ roomSize: 0.82, wet: 0.58 }));
      wideVerb.connect(volumeNode);
      const chorus = track(new Tone.Chorus({ frequency: 1, delayTime: 6, depth: 0.92, wet: 0.78 }));
      chorus.start();
      chain(chorus, wideVerb);
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine', count: 5, spread: 32 },
        envelope: { attack: 0.52, decay: 0.08, sustain: 0.88, release: 2.2 },
        volume: -8,
      });
      synth.connect(chorus);
      break;
    }

    // ── Drums: full drum kit
    case 'drums': {
      const kit = new DrumKit(Tone, comp);
      // Wrap kit so dispose also cleans extras
      const origDispose = kit.dispose.bind(kit);
      kit.dispose = () => {
        origDispose();
        for (const e of extras) { try { e.dispose(); } catch { /* */ } }
      };
      return kit;
    }

    // ── Synth: FM + phaser + chorus (modern lead/pad)
    case 'synth':
    default: {
      const phaser = track(new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 1000, wet: 0.4 }));
      const chorus = track(new Tone.Chorus({ frequency: 2, delayTime: 3, depth: 0.5, wet: 0.35 }));
      chorus.start();
      chain(chorus, phaser, comp);
      synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.5, modulationIndex: 8,
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.08, decay: 0.2, sustain: 0.65, release: 0.95 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.08, decay: 0.1, sustain: 0.2, release: 0.5 },
        volume: -8,
      });
      synth.connect(chorus);
      break;
    }
  }

  // Patch dispose to also clean up all effect nodes
  const origDispose = synth.dispose.bind(synth);
  synth.dispose = () => {
    origDispose();
    for (const e of extras) { try { e.dispose(); } catch { /* */ } }
  };
  return synth;
}

// ─── TonePlayer ──────────────────────────────────────────────────────────────
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ToneRef: any = null;

  async initialize() {
    if (this.initialized) return;
    const Tone = await import('tone');
    this.ToneRef = Tone;
    await Tone.start();
    this.initialized = true;
  }

  /** Returns the current playback position in beats (0 when stopped). */
  getCurrentBeat(): number {
    if (!this.ToneRef || !this.playing) return 0;
    try {
      const ticks: number = this.ToneRef.Transport.ticks;
      const ppq: number = this.ToneRef.Transport.PPQ;
      return ticks / ppq;
    } catch {
      return 0;
    }
  }

  setLoop(enabled: boolean) { this.looping = enabled; }

  setTrackMute(trackIndex: number, muted: boolean) {
    const state = this.trackStates.get(trackIndex);
    if (state) { state.muted = muted; this.applyTrackVolume(trackIndex); }
  }

  setTrackVolume(trackIndex: number, volume: number) {
    const state = this.trackStates.get(trackIndex);
    if (state) { state.volume = Math.max(0, Math.min(1, volume)); this.applyTrackVolume(trackIndex); }
  }

  getTrackStates(): Map<number, TrackState> { return new Map(this.trackStates); }

  private applyTrackVolume(trackIndex: number) {
    const volNode = this.volumeMap.get(trackIndex);
    const state = this.trackStates.get(trackIndex);
    if (!volNode || !state) return;
    volNode.mute = state.muted;
    if (!state.muted) {
      volNode.volume.value = state.volume < 0.01 ? -Infinity : 20 * Math.log10(state.volume);
    }
  }

  async playSong(song: Song, onComplete?: () => void) {
    const Tone = await import('tone');
    await this.initialize();
    await this.stop();

    Tone.Transport.cancel();
    Tone.Transport.bpm.value = song.analysis.tempo;
    Tone.Transport.loop = this.looping;

    const beatsPerBar = song.analysis.timeSignature[0];
    const totalBars = Math.ceil(song.totalBeats / beatsPerBar) + 1;
    if (this.looping) Tone.Transport.setLoopPoints(0, `${totalBars}:0:0`);

    this.parts = [];
    this.synthMap.clear();
    this.volumeMap.clear();
    this.trackStates.clear();

    song.tracks.forEach((track: Track, i: number) => {
      const vol = new Tone.Volume(0).toDestination();
      this.volumeMap.set(i, vol);
      this.trackStates.set(i, { muted: false, volume: 1.0 });

      const synth = createInstrument(Tone, track.instrument, vol);
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
          synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
        } catch { /* skip invalid */ }
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
    if (this.playing) { Tone.Transport.pause(); this.playing = false; }
    else { Tone.Transport.start(); this.playing = true; }
  }

  async stop() {
    const Tone = await import('tone');
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.loop = false;

    for (const part of this.parts) { try { part.dispose(); } catch { /* */ } }
    this.synthMap.forEach((s) => { try { s.dispose(); } catch { /* */ } });
    this.volumeMap.forEach((v) => { try { v.dispose(); } catch { /* */ } });

    this.parts = [];
    this.synthMap.clear();
    this.volumeMap.clear();
    this.playing = false;
  }

  isPlaying() { return this.playing; }

  async previewNote(noteName: string, instrument = 'piano', duration = '4n') {
    const Tone = await import('tone');
    await this.initialize();
    const vol = new Tone.Volume(0).toDestination();
    const synth = createInstrument(Tone, instrument, vol);
    try {
      synth.triggerAttackRelease(noteName, duration);
      setTimeout(() => { try { synth.dispose(); vol.dispose(); } catch { /* */ } }, 4000);
    } catch {
      try { synth.dispose(); vol.dispose(); } catch { /* */ }
    }
  }
}
