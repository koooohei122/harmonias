import Anthropic from '@anthropic-ai/sdk';
import type { DetectedNote, Song } from '@/types/music';

const styleMap: Record<string, string> = {
  pop: 'Pop', jazz: 'Jazz', classical: 'Classical', rock: 'Rock',
  electronic: 'Electronic', bossanova: 'Bossa Nova', rnb: 'R&B', folk: 'Folk',
};

export async function composeSong(
  apiKey: string,
  notes: DetectedNote[],
  style: string,
  instruments: string[],
): Promise<Song> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const melodyText = notes
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

  const styleName = styleMap[style] ?? style;

  const prompt = `You are a professional music composer. A user hummed a melody — create a complete musical arrangement.

DETECTED MELODY:
${melodyText}

STYLE: ${styleName}
INSTRUMENTS: ${instruments.join(', ')}

TASKS:
1. Identify key and time signature
2. Correct out-of-key notes to fit the scale
3. Convert rhythm to standard note durations
4. Generate a chord progression supporting the melody
5. Create parts for EACH instrument
6. Set appropriate tempo for ${styleName}
7. Make it at least 16-32 beats (repeat/extend as needed)

TONE.JS DURATIONS: "1n"=whole, "2n"=half, "4n"=quarter, "8n"=eighth, "16n"=sixteenth
NOTES: Scientific notation "C4","D#4","Bb3","F#5"
DRUMS: "C1"=kick, "D1"=snare, "F#1"=hi-hat
CHORDS: "notes" field = array of strings
MELODY/BASS: "note" field = single string

Return ONLY valid JSON, no markdown:

{
  "analysis": {
    "detectedKey": "G major",
    "timeSignature": [4, 4],
    "tempo": 120,
    "correctionsSummary": "2〜3文で補正内容と仕上がりを日本語で説明",
    "style": "${style}"
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
