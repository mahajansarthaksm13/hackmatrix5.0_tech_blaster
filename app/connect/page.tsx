"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, Pill, Term } from "@/components/ui";
import { BusId, FEEDER, PV, ScenarioId, scenarioById } from "@/lib/config";
import { CONNECT_CUT_LIMIT, ConnectInput, InverterMode, Verdict, checkConnection } from "@/lib/engine";

const BUSES: { id: BusId; where: string; hint: string }[] = [
  { id: "B2", where: "Middle of Feeder A", hint: `${PV.B2} kW solar already here` },
  { id: "B3", where: "End of Feeder A", hint: `Weakest spot · ${PV.B3} kW + battery` },
  { id: "B5", where: "End of Feeder B", hint: `${PV.B5} kW solar already here` },
];
const SIZES = Array.from({ length: 15 }, (_, i) => 2 + i * 2);

const VERDICT: Record<Verdict, { icon: string; title: string; sub: string; cls: string; color: string }> = {
  safe: { icon: "✅", title: "SAFE AS PROPOSED", sub: "Connect it. The line stays inside every limit.", cls: "border-safe/60 bg-safe/10", color: "#34d399" },
  fix: { icon: "🛠️", title: "SAFE WITH A FIX", sub: "Yes, if… — one design change makes it safe.", cls: "border-watch/60 bg-watch/10", color: "#fbbf24" },
  upgrade: { icon: "🏗️", title: "NEEDS AN UPGRADE", sub: "Not safe yet. The transformer or line needs work first.", cls: "border-risk/60 bg-risk/10", color: "#f43f5e" },
};

