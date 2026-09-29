import { PageHeader } from "@/components/ui";
import { TEAM } from "@/components/Footer";

const REAL = [
  ["☀️", "Pune solar shape", "NREL PVWatts hourly profile for Pune, filled in to 15 minutes"],
  ["📐", "Physics limits", "0.95–1.05 p.u. voltage, 100% line and transformer loading"],
  ["🏛️", "Policy facts", "CEA inverter rules, Kerala 90% cap, PM Surya Ghar numbers"],
];
const SIM = [
  ["🏠", "Demand split", "Home + small-business daily shape, 24–90 kW, split across 5 buses"],
  ["🔌", "Power line", "A simplified 6-bus, two-feeder low-voltage line with one tie switch"],
  ["🌥️", "Scenarios", "Four named stress days built on top of the real solar profile"],
];

const PARAMS = [
  ["Voltage level", "0.415 kV low voltage, fed by an 11/0.415 kV, 100 kVA transformer"],
  ["Layout", "B0 = transformer. Feeder A: B1 → B2 → B3. Feeder B: B4 → B5. Tie switch B3–B5, normally open"],
  ["Rooftop solar", "B2: 20 kW · B3: 25 kW · B5: 15 kW (60 kW total)"],
  ["Battery", "At B3: 50 kWh, 20 kW, kept between 20% and 90%"],
  ["Demand", "24–90 kW across the day, split across B1–B5"],
  ["Limits", "Voltage 0.95–1.05 p.u. · line and transformer loading ≤ 100%"],
  ["Time step", "15 minutes (96 steps a day). Connection checks use hourly steps"],
  ["Solar cuts", "5% steps, capped at 20% in the critical scenario"],
];

const PIPE = [
  { n: 1, icon: "🔮", t: "Forecast", d: "Low / expected / high solar and demand (P10/P50/P90), next 60 minutes." },
  { n: 2, icon: "⚡", t: "Power flow + risk", d: "Check every bus, line and the transformer against its limit. Score 0–100." },
  { n: 3, icon: "🧪", t: "Test every fix", d: "Inverter reactive power, battery, tie switch, solar cut — alone and in pairs." },
  { n: 4, icon: "🏆", t: "Rank the safe fixes", d: "Safe first → least solar cut → least battery use → fewest switch moves." },
  { n: 5, icon: "💬", t: "Explain + share fairly", d: "3–5 reasons built from real numbers. Cuts shared by system size." },
];

const WORDS = [
  ["Feeder / power line", "A local line that carries electricity from a transformer to homes and shops."],
  ["Digital twin", "A computer copy of a real system. Test “what if” without touching the real thing."],
  ["Bus", "A connection point on the line where homes, solar or batteries plug in."],
  ["p.u. (per unit)", "Voltage as a share of normal. 1.00 = normal. 1.05 = 5% too high."],
  ["Reverse flow", "Power flowing back toward the transformer instead of away from it."],
  ["Curtailment (solar cut)", "Turning solar output down on purpose to protect the line."],
  ["Tie switch", "A switch that links two feeders, so load can move from one to the other."],
  ["Reactive power / PF", "An inverter setting that helps pull voltage down. 0.95 PF absorbing is used here."],
  ["Export cap", "A limit on how much power a rooftop can send back to the grid."],
  ["SOC", "State of charge — how full the battery is, in %."],
  ["P10 / P50 / P90", "The low, expected and high forecasts."],
  ["Jain's index", "A fairness score. 1.0 means the solar cut is shared perfectly fairly."],
  ["kW / kWh / kVA", "kW = power now. kWh = energy over time. kVA = transformer size."],
  ["DISCOM", "The local power distribution company."],
];

const PAPERS = [
  ["Digital Twin System Based on Swarm Intelligence Scheduling for Distribution Networks", "IEEE, 2024", "https://ieeexplore.ieee.org/document/10692590"],
  ["Geographically Distributed Voltage Control Using Digital Twin", "EEE-AM, 2023", "https://ieeexplore.ieee.org/document/10395147"],
  ["Digital Twin Aided Dynamic Analysis of Distribution Networks with Power Hardware-in-the-Loop Validation", "IEEE, 2024", "https://ieeexplore.ieee.org/document/10694671"],
  ["Evolutionary Deep Reinforcement Learning for Volt-VAR Control in Distribution Network", "IEEE, 2022", "https://ieeexplore.ieee.org/document/9998947"],
  ["Particle Swarm Optimization for Battery Energy Storage System Sizing and Deployment in Renewable Integrated Distribution Network", "IEEE, 2024", "https://ieeexplore.ieee.org/document/10675081"],
  ["A Multi-Agent Framework for Voltage Control in Distribution Systems with High Penetration of Inverter-Based Resources", "IEEE, 2024", "https://ieeexplore.ieee.org/document/10850396"],
];

