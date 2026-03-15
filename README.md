# 🎵 harmonias

**口ずさんだメロディをAIが完全な曲に編曲するWebアプリ**

マイクに向かってメロディを口ずさむだけで、Claude AIが音楽理論に基づいて補正・編曲し、ブラウザ上でそのまま演奏します。完成した曲はDAWスタイルのUIで確認・編集できます。

---

## 機能

### 作曲フロー

| ステップ | 内容 |
|---------|------|
| 🎤 リアルタイム録音 | マイクからハミングを録音し、ピッチを自動検出 |
| 🔧 音楽理論補正 | キーを自動検出し、外れた音符をスケールに補正 |
| 🎨 スタイル選択 | Pop / Jazz / Classical / Rock / Electronic / Bossa Nova / R&B / Folk |
| 🎹 楽器選択 | Piano / Guitar / Bass / Drums / Strings など18種類 |
| ✨ AI作曲 | Claude (claude-opus-4-6) がコード進行・編曲・歌詞を生成 |

### DAW スタイル プレイヤー

| 機能 | 内容 |
|------|------|
| ▶ トランスポートバー | 再生/一時停止/停止・ループ・テンポ直接編集（BPMクリックで入力）・小節:拍カウンター |
| 🎛 アレンジメントビュー | 全トラックのノートブロックをキャンバスに表示、60fps赤プレイヘッドでリアルタイム追従 |
| 🎚 トラックパネル | トラックごとにミュート・音量フェーダーを個別調整 |
| ✎ 楽譜編集 | AI補助つき楽譜エディタでノートを追加・削除・修正 |
| 👁 ピアノロール | 生成された曲の音符を視覚的に確認 |
| ✍️ 歌詞生成 | AIが楽曲に合った歌詞を自動生成・折りたたみ表示 |
| 🔄 スタイル変換 | 生成済みの曲を別ジャンルに変換 |
| ⬇ MIDI書き出し | 標準MIDIファイルとしてダウンロード |
| 💾 ライブラリ保存 | 気に入った曲をブラウザに保存・管理 |

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

DAWプレイヤーで：
  ▶ トランスポートバーの ▶ で再生 → 赤プレイヘッドがリアルタイムに動く
  🎚 トラックパネルで各パートをミュート／音量調整
  ✎ 楽譜編集タブでノートを直接修正（AIによる理論補助あり）
  ⬇ MIDI保存 / 🔄 スタイル変換 / ✍️ 歌詞生成
```

---

## 技術スタック

- **フレームワーク**: [Next.js 14](https://nextjs.org/) (App Router)
- **AI**: [Claude claude-opus-4-6](https://www.anthropic.com/) via [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)
- **ピッチ検出**: [pitchy](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method)
- **音楽合成**: [Tone.js](https://tonejs.github.io/)
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)
