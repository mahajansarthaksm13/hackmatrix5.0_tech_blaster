"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FeederDiagram, { vColor } from "@/components/FeederDiagram";
import { DayChart, Legend } from "@/components/charts";
import { GGToggle, PageHeader, Pill, RiskGauge, ScenarioTabs, Term, TimeScrubber } from "@/components/ui";
import { FAMILY_ICON, FAMILY_LABEL, RUNS, RUN_LABEL, describeAction, momentDetail } from "@/lib/engine";
import { storyFor } from "@/lib/story";
import { useTwin } from "@/lib/useTwin";

export default function TwinConsole() {
  const { day, step, withGG, setStep } = useTwin();
  const rec = day.steps[step];
  const detail = useMemo(() => momentDetail(day, step), [day, step]);
  const flow = withGG ? rec.gg : rec.base;
  const soc = withGG ? rec.socBefore : day.scenario.startSoc;
  const story = storyFor(rec, withGG);
  const [showWhy, setShowWhy] = useState(true);
  const toneCls = { safe: "border-safe/40 bg-safe/5", watch: "border-watch/40 bg-watch/5", risk: "border-risk/50 bg-risk/10", flow: "border-flow/40 bg-flow/5" }[story.tone];

  return (
    <div className="grid-bg">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader eyebrow="Twin Console · Operate mode" title="See it before it breaks." slogan="The whole power line on one screen. Drag the time, watch the risk, read the fix.">
          <GGToggle />
        </PageHeader>

        <ScenarioTabs />

        {/* Plain-words status */}
        <div key={`${day.scenario.id}-${step}-${withGG}`} className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${toneCls}`}>
          <span className="text-3xl leading-none">{story.icon}</span>
          <div>
            <div className="text-lg font-bold">{story.headline}</div>
            <div className="text-sm text-dim">{story.detail}</div>
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card relative overflow-hidden p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
              <div className="text-sm font-semibold text-dim">Live single-line diagram</div>
              <div className="flex flex-wrap gap-3 text-[11px] text-faint">
                <span>● bus colour = <Term tip="Voltage as a share of normal. 1.00 = normal. The safe range here is 0.95–1.05.">voltage</Term></span>
                <span>━ thickness = load</span>
                <span>⇢ moving dashes = power direction</span>
              </div>
            </div>
            <FeederDiagram flow={flow} inj={rec.inj} soc={withGG ? rec.socAfter : soc} className="w-full" />
            {flow.reverse && (
              <div className="absolute bottom-3 left-3">
                <Pill tone="watch">⟲ Reverse flow: {Math.abs(flow.trafoKw).toFixed(0)} kW going back to the grid</Pill>
              </div>
            )}
          </div>

            <TimeScrubber day={day} />
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-dim">Voltage across the day · tap to jump</div>
              <Legend
                items={[
                  { color: "#f43f5e", label: "Without GridGuard" },
                  { color: "#34d399", label: "With GridGuard" },
                  { color: "#22d3ee", label: "Now" },
                ]}
              />
            </div>
            <DayChart day={day} kind="voltage" step={step} height={210} onPick={setStep} />
          </div>
          </div>

          {/* Risk + action */}
          <div className="flex flex-col gap-4">
            <div className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold text-dim">
                  <Term tip="0–100. Three forecasts (low, expected, high solar) run 60 min ahead. The score is how many break a limit, weighted by how badly.">Risk score</Term>{" "}
                  · next 60 min if nobody acts
                </div>
                <Pill tone="dim">P10 · P50 · P90</Pill>
              </div>
              <RiskGauge risk={rec.forecast.risk} minutes={rec.forecast.minutesToViolation} level={rec.forecast.level} />
            </div>

            <div className={`card p-4 ${detail.winner ? (detail.winner.family === "none" ? "" : "ring-1 ring-safe/40") : "ring-1 ring-risk/50"}`}>
              <div className="text-xs font-bold uppercase tracking-widest text-faint">Recommended fix</div>
              {detail.winner ? (
                <>
                  <div className="mt-2 flex items-start gap-3">
                    <span className="text-3xl">{detail.winner.family === "none" ? "✅" : FAMILY_ICON[detail.winner.family]}</span>
                    <div>
                      <div className="text-lg font-bold leading-tight">{detail.winner.family === "none" ? "All good — no action needed" : FAMILY_LABEL[detail.winner.family]}</div>
                      <div className="text-sm text-dim">{describeAction(detail.winner.action)}</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <MiniStat label="Max V" value={detail.winner.vMax.toFixed(3)} color={vColor(detail.winner.vMax)} />
                    <MiniStat label="Min V" value={detail.winner.vMin.toFixed(3)} color={vColor(detail.winner.vMin)} />
                    <MiniStat label="Max load" value={`${detail.winner.maxLoad.toFixed(0)}%`} color={detail.winner.maxLoad > 100 ? "#f43f5e" : "#e7eef8"} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Pill tone="safe">✓ safe in all 3 forecasts</Pill>
                    <Pill tone={detail.winner.curtailKWh > 0 ? "watch" : "flow"}>solar cut {detail.winner.curtailKWh.toFixed(1)} kWh</Pill>
                  </div>
                </>
              ) : (
                <div className="mt-2">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">⛔</span>
                    <div>
                      <div className="text-lg font-bold text-risk">No feasible action</div>
                      <div className="text-sm text-dim">Every fix still breaks a limit. GridGuard stops guessing and prescribes an upgrade.</div>
                    </div>
                  </div>
                  <Link href="/scenarios/" className="mt-3 inline-block text-sm font-semibold text-flow hover:underline">
                    See the upgrade plan →
                  </Link>
                </div>
              )}

              <button onClick={() => setShowWhy((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10">
                <span>🤔 Why this fix?</span>
                <span className="text-dim">{showWhy ? "−" : "+"}</span>
              </button>
              {showWhy && (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detail.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-flow/15 text-[11px] font-bold text-flow">{i + 1}</span>
                      <span className="text-ink/90">{r}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 text-[11px] text-faint">Every reason is built from a computed number — no AI text, nothing made up.</div>
              <Link href="/twin/actions/" className="mt-3 block rounded-lg border border-flow/40 px-3 py-2 text-center text-sm font-semibold text-flow hover:bg-flow/10">
                See all {detail.results.length} fixes compete in the Action Arena →
              </Link>
            </div>
                    <div className="card p-4">
            <div className="text-sm font-semibold text-dim">Looking ahead · no action taken</div>
            <div className="mt-3 overflow-x-auto">
              <table className="num w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="pb-2 font-medium">Time</th>
                    {RUNS.map((r) => (
                      <th key={r} className="pb-2 font-medium">
                        {RUN_LABEL[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rec.forecast.horizon.map((h) => (
                    <tr key={h.step} className="border-t border-line/60">
                      <td className="py-1.5 text-dim">{h.time}</td>
                      {RUNS.map((r) => {
                        const f = h.runs[r];
                        const bad = f.violations.length > 0;
                        const main = f.vMax > 1.03 || f.pvAvail > 5 ? f.vMax.toFixed(3) : `${Math.max(f.maxLine, f.trafoLoad).toFixed(0)}%`;
                        return (
                          <td key={r} className={`py-1.5 ${bad ? "font-bold text-risk" : "text-ink/80"}`}>
                            {bad ? "⚠ " : ""}
                            {main}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Solar ±25%, demand ±10% (stated assumption). Voltage shown in daytime, busiest-line loading at night.
            </p>
          </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <div className="text-sm font-semibold text-dim">Busiest line or transformer (%)</div>
            <DayChart day={day} kind="loading" step={step} height={170} onPick={setStep} />
          </div>
          <div className="card p-4">
            <div className="text-sm font-semibold text-dim">
              Battery at B3 — <Term tip="State of charge: how full the battery is. Kept between 20% and 90% to protect it.">charge level</Term> with GridGuard
            </div>
            <DayChart day={day} kind="soc" step={step} height={170} onPick={setStep} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className="num text-sm font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
