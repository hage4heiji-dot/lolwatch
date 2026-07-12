import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SiteNav } from "./site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lolwatch",
  description:
    "ゲームIDへの通報状況とモデレーター評価を集約する非公式サイト",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="site-shell">
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="site-logo">
                <span className="site-logo-mark" aria-hidden>
                  LW
                </span>
                lolwatch
              </Link>
              <SiteNav />
            </div>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p>
              lolwatchはRiot Games, Inc.とは一切関係のない非公式・第三者運営のファンサイトです。
            </p>
            <p>
              掲載されている一般ユーザーからの通報情報は投稿者による未検証の申告です。事実と異なる内容が含まれる可能性があります。「モデレーター評価」欄のみ、運営が定めた基準に基づき実際にリプレイ等を確認した上での判定です。
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