export default function ConnectPage() {
  const [input, setInput] = useState<ConnectInput>({ bus: "B3", kw: 6, mode: "unity", battKWh: 0 });
  const [chartSc, setChartSc] = useState<ScenarioId>("S1");
  const result = useMemo(() => checkConnection(input), [input]);
  const v = VERDICT[result.verdict];
  const shownScenarios = result.fixScenarios ?? result.scenarios;
  const chartData = (result.verdict === "fix" ? result.fixScenarios! : result.scenarios).find((s) => s.scenario === chartSc)!.hourlyV;

  // Hosting map: where can the next rooftop go? (computed in small chunks so the page stays responsive)
  const [map, setMap] = useState<Record<string, Verdict>>({});
  useEffect(() => {
    let cancelled = false;
    const jobs: ConnectInput[] = [];
    for (const b of BUSES) for (const kw of SIZES) jobs.push({ bus: b.id, kw, mode: input.mode, battKWh: input.battKWh });
    const acc: Record<string, Verdict> = {};
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      const end = Math.min(jobs.length, i + 5);
      for (; i < end; i++) acc[`${jobs[i].bus}-${jobs[i].kw}`] = checkConnection(jobs[i]).verdict;
      setMap({ ...acc });
      if (i < jobs.length) setTimeout(tick, 0);
    };
    setMap({});
    setTimeout(tick, 30);
    return () => {
      cancelled = true;
    };
  }, [input.mode, input.battKWh]);

  return (
    <div className="grid-bg">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader eyebrow="Connection Simulator · Connect mode" title="Not just yes or no. Yes, if…" slogan="Check a new rooftop system before the site visit — and get the exact fix that gets it approved." />

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Inputs */}
          <div className="card p-5 lg:col-span-2">
            <Step n={1} title="Where is the house?">
              <div className="grid grid-cols-3 gap-2">
                {BUSES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setInput({ ...input, bus: b.id })}
                    className={`rounded-xl border p-2.5 text-left transition ${input.bus === b.id ? "border-flow bg-flow/10" : "border-line hover:border-flow/40"}`}
                  >
                    <div className="num text-lg font-extrabold">{b.id}</div>
                    <div className="text-[11px] leading-tight text-dim">{b.where}</div>
                    <div className="mt-1 text-[10px] leading-tight text-faint">{b.hint}</div>
                  </button>
                ))}
              </div>
            </Step>

            <Step n={2} title="How big is the rooftop system?">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  className="scrub"
                  min={2}
                  max={30}
                  step={2}
                  value={input.kw}
                  onChange={(e) => setInput({ ...input, kw: +e.target.value })}
                  aria-label="Solar size in kW"
                />
                <div className="num w-20 shrink-0 text-right text-2xl font-extrabold">{input.kw} kW</div>
              </div>
              <div className="mt-1 text-xs text-dim">≈ {result.newKWhPerDay.toFixed(0)} kWh of clean energy on a sunny Pune day</div>
            </Step>

            <Step n={3} title="Inverter setting">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["unity", "Standard", "Unity power factor — today's default"],
                    ["pf095", "Smart · 0.95 PF", "Absorbs reactive power to pull voltage down"],
                  ] as [InverterMode, string, string][]
                ).map(([m, t, d]) => (
                  <button
                    key={m}
                    onClick={() => setInput({ ...input, mode: m })}
                    className={`rounded-xl border p-3 text-left transition ${input.mode === m ? "border-flow bg-flow/10" : "border-line hover:border-flow/40"}`}
                  >
                    <div className="font-bold">{t}</div>
                    <div className="text-[11px] text-dim">{d}</div>
                  </button>
                ))}
              </div>
            </Step>

            <Step n={4} title="Home battery" last>
              <div className="grid grid-cols-3 gap-2">
                {([0, 5, 10] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setInput({ ...input, battKWh: b })}
                    className={`rounded-xl border p-3 text-center font-bold transition ${input.battKWh === b ? "border-flow bg-flow/10" : "border-line hover:border-flow/40"}`}
                  >
                    {b === 0 ? "None" : `🔋 ${b} kWh`}
                  </button>
                ))}
              </div>
            </Step>
          </div>

          {/* Verdict */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <div key={result.verdict + JSON.stringify(input)} className={`fade-up rounded-2xl border-2 p-6 ${v.cls}`}>
              <div className="flex items-center gap-4">
                <span className="text-5xl">{v.icon}</span>
                <div>
                  <div className="text-2xl font-black tracking-wide md:text-3xl" style={{ color: v.color }}>
                    {v.title}
                  </div>
                  <div className="text-dim">{v.sub}</div>
                </div>
              </div>
              {result.verdict === "fix" && result.fixText && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl bg-night/60 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-watch">The fix</div>
                    <div className="text-lg font-bold">{result.fixText}</div>
                  </div>
                  <button onClick={() => setInput(result.fix!)} className="rounded-full bg-watch px-4 py-2 text-sm font-bold text-night hover:brightness-110">
                    Apply the fix →
                  </button>
                </div>
              )}
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <div className="text-sm font-semibold text-dim">
                Replayed across 4 test days {result.verdict === "fix" && <span className="text-watch">(with the fix)</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {shownScenarios.map((s) => {
                  const sc = scenarioById(s.scenario);
                  return (
                    <button
                      key={s.scenario}
                      onClick={() => setChartSc(s.scenario)}
                      className={`rounded-xl border p-3 text-left transition ${chartSc === s.scenario ? "border-flow/60 bg-flow/5" : "border-line hover:border-flow/30"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          {sc.emoji} <span className="text-sm font-semibold">{sc.name}</span>
                        </span>
                      </div>
                      <div className="mt-1">{s.pass ? <Pill tone="safe">✓ pass</Pill> : s.gating ? <Pill tone="risk">✗ fail</Pill> : <Pill tone="watch">⚠ stress</Pill>}</div>
                      <div className="mt-1 text-[11px] leading-tight text-dim">{s.note}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-dim">
                  Voltage at <b className="text-ink">{input.bus}</b> through the day · {scenarioById(chartSc).name}
                </div>
                <div className="flex gap-3 text-xs text-dim">
                  <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-faint" /> today</span>
                  <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4" style={{ background: v.color }} /> with new system</span>
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="#1c2738" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="time" stroke="#56647a" fontSize={11} interval={3} />
                    <YAxis domain={[0.94, 1.08]} stroke="#56647a" fontSize={11} tickFormatter={(x) => x.toFixed(2)} />
                    <Tooltip contentStyle={{ background: "#101826", border: "1px solid #1c2738", borderRadius: 8, fontSize: 12 }} formatter={(x: number) => x.toFixed(3)} />
                    <ReferenceArea y1={FEEDER.vMax} y2={1.08} fill="#f43f5e" fillOpacity={0.07} />
                    <ReferenceLine y={FEEDER.vMax} stroke="#f43f5e" strokeDasharray="4 4" />
                    <ReferenceLine y={FEEDER.vMin} stroke="#f43f5e" strokeDasharray="4 4" />
                    <Line dataKey="before" name="Today" stroke="#56647a" dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line dataKey="after" name="With new system" stroke={v.color} dot={false} strokeWidth={2.5} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Hosting map */}
        <div className="card mt-6 p-5">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold">🗺️ Where can the next rooftop go?</h2>
              <p className="text-sm text-dim">
                Every spot × every size, with your inverter setting and battery choice. Tap a cell to check it.
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-safe/70" /> Safe</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-watch/70" /> With fix</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-risk/70" /> Upgrade</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="num w-full min-w-[640px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="w-12" />
                  {SIZES.map((kw) => (
                    <th key={kw} className="font-medium text-faint">
                      {kw}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BUSES.map((b) => (
                  <tr key={b.id}>
                    <td className="pr-2 font-bold">{b.id}</td>
                    {SIZES.map((kw) => {
                      const vv = map[`${b.id}-${kw}`];
                      const bg = vv === "safe" ? "bg-safe/70" : vv === "fix" ? "bg-watch/70" : vv === "upgrade" ? "bg-risk/60" : "bg-line animate-pulse";
                      const on = input.bus === b.id && input.kw === kw;
                      return (
                        <td key={kw}>
                          <button
                            onClick={() => setInput({ ...input, bus: b.id, kw })}
                            className={`h-8 w-full rounded-md ${bg} ${on ? "ring-2 ring-ink" : ""}`}
                            aria-label={`${b.id} ${kw} kW: ${vv ?? "checking"}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-right text-[11px] text-faint">solar size (kW) →</div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            How the check works: the twin adds the system, replays sunny, peak and cloudy days hour by hour with GridGuard running the feeder, and passes it if no limit
            breaks and it forces at most {Math.round(CONNECT_CUT_LIMIT * 100)}% of its own output in{" "}
            <Term tip="Solar thrown away on purpose — shared fairly by size across all rooftops.">solar cuts</Term>. The critical holiday is shown as a stress test.
            Engineering advice alongside the DISCOM rule — not instead of it.
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-5"}>
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <span className="num flex h-6 w-6 items-center justify-center rounded-full bg-flow text-xs font-bold text-night">{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
