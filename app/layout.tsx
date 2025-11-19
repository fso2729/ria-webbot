import type { Metadata } from "next";
import { Noto_Sans_JP, M_PLUS_Rounded_1c } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
});

const mPlusRounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mplus-rounded",
});

export const metadata: Metadata = {
  title: "リア | AI Chat",
  description: "Riaと会話するためのAIチャットアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${mPlusRounded.variable} font-sans antialiased min-h-dvh relative overflow-hidden`}
      >
        {/* 青空背景（画像を直接使用） */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('MeetingHall.png')",
          }}
        />

        {/* ふわ雲レイヤー（CSSだけで作成） */}
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(60rem 20rem at 20% 20%, rgba(255,255,255,0.8), transparent 60%)," +
              "radial-gradient(50rem 20rem at 70% 30%, rgba(255,255,255,0.7), transparent 60%)," +
              "radial-gradient(55rem 22rem at 40% 55%, rgba(255,255,255,0.8), transparent 60%)," +
              "radial-gradient(45rem 18rem at 80% 70%, rgba(255,255,255,0.6), transparent 60%)",
          }}
        />

        {/* アプリ本体（ここに各ページのUIが入る） */}
        <main className="relative z-10 flex items-center justify-center min-h-dvh p-3 sm:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
