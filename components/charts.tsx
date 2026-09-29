"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FEEDER, stepToTime } from "@/lib/config";
import { DayResult } from "@/lib/engine";

const AXIS = { stroke: "#56647a", fontSize: 11, fontFamily: "JetBrains Mono, monospace" };
const TICKS = [0, 24, 48, 72, 95];

function TooltipBox({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-panel2/95 px-3 py-2 text-xs shadow-xl">
      <div className="num mb-1 font-bold">{typeof label === "number" ? stepToTime(label) : label}</div>
      {payload
        .filter((p) => p.name && !p.name.startsWith("_"))
        .map((p) => (
          <div key={p.name} className="num flex justify-between gap-4" style={{ color: p.color }}>
            <span>{p.name}</span>
            <span>
              {typeof p.value === "number" ? p.value.toFixed(unit === "p.u." ? 3 : 1) : p.value} {unit}
            </span>
          </div>
        ))}
    </div>
  );
}

type Kind = "voltage" | "loading" | "soc" | "solar";

export function DayChart({ day, kind, step, height = 200, showBase = true, onPick }: { day: DayResult; kind: Kind; step?: number; height?: number; showBase?: boolean; onPick?: (s: number) => void }) {
  const data = day.steps.map((s) => {
    switch (kind) {
      case "voltage":
        return { t: s.step, base: s.base.vMax, gg: s.gg.vMax, baseMin: s.base.vMin, ggMin: s.gg.vMin };
      case "loading":
        return { t: s.step, base: Math.max(s.base.maxLine, s.base.trafoLoad), gg: Math.max(s.gg.maxLine, s.gg.trafoLoad) };
      case "soc":
        return { t: s.step, gg: s.socAfter * 100 };
      case "solar":
        return { t: s.step, avail: s.gg.pvAvail, used: s.gg.pvUsed, cutOnly: s.cutOnly.pvUsed };
    }
  });
  const unit = kind === "voltage" ? "p.u." : kind === "solar" ? "kW" : "%";
  const domain: [number, number] | ["auto", "auto"] =
    kind === "voltage" ? [0.92, 1.1] : kind === "loading" ? [0, Math.max(120, Math.ceil(Math.max(...data.map((d) => ("base" in d ? (d.base as number) : 0))) / 10) * 10 + 5)] : kind === "soc" ? [0, 100] : [0, 55];

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          onClick={(e) => {
            const l = (e as { activeLabel?: number | string } | null)?.activeLabel;
            if (onPick && l !== undefined) onPick(Number(l));
          }}
        >
          <CartesianGrid stroke="#1c2738" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="t" type="number" domain={[0, 95]} ticks={TICKS} tickFormatter={(v) => stepToTime(v)} {...AXIS} />
          <YAxis domain={domain} {...AXIS} tickFormatter={(v) => (kind === "voltage" ? v.toFixed(2) : String(Math.round(v)))} />
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ stroke: "#22d3ee", strokeOpacity: 0.4 }} />
          {kind === "voltage" && (
            <>
              <ReferenceArea y1={FEEDER.vMax} y2={1.1} fill="#f43f5e" fillOpacity={0.07} />
              <ReferenceArea y1={0.92} y2={FEEDER.vMin} fill="#f43f5e" fillOpacity={0.07} />
              <ReferenceLine y={FEEDER.vMax} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "1.05 limit", fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }} />
              <ReferenceLine y={FEEDER.vMin} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "0.95 limit", fill: "#f43f5e", fontSize: 10, position: "insideBottomRight" }} />
              {showBase && <Line dataKey="base" name="Highest · without" stroke="#f43f5e" strokeOpacity={0.8} dot={false} strokeWidth={1.8} isAnimationActive={false} />}
              {showBase && <Line dataKey="baseMin" name="Lowest · without" stroke="#f43f5e" strokeOpacity={0.5} strokeDasharray="3 3" dot={false} strokeWidth={1.5} isAnimationActive={false} />}
              <Line dataKey="gg" name="Highest · GridGuard" stroke="#34d399" dot={false} strokeWidth={2.4} isAnimationActive={false} />
              <Line dataKey="ggMin" name="Lowest · GridGuard" stroke="#34d399" strokeOpacity={0.6} strokeDasharray="3 3" dot={false} strokeWidth={1.6} isAnimationActive={false} />
            </>
          )}
          {kind === "loading" && (
            <>
              <ReferenceArea y1={100} y2={200} fill="#f43f5e" fillOpacity={0.07} />
              <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "100% limit", fill: "#f43f5e", fontSize: 10, position: "insideTopRight" }} />
              {showBase && <Line dataKey="base" name="Busiest · without" stroke="#f43f5e" strokeOpacity={0.8} dot={false} strokeWidth={1.8} isAnimationActive={false} />}
              <Line dataKey="gg" name="Busiest · GridGuard" stroke="#34d399" dot={false} strokeWidth={2.4} isAnimationActive={false} />
            </>
          )}
          {kind === "soc" && (
            <>
              <ReferenceArea y1={20} y2={90} fill="#22d3ee" fillOpacity={0.04} />
              <Area dataKey="gg" name="Battery charge" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
            </>
          )}
          {kind === "solar" && (
            <>
              <Area dataKey="avail" name="Solar available" stroke="#fde68a" strokeOpacity={0.5} fill="#fde68a" fillOpacity={0.08} strokeWidth={1.5} isAnimationActive={false} />
              <Line dataKey="cutOnly" name="Used · cut-only" stroke="#f43f5e" strokeOpacity={0.8} dot={false} strokeWidth={1.6} strokeDasharray="4 3" isAnimationActive={false} />
              <Line dataKey="used" name="Used · GridGuard" stroke="#34d399" dot={false} strokeWidth={2.4} isAnimationActive={false} />
            </>
          )}
          {step !== undefined && <ReferenceLine x={step} stroke="#22d3ee" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
