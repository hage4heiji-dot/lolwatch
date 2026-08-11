"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/reports", label: "通報一覧" },
  { href: "/players", label: "ユーザー一覧" },
  { href: "/stats", label: "統計" },
  { href: "/calibration", label: "判定基準診断" },
  { href: "/articles", label: "炎上案件" },
  { href: "/guidelines", label: "ガイドライン" },
];

export function SiteNav({ isModerator = false }: { isModerator?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      {LINKS.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={isActive ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
      <Link href="/report" className={`site-nav-report${pathname.startsWith("/report") ? " active" : ""}`}>
        📢 通報する
      </Link>
      {isModerator && (
        <Link href="/moderator" className={pathname.startsWith("/moderator") ? "active" : ""}>
          ⚔️ モデレーターに戻る
        </Link>
      )}
    </nav>
  );
}
