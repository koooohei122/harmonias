import Anthropic from '@anthropic-ai/sdk';
import type { DetectedNote, Song, Note } from '@/types/music';

const styleMap: Record<string, string> = {
  pop: 'Pop', jazz: 'Jazz', classical: 'Classical', rock: 'Rock',
  electronic: 'Electronic', bossanova: 'Bossa Nova', rnb: 'R&B', folk: 'Folk',
};

// ─── Style-specific production guides ────────────────────────────────────────
const STYLE_GUIDES: Record<string, string> = {
  pop: `
STYLE GUIDE — Modern Pop:
• Tempo 100-130 BPM, 4/4 time.
• Drums: kick on 1&3 (vel 0.9), snare on 2&4 (vel 0.85), hi-hat 8th notes (vel 0.5-0.6). Crash (A#1) on section starts (vel 0.75).
• Bass: root on beat 1, then syncopated 8th-note groove following the kick. Stay below C3.
• Guitar: offbeat strumming on "and" beats with sus2/add9 voicings (vel 0.6). Avoid strumming on downbeats.
• Piano/keys: rhythmic chord stabs on beat 2-and and 4-and. Don't double the melody.
• Chords: use diatonic 7ths and 9ths — Cmaj9, Am7, Fmaj7, G7sus4. Avoid bare triads for modern feel.
• Melody: catchy 2-bar hook; peak note at bar 5. Vary velocity for expression (0.65 verse → 0.9 chorus).
• DO NOT have all instruments play every beat. Leave breathing room.`,

  jazz: `
STYLE GUIDE — Jazz:
• Tempo 140-175 BPM swing (or 65-80 BPM ballad). 4/4 time.
• Drums: ride (A#1) on 2&4 (vel 0.6), hi-hat (F#1) on 2&4 (vel 0.5), kick sparingly on beat 1 only (vel 0.7). Ghost snare (D1, vel 0.25-0.35) on "3 and" for swing.
• Bass: WALKING BASS — quarter notes only, chromatic approach tones to chord roots, smooth voice leading. Range C2-C3.
• Piano: COMP sparsely — chord voicings on unexpected offbeats ("2 and", "4 and", "3 and"). Never every beat. Use shell voicings: root+7+3 or root+3+7+9. Max 4 notes per chord.
• Chords: EXTENDED — Cmaj9, Dm11, G13, Am7b5, Bb7#11. Use ii-V-I progressions. No plain triads.
• Melody: add chromatic approach notes and neighbor tones. Bebop-style 8th-note lines. Swing feel.
• Bass and piano should NOT play the same notes simultaneously.`,

  classical: `
STYLE GUIDE — Classical:
• Tempo 80-116 BPM. 4/4 or 3/4 time.
• NO drums, NO electric bass, NO synth. Use strings and piano only.
• Piano left hand: Alberti bass (C-G-E-G or C-E-G-E pattern at C2-C3) OR half-note block chords.
• Piano right hand: melody or countermelody above C4.
• Strings: lush SATB voicing — violin soprano (G4-E5), alto strings (C4-G4), cello bass (C2-C3).
• Voice leading: each voice moves by step (2nds or 3rds). Avoid parallel 5ths and octaves.
• Chords: functional harmony only — I, ii, IV, V, vi, vii°. Secondary dominants (V/V). No 7ths on tonic except as passing.
• Dynamics: p at start (vel 0.35), grow to mf (0.6) at bar 4, climax f (0.85) at bar 7, resolve pp (0.3).
• Melody: long durations (2n, 1n dominant). Climax note near end of phrase. Clear cadences.`,

  rock: `
STYLE GUIDE — Modern Rock:
• Tempo 120-155 BPM, 4/4 time.
• Drums: kick on 1&3 (vel 0.95), snare on 2&4 (vel 0.9), hi-hat 8th notes (vel 0.65). Add crash (A#1, vel 0.8) on every 4-bar section start. Fill (fast snare: D1 16n notes) into sections.
• Bass: LOCK WITH KICK — exact same rhythm as kick drum on downbeats, then 8th-note fills. High energy vel 0.8-0.9.
• Guitar chords: POWER CHORDS — only root + 5th, e.g. ["G2","D3"]. High velocity 0.85-0.95. 8th-note rhythm pattern.
• Rhythm guitar: palm-muted 8th notes on off-beats (vel 0.5).
• Melody: pentatonic runs, step-wise phrases with chromatic approach notes. Aggressive vel (0.8-1.0).
• Chords: I-VII-IV-V or I-IV-V-vi. Power chord only (no 3rd).
• Everything should be HIGH ENERGY. Minimum velocity 0.7 for any note.`,

  electronic: `
STYLE GUIDE — Electronic / EDM:
• Tempo 124-132 BPM, 4/4 time.
• Drums: kick on EVERY beat 1,2,3,4 (C1, vel 0.95). Clap/snare on 2&4 (D1, vel 0.85). Hi-hat 16th notes (F#1, vel 0.4). Open hi-hat on "4 and" (A#1, vel 0.6).
• Synth bass: SIDECHAIN SIMULATION — low velocity on kick beats (vel 0.25), high on off-beats (vel 0.85). Sustained sawtooth, stay below C3. Pitch slides implied.
• Synth pad: whole-note or half-note chords. Velocity 0.45 (background wash).
• Synth arp: 16th-note arpeggios on chord tones (C4-C6 range). Vel 0.55. Runs up/down the chord.
• Lead synth: hook every 4 bars, punchy and bright (C5+). Vel 0.75-0.85.
• Structure: bars 0-7 build (fewer elements, lower vel), bars 8-31 full drop (all elements active).
• Chords: minor 7ths, power chords, or triads. Loop a 4-bar progression throughout.`,

  bossanova: `
STYLE GUIDE — Bossa Nova:
• Tempo 118-132 BPM, 4/4 time.
• Guitar: THE BOSSA PATTERN — single bass note on beat 1 (low, vel 0.7), chord stab on "2 and" (vel 0.5), bass note beat 3 (vel 0.65), chord stab on "4 and" (vel 0.5). Swing lightly.
• Bass: roots and 5ths only. Quarter-note feel. Stay below C3. Very soft (vel 0.5-0.6).
• Drums: MINIMAL — hi-hat (F#1) on 2&4 only (vel 0.35), or light rimshot (D1, vel 0.3). No heavy kick.
• Piano: sparse comping, 2-3 times per 4 bars on offbeats. Jazz voicings. Never clash with guitar.
• Chords: ii-V-I in major. Extended: Cmaj7, Bm7b5, E7#9, Am9, Dm11, G7sus4.
• Melody: lyrical, flowing. Long tones (2n, 4n dominant). Vel 0.6-0.75. Never aggressive.
• NOTHING above vel 0.8. The whole feel is intimate and relaxed.`,

  rnb: `
STYLE GUIDE — R&B / Soul:
• Tempo 75-95 BPM, 4/4 time.
• Drums: SYNCOPATED — kick (C1) on beat 1 AND "2 and" (vel 0.85). Snare (D1) on beat 3 (vel 0.8). 16th hi-hats (F#1) alternating vel 0.4-0.55. Ghost snare (D1, vel 0.2-0.3) on "3 and" and "4 and".
• Bass: GROOVE — syncopated 16th notes. Play on "and" of 1, beat 2, "and" of 3. Octave jumps for emphasis. Vel range 0.55-0.9 (dynamic for feel).
• Keys/piano: chord stabs on "2 and" and "4 and". Extended voicings (maj9, m11, 7#9). Rhodes feel.
• Guitar: 16th-note muted scratch pattern (vel 0.35-0.45, duration "16n"). Occasional chord stab.
• Chords: Imaj9 - vi11 - IVmaj9 - V9sus4. Rich extensions, no bare triads.
• Melody: EXPRESSIVE vel range 0.5-1.0. Melismatic runs (add neighbor notes). Long notes trail off (end vel 0.4). Soulful phrasing.`,

  folk: `
STYLE GUIDE — Folk / Acoustic:
• Tempo 88-112 BPM, 4/4 or 3/4 time.
• Guitar: FINGERPICKING — bass note (thumb, vel 0.7) on beats 1&3, finger plucks (vel 0.55) on "2 and" and "4 and". Gentle and warm.
• Bass: simple root movement on beat 1 only. Quarter notes. Below C3. Soft (vel 0.5).
• Drums: MINIMAL or none. If drums: soft kick (vel 0.55) on 1, brush snare (vel 0.4) on 3. NO rock drumming.
• Melody: SINGABLE — stepwise motion, clear phrases of 4 bars each. Diatonic notes only. Vel 0.6-0.75.
• Chords: SIMPLE — I, IV, V, vi only. Open voicings (include notes above C3). Capo-style bright positions.
• Harmony: if adding harmony instrument, use diatonic 3rds above melody.
• Feel: ORGANIC and human. Slight velocity variation (±0.05-0.1) on every note for natural feel.`,
};