export default function Method() {
  return (
    <div className="grid-bg">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageHeader eyebrow="How it works" title="No black box. Every number has a source." slogan="What is real, what is simulated, and exactly how the twin decides." />

        {/* Real vs simulated */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5 ring-1 ring-safe/30">
            <div className="text-xs font-bold uppercase tracking-widest text-safe">Real data</div>
            <ul className="mt-3 space-y-3">
              {REAL.map(([i, t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="text-2xl">{i}</span>
                  <div>
                    <div className="font-bold">{t}</div>
                    <div className="text-sm text-dim">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5 ring-1 ring-watch/30">
            <div className="text-xs font-bold uppercase tracking-widest text-watch">Simulated (and why)</div>
            <ul className="mt-3 space-y-3">
              {SIM.map(([i, t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="text-2xl">{i}</span>
                  <div>
                    <div className="font-bold">{t}</div>
                    <div className="text-sm text-dim">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Feeder-level data isn't public. A small, tuned line shows the same physics clearly — and the engine takes any feeder file.</p>
          </div>
        </div>

        {/* Pipeline */}
        <h2 className="mt-10 text-2xl font-extrabold">One engine, five steps, two questions</h2>
        <p className="text-dim">Operate asks “what happens in the next hour?”. Connect asks “what happens if this house connects?”. Same pipeline.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {PIPE.map((p, i) => (
            <div key={p.n} className="card relative p-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{p.icon}</span>
                <span className="num text-xs text-faint">step {p.n}</span>
              </div>
              <div className="mt-2 font-bold">{p.t}</div>
              <div className="mt-1 text-sm text-dim">{p.d}</div>
              {i < PIPE.length - 1 && <div className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-flow md:block">▶</div>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-safe/40 bg-safe/5 p-4 text-sm">
            <b className="text-safe">No limit at risk?</b> Keep watching. No action — zero solar wasted.
          </div>
          <div className="rounded-xl border border-flow/40 bg-flow/5 p-4 text-sm">
            <b className="text-flow">A safe fix exists?</b> Recommend the winner, with its size and reasons.
          </div>
          <div className="rounded-xl border border-risk/40 bg-risk/5 p-4 text-sm">
            <b className="text-risk">Nothing is safe?</b> Stop recommending. Name the blocking limit and prescribe the smallest upgrade.
          </div>
        </div>

        {/* Rules */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="text-lg font-bold">🔮 How the forecast works</div>
            <ul className="mt-2 space-y-1.5 text-sm text-dim">
              <li>• Next-step solar = PVWatts profile × the current cloud factor.</li>
              <li>• Demand = that bus's normal daily shape.</li>
              <li>• Low / high range: ±25% solar, ±10% demand. While a cloud passes, the high run assumes it clears.</li>
              <li>• These ranges are stated assumptions; a trained model can replace them later.</li>
            </ul>
          </div>
          <div className="card p-5">
            <div className="text-lg font-bold">✅ When is a fix “safe”?</div>
            <ul className="mt-2 space-y-1.5 text-sm text-dim">
              <li>• Every bus stays between 0.95 and 1.05 p.u.</li>
              <li>• Every line is at or under 100% loading.</li>
              <li>• The transformer is at or under 100% of its rating.</li>
              <li>
                • …in <b className="text-ink">all three</b> forecast runs, not just the expected one.
              </li>
            </ul>
          </div>
          <div className="card p-5">
            <div className="text-lg font-bold">📊 Risk score (0–100)</div>
            <ul className="mt-2 space-y-1.5 text-sm text-dim">
              <li>• Each forecast run gets a stress value: 0 far from limits, rising near them, jumping once a limit breaks.</li>
              <li>• Weighted 25% low · 50% expected · 25% high.</li>
              <li>
                • <span className="text-safe">0–29 safe</span> · <span className="text-watch">30–59 watch</span> · <span className="text-risk">60–100 critical</span>.
              </li>
            </ul>
          </div>
        </div>

        {/* Parameters */}
        <h2 className="mt-10 text-2xl font-extrabold">The demo power line</h2>
        <div className="card mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {PARAMS.map(([k, v]) => (
                <tr key={k} className="border-b border-line/60 last:border-0">
                  <td className="w-40 p-3 font-semibold text-dim md:w-56">{k}</td>
                  <td className="num p-3">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tech */}
        <h2 className="mt-10 text-2xl font-extrabold">Built with</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["🐍 Engine", "Python 3.11 · pandapower · pandas · numpy · precompute.py writes JSON"],
            ["🌐 Website", "Next.js static export · Tailwind CSS · Recharts · hand-built SVG diagram"],
            ["☁️ Hosting", "Static hosting — no server, so the demo can't break on hackathon Wi-Fi"],
          ].map(([t, d]) => (
            <div key={t} className="card p-4">
              <div className="font-bold">{t}</div>
              <div className="mt-1 text-sm text-dim">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          This prototype runs a light TypeScript mirror of the engine (linearised radial power flow) right in the browser, so every screen is interactive offline.
        </p>

        {/* Word guide */}
        <h2 className="mt-10 text-2xl font-extrabold">📖 Word guide</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {WORDS.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-panel/70 p-3">
              <div className="font-bold text-flow">{t}</div>
              <div className="text-sm text-dim">{d}</div>
            </div>
          ))}
        </div>

        {/* Research */}
        <h2 className="mt-10 text-2xl font-extrabold">📚 Research & references</h2>
        <ul className="mt-4 space-y-2">
          {PAPERS.map(([t, y, u]) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noreferrer" className="card flex items-center justify-between gap-4 p-3 transition hover:ring-1 hover:ring-flow/40">
                <span className="text-sm">{t}</span>
                <span className="num shrink-0 text-xs text-faint">{y} ↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">
          Also: NREL PVWatts V8 · pandapower & OpenDSS docs · NISE open data & MSLDC · CEA connectivity regulations · Kerala transformer limits (Elsol) · PM Surya Ghar reports.
        </p>

        {/* Team */}
        <h2 className="mt-10 text-2xl font-extrabold">👥 Team Tech Blasters</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.id} className="card p-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-flow/15 text-lg font-extrabold text-flow">
                {m.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </div>
              <div className="mt-2 font-bold">{m.name}</div>
              <div className="num text-xs text-faint">{m.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
