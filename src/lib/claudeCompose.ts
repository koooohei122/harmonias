import Anthropic from '@anthropic-ai/sdk';
import type { DetectedNote, Song, Note } from '@/types/music';

const styleMap: Record<string, string> = {
  pop: 'Pop', jazz: 'Jazz', classical: 'Classical', rock: 'Rock',
  electronic: 'Electronic', bossanova: 'Bossa Nova', rnb: 'R&B', folk: 'Folk',
};

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

function buildCompositionPrompt(
  melodyText: string,
  styleName: string,
  styleId: string,
  instruments: string[],
  emotion?: string,
  userPrompt?: string,
): string {
  const emotionClause = emotion
    ? `\nEMOTION/MOOD: ${emotion} — strongly reflect this feeling in dynamics, tempo, and harmony.`
    : '';
  const promptClause = userPrompt
    ? `\nARRANGEMENT DIRECTION (follow closely): ${userPrompt}`
    : '';

  return `You are a professional music composer. A user hummed a melody — create a complete musical arrangement.

DETECTED MELODY:
${melodyText}

STYLE: ${styleName}
INSTRUMENTS: ${instruments.join(', ')}${emotionClause}${promptClause}

TASKS:
1. Identify key and time signature
2. Correct out-of-key notes to fit the scale
3. Convert rhythm to standard note durations
4. Generate a chord progression supporting the melody
5. Create parts for EACH instrument
6. Set appropriate tempo for ${styleName}
7. Make it at least 16-32 beats (repeat/extend as needed)
8. Add harmony/countermelody tracks where appropriate

TONE.JS DURATIONS: "1n"=whole, "2n"=half, "4n"=quarter, "8n"=eighth, "16n"=sixteenth
NOTES: Scientific notation "C4","D#4","Bb3","F#5"
DRUMS: "C1"=kick, "D1"=snare, "F#1"=hi-hat, "A#1"=ride
CHORDS: "notes" field = array of strings
MELODY/BASS: "note" field = single string

Return ONLY valid JSON, no markdown:

{
  "analysis": {
    "detectedKey": "G major",
    "timeSignature": [4, 4],
    "tempo": 120,
    "correctionsSummary": "2〜3文で補正内容と仕上がりを日本語で説明",
    "style": "${styleId}"
  },
  "correctedMelody": [
    {"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.85}
  ],
  "tracks": [
    {
      "instrument": "piano",
      "role": "melody",
      "notes": [{"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.85}]
    },
    {
      "instrument": "guitar",
      "role": "chords",
      "notes": [{"notes": ["G2","B2","D3"], "duration": "2n", "startBeat": 0, "velocity": 0.6}]
    }
  ],
  "totalBeats": 32
}

Include ALL requested instruments: ${instruments.join(', ')}. Make it musically rich!`;
}

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
  const prompt = buildCompositionPrompt(melodyText, styleName, style, instruments, emotion, userPrompt);
  return callClaude(apiKey, prompt);
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
  const prompt = buildCompositionPrompt(melodyText, styleName, newStyle, instruments, emotion, userPrompt);
  return callClaude(apiKey, prompt);
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
3. Smooth rhythm to feel humanized
4. Adjust velocities for natural expression (louder on beat, softer off-beat)
5. Keep total beats roughly the same
6. Make it sound like a real ${styleName} vocal line

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
