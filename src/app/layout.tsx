import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { SiteNav } from "./site-nav";
import { getSessionModerator } from "@/lib/moderatorAuth";
import "./globals.css";

const X_PROFILE_URL = "https://x.com/lolwatch110";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const moderator = await getSessionModerator();

  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="site-shell">
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="site-logo">
                <Image
                  src="/logo.png"
                  alt=""
                  aria-hidden
                  width={26}
                  height={26}
                  className="site-logo-mark"
                />
                lolwatch
              </Link>
              <SiteNav isModerator={!!moderator} />
              <a
                href={X_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="site-x-link"
                aria-label="lolwatch公式X(旧Twitter)アカウント"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
                  <path
                    fill="currentColor"
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  />
                </svg>
              </a>
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