// ─── Emotion modifiers ────────────────────────────────────────────────────────
const EMOTION_GUIDES: Record<string, string> = {
  happy:      'EMOTION — Happy: Use major key, bright voicings (add9, maj7). Higher register melody. Faster tempo end of range. Staccato shorter durations. High velocity on strong beats (0.85+). Chord brightness: add major 9ths.',
  sad:        'EMOTION — Sad: Minor key or Aeolian mode. Reduce tempo by 15-20 BPM. Long sustained melody notes (2n, 1n). Low-medium velocity cap: 0.65. Sparse texture. Prefer bm7b5, m7, dim chords. Space between notes.',
  excited:    'EMOTION — Excited: Upper end of tempo range (+15 BPM). All instruments active, dense. High velocity (0.85-1.0). Short punchy durations. Frequent 16th-note fills. Driving energy throughout.',
  calm:       'EMOTION — Calm: Slow tempo (lower range -10 BPM). Sustained long notes (1n, 2n). Soft dynamics (vel 0.3-0.55). Minimal percussion or no drums. Lots of silence/rest between notes. Use maj7 and add9 chords.',
  romantic:   'EMOTION — Romantic: Medium-slow tempo. Rich harmonies: maj9, maj7#11. Melody in mid-high register, legato. String or choir pads underneath. Velocity ebb and flow (0.5→0.8→0.5). Countermelody in strings.',
  angry:      'EMOTION — Angry: Fastest tempo in range. Maximum velocity (0.9-1.0). Heavy low-register bass and kick. Dissonant extensions (7#9, m7b5, dim). Dense percussion. Short clipped chord stabs (16n duration).',
  nostalgic:  'EMOTION — Nostalgic: Medium tempo slightly slower. Pentatonic or diatonic melody. maj7 and 6th chords. Warm mid-register. Moderate reverb implied. Gentle groove. Slightly imprecise timing feel.',
  mysterious: 'EMOTION — Mysterious: Slow to medium tempo. Modal harmony (Dorian or Phrygian). Low-register pads. Sparse melody with many rests. Velocity cap 0.6. Unexpected chord changes. Chromatic voice leading.',
};

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildCompositionPrompt(
  melodyText: string,
  styleName: string,
  styleId: string,
  instruments: string[],
  emotion?: string,
  userPrompt?: string,
): string {
  const styleGuide = STYLE_GUIDES[styleId] ?? '';
  const emotionGuide = emotion ? `\n${EMOTION_GUIDES[emotion] ?? ''}` : '';
  const userGuide = userPrompt ? `\nUSER DIRECTION (highest priority): ${userPrompt}` : '';

  return `You are a world-class music producer and arranger. Transform a hummed melody into a professional, genre-authentic arrangement.

══ INPUT MELODY ══
${melodyText}

══ TARGET STYLE: ${styleName.toUpperCase()} ══
${styleGuide}${emotionGuide}${userGuide}

══ REQUESTED INSTRUMENTS ══
${instruments.join(', ')}
Create a distinct, idiomatic part for EVERY instrument above. Do not skip any.

══ ARRANGEMENT RULES ══
1. Correct out-of-key notes; preserve the melodic contour.
2. Extend to 32 beats minimum by repeating/developing. Add variation on repeat.
3. VELOCITY HUMANIZATION: No two consecutive notes should have identical velocity. Vary ±0.05-0.1.
4. RHYTHMIC DENSITY: Not every instrument plays every beat. Create space and contrast.
5. BASS REGISTER: Bass instruments stay below C3. Melody stays above C4.
6. VOICE LEADING: In chords, move voices by step where possible. Smooth transitions.
7. GROOVE: Drums and bass should lock together rhythmically (same attack points on key beats).

══ TONE.JS FORMAT ══
Durations: "1n"=whole "2n"=half "4n"=quarter "8n"=eighth "16n"=sixteenth
Notes: scientific pitch "C4" "D#4" "Bb3" "F#5"
Drums ONLY: "C1"=kick "D1"=snare "F#1"=hi-hat(closed) "A#1"=crash/open-hat
Chord notes: use "notes" array field
Single notes: use "note" string field

══ OUTPUT ══
Return ONLY valid JSON, no markdown, no explanation:

{
  "analysis": {
    "detectedKey": "G major",
    "timeSignature": [4, 4],
    "tempo": 120,
    "correctionsSummary": "2〜3文で補正内容と仕上がりを日本語で説明",
    "style": "${styleId}"
  },
  "correctedMelody": [
    {"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.82}
  ],
  "tracks": [
    {
      "instrument": "piano",
      "role": "melody",
      "notes": [
        {"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.82},
        {"note": "A4", "duration": "8n", "startBeat": 1, "velocity": 0.76}
      ]
    },
    {
      "instrument": "guitar",
      "role": "chords",
      "notes": [
        {"notes": ["G2","B2","D3","F#3"], "duration": "2n", "startBeat": 0, "velocity": 0.58}
      ]
    },
    {
      "instrument": "drums",
      "role": "rhythm",
      "notes": [
        {"note": "C1", "duration": "8n", "startBeat": 0, "velocity": 0.92},
        {"note": "D1", "duration": "8n", "startBeat": 2, "velocity": 0.88},
        {"note": "F#1", "duration": "16n", "startBeat": 0.5, "velocity": 0.52}
      ]
    }
  ],
  "totalBeats": 32
}`;
}

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(apiKey: string, prompt: string): Promise<Song> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages as any).create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSONが見つかりませんでした');

  const songData = JSON.parse(jsonMatch[0]) as Song;
  if (!songData.tracks || !Array.isArray(songData.tracks)) {
    throw new Error('不正な曲データです');
  }
  return songData;
}

