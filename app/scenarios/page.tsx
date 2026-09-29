"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DayChart, Legend } from "@/components/charts";
import { PageHeader, Pill, Stat, Term } from "@/components/ui";
import { SCENARIOS } from "@/lib/config";
import { prescribe } from "@/lib/engine";
import { getDay, useTwin } from "@/lib/useTwin";

export default function ScenarioLab() {
  const { scenarioId, setScenario } = useTwin();
  const days = useMemo(() => SCENARIOS.map((s) => getDay(s.id)), []);
  const day = days.find((d) => d.scenario.id === scenarioId)!;
  const m = day.metrics;
  const plan = useMemo(() => prescribe(day), [day]);

  return (
    <div className="grid-bg">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader eyebrow="Scenario Lab" title="Four tough days. Before vs after." slogan="Same power line, four stress tests — including one honest failure." />

        {/* Scenario cards */}
        <div className="grid gap-3 md:grid-cols-4">
          {days.map((d) => {
            const on = d.scenario.id === scenarioId;
            const fixedAll = d.metrics.ggViolationSteps === 0;
            return (
              <button
                key={d.scenario.id}
                onClick={() => setScenario(d.scenario.id)}
                className={`card p-4 text-left transition ${on ? "ring-2 ring-flow/70" : "hover:ring-1 hover:ring-flow/30"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{d.scenario.emoji}</span>
                  {fixedAll ? <Pill tone="safe">✓ fixed</Pill> : <Pill tone="risk">needs upgrade</Pill>}
                </div>
                <div className="mt-2 font-bold">
                  <span className="num mr-1 text-faint">{d.scenario.id}</span>
                  {d.scenario.name}
                </div>
                <div className="text-xs text-dim">{d.scenario.tagline}</div>
                <div className="mt-3 flex items-end gap-2">
                  <span className="num text-2xl font-bold text-risk">{d.metrics.baseViolationSteps}</span>
                  <span className="pb-1 text-faint">→</span>
                  <span className={`num text-2xl font-bold ${fixedAll ? "text-safe" : "text-watch"}`}>{d.metrics.ggViolationSteps}</span>
                  <span className="pb-1 text-xs text-dim">problem steps</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="card mt-6 p-5">
          <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
            <h2 className="text-2xl font-extrabold">
              {day.scenario.emoji} {day.scenario.name}
            </h2>
            <div className="text-sm text-dim">
              <b className="text-ink">Setup:</b> {day.scenario.setup} · <b className="text-ink">Tests:</b> {day.scenario.tests}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Problem steps" value={<>{m.baseViolationSteps} → {m.ggViolationSteps}</>} sub="15-min steps over a limit" tone={m.ggViolationSteps === 0 ? "safe" : "risk"} />
            <Stat
              label="Solar used"
              value={day.scenario.solarFactor === 0 ? "—" : `${(m.utilisation * 100).toFixed(1)}%`}
              sub={day.scenario.solarFactor === 0 ? "no sun in this test" : `${m.solarUsedKWh.toFixed(0)} of ${m.solarAvailKWh.toFixed(0)} kWh`}
              tone="flow"
            />
            <Stat
              label="Less solar wasted"
              value={m.cutOnlyCurtailKWh > 0 ? `${(m.curtailSaved * 100).toFixed(0)}%` : "—"}
              sub={m.cutOnlyCurtailKWh > 0 ? `${m.curtailKWh.toFixed(1)} vs ${m.cutOnlyCurtailKWh.toFixed(1)} kWh cut-only` : "no cuts needed"}
              tone="safe"
            />
            <Stat label="Early warning" value={m.minLead !== null ? `${m.minLead} min` : "—"} sub="before the first problem" tone="watch" />
            <Stat label="Fairness" value={m.jain !== null ? m.jain.toFixed(2) : "—"} sub="Jain's index when cutting" tone="safe" />
            <Stat label="Highest voltage" value={<>{m.baseMaxV.toFixed(3)}→{m.ggMaxV.toFixed(3)}</>} sub="p.u. (limit 1.05)" tone={m.ggMaxV > 1.05 ? "risk" : "safe"} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Before vs after</div>
            <Legend
              items={[
                { color: "#f43f5e", label: "Without GridGuard" },
                { color: "#34d399", label: "With GridGuard" },
                { color: "#f43f5e", label: "Lowest voltage", dashed: true },
              ]}
            />
          </div>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-line/70 p-3">
              <div className="text-sm text-dim">Voltage (p.u.)</div>
              <DayChart day={day} kind="voltage" height={200} />
            </div>
            <div className="rounded-xl border border-line/70 p-3">
              <div className="text-sm text-dim">Busiest line or transformer (%)</div>
              <DayChart day={day} kind="loading" height={200} />
            </div>
            <div className="rounded-xl border border-line/70 p-3">
              <div className="text-sm text-dim">Battery charge with GridGuard (%)</div>
              <DayChart day={day} kind="soc" height={180} />
            </div>
            <div className="rounded-xl border border-line/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-dim">
                <span>Solar used (kW)</span>
                <Legend
                  items={[
                    { color: "#fde68a", label: "Available" },
                    { color: "#f43f5e", label: "Cut-only", dashed: true },
                    { color: "#34d399", label: "GridGuard" },
                  ]}
                />
              </div>
              <DayChart day={day} kind="solar" height={180} />
            </div>
          </div>

          {/* Upgrade prescription */}
          {plan && (
            <div className="mt-6 rounded-2xl border border-risk/50 bg-risk/5 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-risk">No feasible action · {plan.infeasibleWindow}</div>
                  <h3 className="mt-1 text-2xl font-extrabold">Failure becomes a plan. 🛠️</h3>
                  <p className="text-dim">
                    Blocking limit: <b className="text-ink">{plan.bindingLimit}</b>. Instead of guessing, the twin searched for the smallest upgrade and re-ran the whole day with it.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {plan.options.map((o) => (
                  <div key={o.label} className={`rounded-xl border p-4 ${o.works ? "border-safe/50 bg-safe/5" : "border-line bg-panel/60"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{o.icon}</span>
                      {o.works ? <Pill tone="safe">✓ works</Pill> : <Pill tone="dim">✗ not enough</Pill>}
                    </div>
                    <div className="mt-2 font-bold">{o.label}</div>
                    <div className="mt-1 text-sm text-dim">{o.detail}</div>
                  </div>
                ))}
              </div>
              {plan.recommended && (
                <div className="mt-4 rounded-xl bg-safe/10 p-3 text-sm">
                  ✅ <b>Recommended:</b> {plan.recommended} — the smallest change that makes this day safe.
                </div>
              )}
            </div>
          )}
          <div className="mt-4 text-right">
            <Link href="/twin/" className="text-sm font-semibold text-flow hover:underline">
              Replay this day in the Twin Console →
            </Link>
          </div>
        </div>

        {/* ENR-02 */}
        <div className="mt-8">
          <h2 className="text-2xl font-extrabold">✅ ENR-02 outcomes — where to see each one</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              { n: 1, t: "Digital twin with time-series data", s: "Twin Console", h: "/twin/", d: "6-bus feeder, Pune solar, 96 steps a day" },
              { n: 2, t: "Detect and predict problems early", s: "Risk gauge", h: "/twin/", d: "P10/P50/P90, up to 60 min ahead" },
              { n: 3, t: "Corrective actions, least solar wasted", s: "Action Arena", h: "/twin/actions/", d: "Every fix simulated and ranked" },
              { n: 4, t: "Before/after results, explained", s: "Scenario Lab + Why?", h: "/scenarios/", d: "Reasons quote real numbers" },
              { n: 5, t: "Honest failure handling", s: "Upgrade plan (S4)", h: "/scenarios/", d: "Smallest fix, re-simulated" },
            ].map((o) => (
              <Link key={o.n} href={o.h} className="card p-4 transition hover:ring-1 hover:ring-flow/40">
                <div className="num text-3xl font-extrabold text-flow/80">0{o.n}</div>
                <div className="mt-1 font-bold leading-tight">{o.t}</div>
                <div className="mt-1 text-xs text-dim">{o.d}</div>
                <div className="mt-2 text-xs font-semibold text-safe">✓ {o.s}</div>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">
            <Term tip="The comparison baseline: the same day where the only allowed fix is cutting solar, the most common fix today.">Cut-only baseline</Term> = the same day when cutting solar is the only tool.
          </p>
        </div>
      </div>
    </div>
  );
}
