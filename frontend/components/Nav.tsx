"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/twin/", label: "Twin Console", icon: "🖥️" },
  { href: "/twin/actions/", label: "Action Arena", icon: "🏆" },
  { href: "/scenarios/", label: "Scenario Lab", icon: "🧪" },
  { href: "/connect/", label: "Connect Check", icon: "🏠" },
  { href: "/method/", label: "How it works", icon: "📘" },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path d="M16 2 L28 7 V16 C28 23 22.5 28 16 30 C9.5 28 4 23 4 16 V7 Z" fill="none" stroke="url(#lg)" strokeWidth="2.2" />
      <path d="M17.5 8 L11 17.5 H15.5 L14.5 24 L21 14.5 H16.5 Z" fill="url(#lg)" />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname() ?? "/";
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-night/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo />
          <span className="text-[17px] font-extrabold tracking-tight">
            GridGuard <span className="text-flow">Twin</span>
          </span>
        </Link>
        <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {LINKS.map((l) => {
            const active = norm(path) === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  active ? "bg-flow/15 text-flow ring-1 ring-flow/40" : "text-dim hover:bg-white/5 hover:text-ink"
                }`}
              >
                <span className="mr-1">{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/twin/"
          className="hidden shrink-0 rounded-full bg-flow px-4 py-1.5 text-sm font-bold text-night shadow-[0_0_20px_rgba(34,211,238,0.45)] hover:brightness-110 md:inline-block"
        >
          Enter the twin →
        </Link>
      </div>
    </header>
  );
}