function notesToText(notes: DetectedNote[]): string {
  return notes
    .map((n) => {
      const label =
        n.duration < 0.2 ? '16th note'
        : n.duration < 0.35 ? '8th note'
        : n.duration < 0.6 ? 'quarter note'
        : n.duration < 1.0 ? 'half note'
        : 'whole note';
      return `${n.note} (${label}, ${n.duration.toFixed(2)}s)`;
    })
    .join(', ');
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function composeSong(
  apiKey: string,
  notes: DetectedNote[],
  style: string,
  instruments: string[],
  emotion?: string,
  userPrompt?: string,
): Promise<Song> {
  const melodyText = notesToText(notes);
  const styleName = styleMap[style] ?? style;
  return callClaude(apiKey, buildCompositionPrompt(melodyText, styleName, style, instruments, emotion, userPrompt));
}

export async function recomposeSong(
  apiKey: string,
  existingSong: Song,
  newStyle: string,
  instruments: string[],
  emotion?: string,
  userPrompt?: string,
): Promise<Song> {
  const melodyText = existingSong.correctedMelody
    .map((n) => `${n.note} (${n.duration}, beat ${n.startBeat})`)
    .join(', ');
  const styleName = styleMap[newStyle] ?? newStyle;
  return callClaude(apiKey, buildCompositionPrompt(melodyText, styleName, newStyle, instruments, emotion, userPrompt));
}

export async function generateLyrics(
  apiKey: string,
  song: Song,
  language: 'ja' | 'en' = 'ja',
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const styleLabel = styleMap[song.analysis.style] ?? song.analysis.style;
  const langInstruction = language === 'ja'
    ? '日本語の歌詞を書いてください。自然で詩的な表現を使い、メロディのリズムと音節数を意識してください。'
    : 'Write English lyrics. Use natural, poetic language that fits the melody rhythm and syllable count.';

  const prompt = `You are a professional lyricist. Write song lyrics for the following musical composition.

COMPOSITION DETAILS:
- Key: ${song.analysis.detectedKey}
- Style: ${styleLabel}
- Tempo: ${song.analysis.tempo} BPM
- Total beats: ${song.totalBeats}
- Description: ${song.analysis.correctionsSummary}

${langInstruction}

Format your response as:
[Aメロ]
(歌詞)

[サビ]
(歌詞)

[Aメロ2]
(歌詞)

[サビ]
(歌詞)

Keep it to 2 verses and 1-2 choruses. Match the ${styleLabel} genre vibe.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('歌詞の生成に失敗しました');
  return textBlock.text;
}

export async function correctMelodyNotes(
  apiKey: string,
  notes: Note[],
  style: string,
): Promise<Note[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const notesText = notes
    .map((n) => `${n.note}(${n.duration},beat${n.startBeat},vel${(n.velocity ?? 0.7).toFixed(2)})`)
    .join(' ');

  const styleName = styleMap[style] ?? style;

  const prompt = `You are a professional music AI. The user tapped notes on a piano roll to create a melody. Apply musical AI correction to make it sound like a natural, expressive vocal melody in ${styleName} style.

INPUT NOTES: ${notesText}

Rules:
1. Preserve the main notes the user intended
2. Fill gaps with natural connecting notes (passing tones, ornaments)
3. Smooth rhythm to feel humanized — vary velocity ±0.05-0.1 per note
4. Louder on downbeats (beat 1, 3), softer on upbeats
5. Keep total beats roughly the same
6. Make it sound like a real ${styleName} vocal line — idiomatic phrasing

Return ONLY a JSON array, no markdown:
[{"note":"C4","duration":"4n","startBeat":0,"velocity":0.8}, ...]`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('補正に失敗しました');

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('JSONが見つかりませんでした');

  return JSON.parse(jsonMatch[0]) as Note[];
}
