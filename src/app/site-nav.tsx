"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/players", label: "通報一覧" },
  { href: "/stats", label: "統計" },
  { href: "/guidelines", label: "ガイドライン" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      {LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={isActive ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
