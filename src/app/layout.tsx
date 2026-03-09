import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'harmonias — 口ずさんだら曲になる',
  description: 'ハミングしたメロディをAIが完全な曲に編曲するアプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-[#080812] antialiased">{children}</body>
    </html>
  );
}
