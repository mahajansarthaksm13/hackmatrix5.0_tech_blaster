import Link from "next/link";
import { Logo } from "./Nav";

export const TEAM = [
  { name: "Khushi Bode", id: "202501110037" },
  { name: "Kshitij Gurao", id: "202501100027" },
  { name: "Anuj Kadlag", id: "202501100025" },
  { name: "Sarthak Mahajan", id: "202501110093" },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line/80 bg-panel/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-extrabold">
              GridGuard <span className="text-flow">Twin</span>
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            Predict early. Act fairly. Waste less solar.
            <br />A renewable distribution grid digital twin for HACKMATRIX 5.0 · Problem statement ENR-02.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-faint">Team Tech Blasters</div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {TEAM.map((m) => (
              <li key={m.id} className="flex justify-between gap-4">
                <span>{m.name}</span>
                <span className="num text-faint">{m.id}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-faint">Explore</div>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-dim">
            <li><Link className="hover:text-flow" href="/twin/">Twin Console</Link></li>
            <li><Link className="hover:text-flow" href="/twin/actions/">Action Arena</Link></li>
            <li><Link className="hover:text-flow" href="/scenarios/">Scenario Lab</Link></li>
            <li><Link className="hover:text-flow" href="/connect/">Connect Check</Link></li>
            <li><Link className="hover:text-flow" href="/method/">How it works</Link></li>
          </ul>
          <p className="mt-4 text-xs text-faint">
            Solar: NREL PVWatts profile for Pune. Demand split and network are simulated — see “How it works”.
          </p>
        </div>
      </div>
    </footer>
  );
}
