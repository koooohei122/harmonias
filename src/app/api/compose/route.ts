import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { DetectedNote } from '@/types/music';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { notes, style, instruments } = (await req.json()) as {
      notes: DetectedNote[];
      style: string;
      instruments: string[];
    };

    if (!notes || notes.length === 0) {
      return NextResponse.json({ error: '音符が検出されていません' }, { status: 400 });
    }

    // Convert detected notes to readable format
    const melodyText = notes
      .map((n) => {
        const durationLabel =
          n.duration < 0.2 ? '16th note'
          : n.duration < 0.35 ? '8th note'
          : n.duration < 0.6 ? 'quarter note'
          : n.duration < 1.0 ? 'half note'
          : 'whole note';
        return `${n.note} (${durationLabel}, ${n.duration.toFixed(2)}s)`;
      })
      .join(', ');

    const styleMap: Record<string, string> = {
      pop: 'Pop',
      jazz: 'Jazz',
      classical: 'Classical',
      rock: 'Rock',
      electronic: 'Electronic',
      bossanova: 'Bossa Nova',
      rnb: 'R&B',
      folk: 'Folk',
    };
    const styleName = styleMap[style] ?? style;

    const prompt = `You are a professional music composer and arranger. A user hummed a melody and you must create a complete, musical arrangement from it.

DETECTED MELODY (note + approximate duration):
${melodyText}

STYLE: ${styleName}
INSTRUMENTS: ${instruments.join(', ')}

YOUR TASKS:
1. Identify the musical key and time signature from the melody
2. Correct any out-of-key notes to fit the identified key/scale
3. Convert the rhythm to standard note durations (whole, half, quarter, eighth, sixteenth)
4. Generate a rich chord progression that harmonically supports the melody
5. Create interesting parts for EACH requested instrument
6. Set an appropriate tempo (BPM) for the ${styleName} style
7. Make it at least 16-32 beats long (repeat/extend the melody if needed)

TONE.JS DURATION FORMAT (REQUIRED):
- "1n" = whole note (4 beats)
- "2n" = half note (2 beats)
- "4n" = quarter note (1 beat)
- "8n" = eighth note (0.5 beats)
- "16n" = sixteenth note (0.25 beats)
- "8t" = eighth note triplet
- "4t" = quarter note triplet

NOTE FORMAT: Use scientific pitch notation like "C4", "D#4", "Bb3", "F#5"
Use # for sharps (C#, D#, F#, G#, A#), use "b" suffix only for Bb, Eb, Ab, Db, Gb.

START BEAT: 0-indexed beat number. Quarter notes at 4/4 time: beat 0, 1, 2, 3, 4, 5...

For DRUMS instrument: use notes like "C1" (kick), "D1" (snare), "F#1" (hi-hat) - pitched low.
For CHORDS: the "notes" field must be an array of strings.
For MELODY/BASS: the "note" field must be a single string.

Return ONLY valid JSON, no markdown, no extra text:

{
  "analysis": {
    "detectedKey": "G major",
    "timeSignature": [4, 4],
    "tempo": 120,
    "correctionsSummary": "2〜3文で、どんな補正をしたか、どんな曲に仕上げたかを日本語で説明してください",
    "style": "${style}"
  },
  "correctedMelody": [
    {"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.85}
  ],
  "tracks": [
    {
      "instrument": "piano",
      "role": "melody",
      "notes": [
        {"note": "G4", "duration": "4n", "startBeat": 0, "velocity": 0.85}
      ]
    },
    {
      "instrument": "guitar",
      "role": "chords",
      "notes": [
        {"notes": ["G2", "B2", "D3"], "duration": "2n", "startBeat": 0, "velocity": 0.6}
      ]
    }
  ],
  "totalBeats": 32
}

Make the arrangement musically interesting! Add variation, dynamics, and appropriate ${styleName} characteristics. Include all requested instruments: ${instruments.join(', ')}.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = (client.messages as any).stream({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    });

    const response = await stream.finalMessage();

    // Find text content block (skip thinking blocks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = (response as any).content.find((b: any) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from the response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSONが見つかりませんでした');
    }

    let songData;
    try {
      songData = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('JSONの解析に失敗しました');
    }

    // Basic validation
    if (!songData.tracks || !Array.isArray(songData.tracks)) {
      throw new Error('不正な曲データです');
    }

    return NextResponse.json(songData);
  } catch (error) {
    console.error('[compose] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '作曲中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
