"use client";

import { useMemo } from "react";
import { vColor } from "@/components/FeederDiagram";
import { PageHeader, Pill, ScenarioTabs, Term, TimeScrubber } from "@/components/ui";
import { PV_BUSES, stepToTime } from "@/lib/config";
import { FAMILY_ICON, FAMILY_LABEL, lossReason, momentDetail, shortAction } from "@/lib/engine";
import { useTwin } from "@/lib/useTwin";

const RULES = ["Safe first", "Least solar cut", "Least battery use", "Fewest switch moves"];

export default function ActionArena() {
  const { day, step, setStep } = useTwin();
  const d = useMemo(() => momentDetail(day, step), [day, step]);
  const rec = d.rec;
  const cutMoments = day.steps.filter((s) => (s.action.curtail ?? 0) > 0).map((s) => s.step);

  return (
    <div className="grid-bg">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader eyebrow="Action Arena" title="Every fix tested. Only the best one wins." slogan="No guessing. Each fix is simulated in all 3 forecasts, then ranked by one strict rule." />

        <ScenarioTabs />
        <div className="mt-4">
          <TimeScrubber day={day} />
        </div>

        {/* Ranking rule */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-dim">Ranking rule:</span>
          {RULES.map((r, i) => (
            <span key={r} className="flex items-center gap-2">
              <span className="rounded-full border border-line bg-panel px-3 py-1 font-semibold">
                <span className="num mr-1 text-flow">{i + 1}</span>
                {r}
              </span>
              {i < RULES.length - 1 && <span className="text-faint">→</span>}
            </span>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card p-4 md:col-span-2">
            <div className="text-xs font-bold uppercase tracking-widest text-faint">At {stepToTime(step)} · {day.scenario.name}</div>
            {d.winner ? (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-4xl">🏆</span>
                <div>
                  <div className="text-xl font-extrabold">
                    {d.winner.family === "none" ? "Do nothing — the grid is safe" : `${FAMILY_LABEL[d.winner.family]}: ${shortAction(d.winner.action)}`}
                  </div>
                  <div className="text-sm text-dim">
                    {d.results.filter((r) => r.available && r.best.safe).length} of {d.results.filter((r) => r.available).length} tested fixes are safe. This one wastes the least.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-4xl">⛔</span>
                <div>
                  <div className="text-xl font-extrabold text-risk">No feasible action</div>
                  <div className="text-sm text-dim">All {d.results.filter((r) => r.available).length} tested fixes break a limit. The honest answer is an upgrade — see the Scenario Lab.</div>
                </div>
              </div>
            )}
          </div>
          <div className="card p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-faint">Doing nothing would give</div>
            <div className="num mt-2 text-2xl font-bold" style={{ color: vColor(d.none.vMax) }}>
              {d.none.vMax.toFixed(3)} <span className="text-sm text-dim">p.u. max</span>
            </div>
            <div className="num text-sm" style={{ color: d.none.maxLoad > 100 ? "#f43f5e" : "#8a99b0" }}>
              {d.none.maxLoad.toFixed(0)}% busiest equipment
            </div>
            <div className="mt-1">{d.none.safe ? <Pill tone="safe">safe</Pill> : <Pill tone="risk">breaks a limit</Pill>}</div>
          </div>
        </div>

        {/* The arena table */}
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm [&_td]:whitespace-nowrap [&_td:nth-child(2)]:whitespace-normal [&_td:last-child]:whitespace-normal">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Fix</th>
                <th className="p-3 font-medium">Size</th>
                <th className="p-3 font-medium">Safe?</th>
                <th className="p-3 text-right font-medium">
                  <Term tip="Solar energy thrown away on purpose to protect the line, over this 15-minute step.">Solar cut</Term>
                </th>
                <th className="p-3 text-right font-medium">Battery used</th>
                <th className="p-3 text-right font-medium">Switch moves</th>
                <th className="p-3 text-right font-medium">Max V</th>
                <th className="p-3 text-right font-medium">Min V</th>
                <th className="p-3 text-right font-medium">Max load</th>
                <th className="p-3 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {d.results.map((r, i) => {
                const e = r.best;
                const win = d.winner && e === d.winner;
                return (
                  <tr key={r.family} className={`border-b border-line/50 ${win ? "bg-safe/10" : !r.available ? "opacity-45" : ""}`}>
                    <td className="num p-3 text-faint">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <span>{FAMILY_ICON[r.family]}</span>
                        {FAMILY_LABEL[r.family]}
                      </div>
                    </td>
                    <td className="num p-3 text-dim">{r.available ? shortAction(e.action) : "—"}</td>
                    <td className="p-3">{!r.available ? <Pill tone="dim">n/a</Pill> : e.safe ? <Pill tone="safe">✓ safe</Pill> : <Pill tone="risk">✗ unsafe</Pill>}</td>
                    <td className="num p-3 text-right">{r.available ? `${e.curtailKWh.toFixed(2)} kWh` : "—"}</td>
                    <td className="num p-3 text-right">{r.available ? `${e.battKWh.toFixed(2)} kWh` : "—"}</td>
                    <td className="num p-3 text-right">{r.available ? e.switchOps : "—"}</td>
                    <td className="num p-3 text-right" style={{ color: r.available ? vColor(e.vMax) : undefined }}>
                      {r.available ? e.vMax.toFixed(3) : "—"}
                    </td>
                    <td className="num p-3 text-right" style={{ color: r.available ? vColor(e.vMin) : undefined }}>
                      {r.available ? e.vMin.toFixed(3) : "—"}
                    </td>
                    <td className="num p-3 text-right" style={{ color: r.available && e.maxLoad > 100 ? "#f43f5e" : undefined }}>
                      {r.available ? `${e.maxLoad.toFixed(0)}%` : "—"}
                    </td>
                    <td className="p-3 text-xs">{win ? <span className="font-bold text-safe">🏆 Winner</span> : <span className="text-dim">{lossReason(r, d.winner)}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">
          Each row shows the smallest safe size of that fix (or its strongest try if no size is safe). Alone and in pairs — {d.results.length} families in total. Checked in 3 forecasts: low, expected and high solar.
        </p>

        {/* Fair curtailment */}
        <div className="mt-8">
          <h2 className="text-2xl font-extrabold">✂️ Fair solar cuts</h2>
          <p className="text-dim">Cuts are shared by system size — not dumped on the last house on the line.</p>
          {d.fair ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FairCard
                title="GridGuard: shared by size"
                tone="safe"
                jain={d.fair.fairJain}
                kw={d.fair.fairKw}
                pv={rec.inj.pv}
              />
              <FairCard
                title="The usual way: end of line only"
                tone="risk"
                jain={d.fair.endJain}
                kw={d.fair.endKw}
                pv={rec.inj.pv}
                missing={!d.fair.endPossible}
              />
            </div>
          ) : (
            <div className="card mt-4 flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div className="text-dim">No solar cut is needed at {stepToTime(step)}. 🎉 Every rooftop keeps 100% of its output.</div>
              {cutMoments.length > 0 && (
                <button onClick={() => setStep(cutMoments[Math.floor(cutMoments.length / 2)])} className="rounded-full border border-flow/40 px-4 py-2 text-sm font-semibold text-flow hover:bg-flow/10">
                  Jump to a moment with a cut ({stepToTime(cutMoments[Math.floor(cutMoments.length / 2)])}) →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FairCard({ title, tone, jain, kw, pv, missing }: { title: string; tone: "safe" | "risk"; jain: number | null; kw: Record<string, number> | null; pv: Record<string, number>; missing?: boolean }) {
  return (
    <div className={`card p-5 ${tone === "safe" ? "ring-1 ring-safe/40" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="font-bold">{title}</div>
        {jain !== null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-faint">
              <Term tip="Jain's fairness index. 1.00 = everyone loses the same share. 0.33 = one house carries it all.">Fairness</Term>
            </div>
            <div className={`num text-2xl font-extrabold ${tone === "safe" ? "text-safe" : "text-risk"}`}>{jain.toFixed(2)}</div>
          </div>
        )}
      </div>
      {missing || !kw ? (
        <div className="mt-3 text-sm text-dim">Cutting only the last house cannot fix this moment on its own.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {PV_BUSES.map((b) => {
            const cut = kw[b] ?? 0;
            const share = pv[b] > 0 ? cut / pv[b] : 0;
            return (
              <div key={b}>
                <div className="flex justify-between text-sm">
                  <span>
                    🏠 Rooftop at <b>{b}</b>
                  </span>
                  <span className="num text-dim">
                    −{cut.toFixed(1)} kW · {(share * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, share * 100)}%`, background: tone === "safe" ? "#34d399" : "#f43f5e" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
