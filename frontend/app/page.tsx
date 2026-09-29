"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FeederDiagram from "@/components/FeederDiagram";
import { Eyebrow } from "@/components/ui";
import { stepToTime } from "@/lib/config";
import { storyFor } from "@/lib/story";
import { getDay } from "@/lib/useTwin";

const START = 22; // 05:30
const END = 86; // 21:30

export default function Landing() {
  const s1 = useMemo(() => getDay("S1"), []);
  const s2 = useMemo(() => getDay("S2"), []);
  const s3 = useMemo(() => getDay("S3"), []);
  const [step, setStep] = useState(46);
  const [guard, setGuard] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s >= END ? START : s + 1)), 320);
    return () => clearInterval(id);
  }, []);

  const rec = s1.steps[step];
  const story = storyFor(rec, guard);
  const m1 = s1.metrics;
  const totalBefore = m1.baseViolationSteps + s2.metrics.baseViolationSteps + s3.metrics.baseViolationSteps;
  const totalAfter = m1.ggViolationSteps + s2.metrics.ggViolationSteps + s3.metrics.ggViolationSteps;
  const hour = step / 4;
  const sky = hour < 6.5 || hour > 18.5 ? "🌙" : hour < 9 || hour > 16 ? "🌤️" : "☀️";

  return (
    <div>
      {/* HERO */}
      <section className="grid-bg relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-flow/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-2 lg:pt-20">
          <div className="fade-up min-w-0">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs text-dim">
              <span className="h-2 w-2 animate-pulse rounded-full bg-safe" />
              HACKMATRIX 5.0 · ENR-02 · Team Tech Blasters
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Other tools tell you the grid <span className="text-risk">broke</span>.
              <br />
              <span className="bg-gradient-to-r from-flow to-safe bg-clip-text text-transparent">We tell you it&apos;s about to.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-dim">
              <b className="text-ink">GridGuard Twin</b> is a computer copy of a local power line full of rooftop solar. It spots high voltage and overloads{" "}
              <b className="text-ink">15–60 minutes early</b>, tests every fix, and picks the one that <b className="text-ink">wastes the least solar</b> — and tells you why.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["🔮 Predict early", "⚖️ Act fairly", "☀️ Waste less solar"].map((t) => (
                <span key={t} className="rounded-full border border-flow/30 bg-flow/10 px-4 py-1.5 text-sm font-bold text-flow">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/twin/" className="rounded-full bg-flow px-6 py-3 font-bold text-night shadow-[0_0_30px_rgba(34,211,238,0.5)] transition hover:brightness-110">
                Enter the twin →
              </Link>
              <Link href="/connect/" className="rounded-full border border-line bg-panel px-6 py-3 font-bold transition hover:border-flow/50">
                🏠 Check a rooftop connection
              </Link>
            </div>
          </div>

          {/* live hero twin */}
          <div className="card relative min-w-0 p-3 shadow-[0_0_60px_rgba(34,211,238,0.08)]">
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{sky}</span>
                <span className="num text-3xl font-bold">{stepToTime(step)}</span>
                <span className="hidden text-xs text-faint sm:inline">Pune · sunny day</span>
              </div>
              <div className="inline-flex rounded-full border border-line bg-night p-0.5 text-xs">
                <button onClick={() => setGuard(false)} className={`rounded-full px-2.5 py-1 font-semibold ${!guard ? "bg-risk/20 text-risk" : "text-dim"}`}>
                  Without
                </button>
                <button onClick={() => setGuard(true)} className={`rounded-full px-2.5 py-1 font-semibold ${guard ? "bg-safe/20 text-safe" : "text-dim"}`}>
                  GridGuard
                </button>
              </div>
            </div>
            <FeederDiagram flow={guard ? rec.gg : rec.base} inj={rec.inj} soc={guard ? rec.socAfter : s1.scenario.startSoc} compact className="w-full" />
            <div
              className={`mx-2 mb-2 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                story.tone === "risk" ? "border-risk/50 bg-risk/10" : story.tone === "watch" ? "border-watch/40 bg-watch/10" : story.tone === "flow" ? "border-flow/40 bg-flow/10" : "border-safe/40 bg-safe/10"
              }`}
            >
              <span className="text-xl">{story.icon}</span>
              <div>
                <b>{story.headline}</b> <span className="text-dim">{story.detail}</span>
              </div>
            </div>
            <div className="px-2 pb-1 text-[11px] text-faint">Watch the flow arrows flip at midday — power runs backwards into the transformer.</div>
          </div>
        </div>

        {/* headline results */}
        <div className="relative mx-auto max-w-7xl px-4 pb-16">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <BigNum value={`${totalBefore} → ${totalAfter}`} label="problem steps on the sunny, peak and cloudy days" tone="safe" />
            <BigNum value={`${(m1.utilisation * 100).toFixed(0)}%`} label="of the day's solar actually used, zero limits broken" tone="flow" />
            <BigNum value={`${(m1.curtailSaved * 100).toFixed(0)}%`} label="less solar wasted than cut-only control" tone="safe" />
            <BigNum value={`${m1.minLead ?? 0} min`} label="early warning before the first problem" tone="watch" />
          </div>
          <p className="mt-2 text-center text-xs text-faint">Measured live in this prototype on the demo feeder — open the Scenario Lab to check every number.</p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Same line. Opposite problems. A few hours apart.</h2>
        <p className="mt-2 max-w-2xl text-dim">Local power lines were built for one-way flow. Rooftop solar made them two-way — and the engineers running them are deciding blind.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card relative overflow-hidden p-6">
            <div className="absolute -right-6 -top-6 text-[120px] opacity-10">☀️</div>
            <div className="num text-sm text-watch">12:00 · MIDDAY</div>
            <div className="mt-1 text-2xl font-extrabold">Voltage climbs too high</div>
            <ul className="mt-3 space-y-1.5 text-dim">
              <li>☀️ Rooftops make more power than homes use</li>
              <li>↩️ Extra power flows back toward the transformer</li>
              <li>📈 Voltage at the far end goes above 1.05 p.u.</li>
            </ul>
          </div>
          <div className="card relative overflow-hidden p-6">
            <div className="absolute -right-6 -top-6 text-[120px] opacity-10">🌆</div>
            <div className="num text-sm text-risk">20:00 · EVENING</div>
            <div className="mt-1 text-2xl font-extrabold">Lines get overloaded</div>
            <ul className="mt-3 space-y-1.5 text-dim">
              <li>🌙 The sun is gone</li>
              <li>🏠 Everyone is home — demand peaks</li>
              <li>🔥 Lines and the transformer go over 100%</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Fact big="50 lakh+" text="homes on PM Surya Ghar by August 2026" />
          <Fact big="~16,000" text="new rooftop installations every day (July 2026)" />
          <Fact big="Fixed" text="transformer size — it never grows, but every new rooftop pushes more power into it" />
        </div>
      </section>

      {/* HOW */}
      <section className="border-y border-line/70 bg-panel/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Predict. Test. Explain.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { i: "🔮", t: "1 · Spots trouble early", d: "Three forecasts — low, expected, high solar — run 60 minutes ahead. A 0–100 risk score and a countdown to the first problem." },
              { i: "🧪", t: "2 · Tests every fix first", d: "Battery, tie switch, inverter setting, solar cut — each one simulated, alone and in pairs. Nothing is tried on the real line." },
              { i: "💬", t: "3 · Picks the best, says why", d: "Safe first, then least solar wasted. 3–5 plain reasons, each quoting a real number. No AI text — nothing made up." },
            ].map((c) => (
              <div key={c.t} className="card p-6">
                <div className="text-4xl">{c.i}</div>
                <div className="mt-3 text-xl font-bold">{c.t}</div>
                <p className="mt-2 text-dim">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TWO MODES */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Eyebrow>One engine, two modes</Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">The next hour. The next rooftop.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/twin/" className="card group p-6 transition hover:ring-1 hover:ring-flow/50">
            <div className="flex items-center justify-between">
              <span className="text-4xl">🖥️</span>
              <span className="rounded-full bg-flow/10 px-3 py-1 text-xs font-bold text-flow">OPERATE · next 15–60 min</span>
            </div>
            <div className="mt-3 text-2xl font-extrabold">“Will this line break in the next hour?”</div>
            <p className="mt-2 text-dim">Forecast, power flow, risk score, and the best fix — ranked and explained. For campuses, microgrids and smart-inverter feeders.</p>
            <div className="mt-4 font-semibold text-flow group-hover:underline">Open the Twin Console →</div>
          </Link>
          <Link href="/connect/" className="card group p-6 transition hover:ring-1 hover:ring-watch/50">
            <div className="flex items-center justify-between">
              <span className="text-4xl">🏠</span>
              <span className="rounded-full bg-watch/10 px-3 py-1 text-xs font-bold text-watch">CONNECT · next rooftop</span>
            </div>
            <div className="mt-3 text-2xl font-extrabold">“Is it safe to connect this house?”</div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-safe/15 px-3 py-1 font-bold text-safe">✅ Safe</span>
              <span className="rounded-full bg-watch/15 px-3 py-1 font-bold text-watch">🛠️ Safe with a fix</span>
              <span className="rounded-full bg-risk/15 px-3 py-1 font-bold text-risk">🏗️ Needs upgrade</span>
            </div>
            <p className="mt-3 text-dim">Not a flat yes or no — the exact inverter setting or battery size that makes it safe.</p>
            <div className="mt-4 font-semibold text-watch group-hover:underline">Try the Connect Check →</div>
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-panel/60 p-5 text-dim">
          <b className="text-ink">💡 The big idea:</b> in India, most live fixes can&apos;t be pressed — CEA rules only make rooftop inverters switch off, and local batteries are rare. But
          every new connection is a moment when the fix <i>can</i> be chosen. GridGuard Twin moves the fix from <b className="text-ink">run-time</b> to{" "}
          <b className="text-ink">connect-time</b>.
        </div>
      </section>

      {/* SIX DIFFERENCES */}
      <section className="border-y border-line/70 bg-panel/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Eyebrow>Why it&apos;s different</Eyebrow>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Six things no other open tool does together</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["🔁", "Two modes, one engine", "A new rooftop is just another scenario: add it, replay the day, check the limits."],
              ["🎯", "Honest risk score", "“82/100 — critical” means it breaks even on a cloudy afternoon, not just in the best case."],
              ["☀️", "Saves solar first", "Safe → least solar cut → least battery → fewest switches. Every option actually simulated."],
              ["💬", "“Why this fix?”", "3–5 reasons from real numbers, including why the other fixes lost."],
              ["⚖️", "Fair solar cuts", "Shared by system size, not dumped on the last house. Fairness score shown."],
              ["🛠️", "Failure becomes a plan", "When nothing works, it names the limit and the smallest battery, cap or transformer that fixes it."],
            ].map(([i, t, d]) => (
              <div key={t} className="card p-5">
                <div className="text-3xl">{i}</div>
                <div className="mt-2 text-lg font-bold">{t}</div>
                <p className="mt-1 text-sm text-dim">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Eyebrow>Today&apos;s options</Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Why the usual answers fall short</h2>
        <div className="card mt-8 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="p-4 font-medium text-faint" />
                {["Enterprise DERMS", "Free power-flow tools", "Fixed % caps", "GridGuard Twin"].map((h, i) => (
                  <th key={h} className={`p-4 text-center font-bold ${i === 3 ? "bg-flow/10 text-flow" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Warns before a problem", [true, false, false, true]],
                ["Tests and ranks fixes", [true, false, false, true]],
                ["Explains why, in plain words", [false, false, false, true]],
                ["“Yes, if…” for a new rooftop", [false, false, false, true]],
                ["Knows where on the line the solar sits", [true, true, false, true]],
                ["Affordable for one section office", [false, true, true, true]],
              ].map(([row, vals]) => (
                <tr key={row as string} className="border-b border-line/50 last:border-0">
                  <td className="p-4 font-semibold">{row as string}</td>
                  {(vals as boolean[]).map((v, i) => (
                    <td key={i} className={`p-4 text-center text-lg ${i === 3 ? "bg-flow/5" : ""}`}>
                      {v ? <span className="text-safe">✓</span> : <span className="text-faint">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PEOPLE */}
      <section className="border-y border-line/70 bg-panel/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <Eyebrow>Who it&apos;s for</Eyebrow>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Built for the people who say yes or no</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Persona
              emoji="👩‍💼"
              name="Priya"
              role="Assistant Engineer, Pune sub-division"
              quote="I approve 20–40 rooftop applications a month on transformers I can't see. I need “safe”, “safe with this condition” or “needs upgrade” — and a reason I can put in the file."
            />
            <Persona
              emoji="👷"
              name="Anoop"
              role="Owner, 12-person rooftop solar company"
              quote="I lose sales when a transformer fills up between the quote and the application. I want to know before the site visit if a small battery would still get my customer connected."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-flow/30 bg-gradient-to-br from-flow/15 via-panel to-safe/10 p-10 text-center">
          <div className="text-4xl font-black tracking-tight md:text-5xl">
            Predict early. Act fairly. <span className="text-flow">Waste less solar.</span>
          </div>
          <p className="mx-auto mt-3 max-w-xl text-dim">Play a full day in 15-minute steps. Watch the risk rise, the fix win, and the line stay safe.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/twin/" className="rounded-full bg-flow px-6 py-3 font-bold text-night shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:brightness-110">
              Enter the twin →
            </Link>
            <Link href="/scenarios/" className="rounded-full border border-line bg-panel px-6 py-3 font-bold hover:border-flow/50">
              🧪 See the 4 test days
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function BigNum({ value, label, tone }: { value: string; label: string; tone: "safe" | "flow" | "watch" }) {
  const col = { safe: "text-safe", flow: "text-flow", watch: "text-watch" }[tone];
  return (
    <div className="card p-5">
      <div className={`num text-3xl font-extrabold md:text-4xl ${col}`}>{value}</div>
      <div className="mt-1 text-sm text-dim">{label}</div>
    </div>
  );
}

function Fact({ big, text }: { big: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-5">
      <div className="num text-3xl font-extrabold text-flow">{big}</div>
      <div className="mt-1 text-sm text-dim">{text}</div>
    </div>
  );
}

function Persona({ emoji, name, role, quote }: { emoji: string; name: string; role: string; quote: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-flow/10 text-3xl">{emoji}</div>
        <div>
          <div className="text-lg font-bold">{name}</div>
          <div className="text-sm text-dim">{role}</div>
        </div>
      </div>
      <p className="mt-4 text-lg leading-relaxed">“{quote}”</p>
    </div>
  );
}
