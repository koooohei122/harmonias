# 🎵 harmonias

**口ずさんだメロディをAIが完全な曲に編曲するWebアプリ**

マイクに向かってメロディを口ずさむだけで、Claude AIが音楽理論に基づいて補正・編曲し、ブラウザ上でそのまま演奏します。

---

## 機能

| 機能 | 内容 |
|------|------|
| 🎤 リアルタイム録音 | マイクからハミングを録音し、音符を自動検出 |
| 🎵 AI作曲 | Claude (claude-opus-4-6) が音楽理論に基づいてコード進行・編曲を生成 |
| 🔧 音楽理論補正 | キーを自動検出し、外れた音符を正しいスケールに補正 |
| 🎨 スタイル選択 | Pop / Jazz / Classical / Rock / Electronic / Bossa Nova / R&B / Folk |
| 🎹 楽器選択 | Piano / Guitar / Bass / Drums / Strings / Flute / Trumpet / Synth |
| ▶ ブラウザ再生 | Tone.js で生成した曲をそのまま演奏 |

---

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/koooohei122/harmonias.git
cd harmonias
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. APIキーを設定

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて、[Anthropic Console](https://console.anthropic.com/) で取得したAPIキーを設定します：

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxx
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで **http://localhost:3000** を開きます。

---

## 使い方

```
STEP 1  🎤 録音ボタンをクリック → メロディを口ずさむ → 停止
STEP 2  スタイル（例：Jazz）と楽器（例：Piano + Bass）を選択
STEP 3  「✨ 曲を生成する」をクリック → AIが作曲
        ▶ 再生ボタンで演奏
```

---

## 技術スタック

- **フレームワーク**: [Next.js 14](https://nextjs.org/) (App Router)
- **AI**: [Claude claude-opus-4-6](https://www.anthropic.com/) via [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)
- **ピッチ検出**: [pitchy](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method)
- **音楽合成**: [Tone.js](https://tonejs.github.io/)
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)
